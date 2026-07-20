from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
try:
    from motor.motor_asyncio import AsyncIOMotorClient
except Exception:
    AsyncIOMotorClient = None
import os
import re
import logging
import uuid
import httpx
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date
# Emergent LLM is private; app runs locally without this package.
LlmChat = UserMessage = ImageContent = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
mongo_url = os.environ.get('MONGO_URL', '')
USE_LOCAL_DB = os.environ.get('USE_LOCAL_DB', '1') == '1'
if USE_LOCAL_DB:
    from localdb import LocalDB
    client = None
    db = LocalDB(ROOT_DIR / 'local_db.json')
else:
    if AsyncIOMotorClient is None:
        raise RuntimeError("motor is not installed. Use USE_LOCAL_DB=1 or install motor.")
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'test_database')]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def now_utc():
    return datetime.now(timezone.utc)


def uid(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------- Models ----------------
class SessionRequest(BaseModel):
    session_token: str


class RoleUpdate(BaseModel):
    role: str  # patient | relative | caregiver


class PatientCreate(BaseModel):
    name: str

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None

    insurance_number: Optional[str] = None
    health_insurance: Optional[str] = None
    care_grade: Optional[str] = None
    blood_group: Optional[str] = None

    contact: Optional[dict] = None
    accommodation: Optional[dict] = None
    medical_information: Optional[dict] = None
    nursing_assessment: Optional[dict] = None
    physical_information: Optional[dict] = None
    professional_contacts: Optional[dict] = None

    special_instructions: Optional[str] = None
    room: Optional[str] = None
    notes: Optional[str] = None

class RelativeCreate(BaseModel):
    first_name: str
    last_name: str
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    relationship: str

    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    is_emergency_contact: bool = False
    emergency_priority: Optional[int] = None

    permissions: Optional[dict] = None
    notifications: Optional[dict] = None
    notes: Optional[str] = None


class CaregiverCreate(BaseModel):
    first_name: str
    last_name: str
    professional_role: str
    work_area: Optional[str] = None

    organization: Optional[str] = None
    employee_number: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    is_primary_caregiver: bool = False
    available_for_emergency: bool = False

    permissions: Optional[dict] = None
    notifications: Optional[dict] = None
    notes: Optional[str] = None


class DoctorCreate(BaseModel):
    title: Optional[str] = None
    first_name: str
    last_name: str
    specialization: str
    contact_type: Optional[str] = "Hausarzt"

    practice_name: str
    practice_address: Optional[str] = None
    phone: Optional[str] = None
    emergency_phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

    opening_hours: Optional[str] = None
    consultation_notes: Optional[str] = None

    is_primary_doctor: bool = False
    available_for_emergency: bool = False

    permissions: Optional[dict] = None
    notifications: Optional[dict] = None
    notes: Optional[str] = None
class MedicationCreate(BaseModel):
    name: str
    dosage: str
    form: str = "Tablette"  # Tablette, Kapsel, Tropfen, Spritze, Creme
    times: List[str] = []   # ["08:00", "20:00"]
    days: List[int] = [0, 1, 2, 3, 4, 5, 6]  # 0=Mon
    color: str = "#1A65A9"
    frequency: Optional[str] = None
    prescriber: Optional[str] = None
    note: Optional[str] = None


class IntakeAction(BaseModel):
    patient_id: str
    medication_id: str
    scheduled_date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    status: str          # taken | missed


class SosCreate(BaseModel):
    patient_id: Optional[str] = None
    message: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    patient_id: Optional[str] = None


class AllergyUpdate(BaseModel):
    allergies: List[str] = []


class CheckMedication(BaseModel):
    name: str
    dosage: Optional[str] = None


class OcrRequest(BaseModel):
    image_base64: str


# Allergy class -> medication name substrings that conflict
ALLERGY_MED_MAP = {
    "Penicillin": ["amoxicillin", "penicillin", "ampicillin"],
    "Antibiotika": ["amoxicillin", "azithromycin", "ciprofloxacin", "metronidazol", "penicillin"],
    "NSAR / Schmerzmittel": ["ibuprofen", "diclofenac", "aspirin", "voltaren", "naproxen", "novaminsulfon", "metamizol"],
    "ASS / Aspirin": ["aspirin"],
    "Sulfonamide": ["hydrochlorothiazid", "furosemid", "torasemid"],
    "Statine": ["atorvastatin", "simvastatin"],
    "Laktose": [],
    "Jod / Kontrastmittel": [],
    "Cortison": ["cortison", "methylprednisolon", "hydrocortison"],
}

# Pairwise interaction rules (substring match on lowercase names)
INTERACTION_RULES = [
    ("marcumar", "aspirin", "high", "Stark erhöhtes Blutungsrisiko. Kombination vermeiden."),
    ("marcumar", "ibuprofen", "high", "Erhöhtes Blutungsrisiko unter Gerinnungshemmung."),
    ("marcumar", "diclofenac", "high", "Erhöhtes Blutungsrisiko unter Gerinnungshemmung."),
    ("aspirin", "ibuprofen", "medium", "Ibuprofen kann die herzschützende Wirkung von ASS abschwächen; Magenrisiko."),
    ("diazepam", "lorazepam", "high", "Doppelte Benzodiazepine – Gefahr starker Sedierung/Atemdepression."),
    ("sertralin", "citalopram", "high", "Risiko eines Serotonin-Syndroms bei Kombination."),
    ("simvastatin", "atorvastatin", "medium", "Doppelte Statin-Therapie – Muskelschäden möglich."),
    ("metoprolol", "bisoprolol", "medium", "Doppelte Betablocker – Bradykardie/Blutdruckabfall."),
    ("ramipril", "hydrochlorothiazid", "low", "Blutdruck und Elektrolyte engmaschig kontrollieren."),
    ("ibuprofen", "ramipril", "medium", "NSAR kann Blutdruck erhöhen und Nierenfunktion belasten."),
    ("l-thyroxin", "eisen", "medium", "Eisen vermindert die Aufnahme – Abstand von 2–4 Std einhalten."),
    ("l-thyroxin", "magnesium", "medium", "Magnesium vermindert die Aufnahme – zeitlichen Abstand halten."),
    ("furosemid", "ramipril", "low", "Blutdruck/Nierenwerte kontrollieren."),
    ("metformin", "furosemid", "low", "Nierenfunktion beobachten."),
]

# PZN barcode -> medication (local curated mapping)
BARCODE_MAP = {
    "06313438": {"pzn": "06313438", "name": "Ibuflam 800 mg Lichtenstein", "dosage": "800 mg", "form": "Filmtablette", "package": "20 Stück"},
    "12345678": {"pzn": "12345678", "name": "Metformin", "dosage": "500 mg", "form": "Tablette", "package": "100 Stück"},
    "23456789": {"pzn": "23456789", "name": "Ramipril", "dosage": "5 mg", "form": "Tablette", "package": "50 Stück"},
    "34567890": {"pzn": "34567890", "name": "Ibuprofen", "dosage": "400 mg", "form": "Tablette", "package": "50 Stück"},
    "45678901": {"pzn": "45678901", "name": "Atorvastatin", "dosage": "20 mg", "form": "Tablette", "package": "100 Stück"},
    "56789012": {"pzn": "56789012", "name": "Pantoprazol", "dosage": "20 mg", "form": "Tablette", "package": "60 Stück"},
    "04150063": {"pzn": "04150063", "name": "Aspirin", "dosage": "100 mg", "form": "Tablette", "package": "100 Stück"},
}


def normalize_medication_barcode(raw: str) -> str:
    value = re.sub(r"\D", "", (raw or "").strip().lstrip("-"))
    if len(value) == 7:
        value = value.zfill(8)
    return value


def _check_allergies(med_name: str, allergies: list):
    conflicts = []
    ml = (med_name or "").lower()
    for allergy in allergies:
        subs = ALLERGY_MED_MAP.get(allergy, [])
        for s in subs:
            if s in ml:
                conflicts.append({
                    "allergy": allergy,
                    "medication": med_name,
                    "risk": "high",
                    "message": f"„{med_name}“ kann bei bekannter Allergie gegen {allergy} eine schwere Reaktion auslösen.",
                })
                break
    return conflicts


def _check_interaction_pair(a: str, b: str):
    al, bl = a.lower(), b.lower()
    for x, y, risk, note in INTERACTION_RULES:
        if (x in al and y in bl) or (x in bl and y in al):
            return {"risk": risk, "note": note}
    return None


# Curated medication database (common German medications)
MED_DATABASE = [
    {"name": "Metformin", "dosage": "500 mg", "form": "Tablette", "category": "Diabetes"},
    {"name": "Metformin", "dosage": "1000 mg", "form": "Tablette", "category": "Diabetes"},
    {"name": "Ramipril", "dosage": "5 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Ramipril", "dosage": "10 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Amlodipin", "dosage": "5 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Bisoprolol", "dosage": "2,5 mg", "form": "Tablette", "category": "Herz"},
    {"name": "Atorvastatin", "dosage": "20 mg", "form": "Tablette", "category": "Cholesterin"},
    {"name": "Simvastatin", "dosage": "40 mg", "form": "Tablette", "category": "Cholesterin"},
    {"name": "Pantoprazol", "dosage": "20 mg", "form": "Tablette", "category": "Magen"},
    {"name": "Omeprazol", "dosage": "20 mg", "form": "Kapsel", "category": "Magen"},
    {"name": "Ibuprofen", "dosage": "400 mg", "form": "Tablette", "category": "Schmerz"},
    {"name": "Ibuprofen", "dosage": "600 mg", "form": "Tablette", "category": "Schmerz"},
    {"name": "Paracetamol", "dosage": "500 mg", "form": "Tablette", "category": "Schmerz"},
    {"name": "Aspirin", "dosage": "100 mg", "form": "Tablette", "category": "Blutverdünnung"},
    {"name": "Marcumar", "dosage": "3 mg", "form": "Tablette", "category": "Blutverdünnung"},
    {"name": "L-Thyroxin", "dosage": "50 µg", "form": "Tablette", "category": "Schilddrüse"},
    {"name": "L-Thyroxin", "dosage": "100 µg", "form": "Tablette", "category": "Schilddrüse"},
    {"name": "Vitamin D3", "dosage": "1000 I.E.", "form": "Tablette", "category": "Vitamine"},
    {"name": "Vitamin B12", "dosage": "1000 µg", "form": "Tablette", "category": "Vitamine"},
    {"name": "Magnesium", "dosage": "400 mg", "form": "Tablette", "category": "Mineralstoffe"},
    {"name": "Eisen", "dosage": "100 mg", "form": "Kapsel", "category": "Mineralstoffe"},
    {"name": "Insulin", "dosage": "10 I.E.", "form": "Spritze", "category": "Diabetes"},
    {"name": "Cortison", "dosage": "5 mg", "form": "Tablette", "category": "Entzündung"},
    {"name": "Salbutamol", "dosage": "100 µg", "form": "Sonstiges", "category": "Atemwege"},
    {"name": "Cetirizin", "dosage": "10 mg", "form": "Tablette", "category": "Allergie"},
    {"name": "Furosemid", "dosage": "40 mg", "form": "Tablette", "category": "Entwässerung"},
    {"name": "Torasemid", "dosage": "10 mg", "form": "Tablette", "category": "Entwässerung"},
    {"name": "Novaminsulfon", "dosage": "500 mg", "form": "Tropfen", "category": "Schmerz"},
    {"name": "Diclofenac", "dosage": "75 mg", "form": "Tablette", "category": "Schmerz"},
    {"name": "Candesartan", "dosage": "8 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Melperon", "dosage": "25 mg", "form": "Tablette", "category": "Neurologie"},
    {"name": "Tamsulosin", "dosage": "0,4 mg", "form": "Kapsel", "category": "Urologie"},
    {"name": "Metoprolol", "dosage": "47,5 mg", "form": "Tablette", "category": "Herz"},
    {"name": "Metoprolol", "dosage": "95 mg", "form": "Tablette", "category": "Herz"},
    {"name": "Methocarbamol", "dosage": "750 mg", "form": "Tablette", "category": "Muskel"},
    {"name": "Methotrexat", "dosage": "10 mg", "form": "Tablette", "category": "Rheuma"},
    {"name": "Methylprednisolon", "dosage": "4 mg", "form": "Tablette", "category": "Entzündung"},
    {"name": "Metronidazol", "dosage": "400 mg", "form": "Tablette", "category": "Antibiotikum"},
    {"name": "Metamizol", "dosage": "500 mg", "form": "Tropfen", "category": "Schmerz"},
    {"name": "Amoxicillin", "dosage": "1000 mg", "form": "Tablette", "category": "Antibiotikum"},
    {"name": "Azithromycin", "dosage": "500 mg", "form": "Tablette", "category": "Antibiotikum"},
    {"name": "Ciprofloxacin", "dosage": "500 mg", "form": "Tablette", "category": "Antibiotikum"},
    {"name": "Losartan", "dosage": "50 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Valsartan", "dosage": "80 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Enalapril", "dosage": "10 mg", "form": "Tablette", "category": "Blutdruck"},
    {"name": "Hydrochlorothiazid", "dosage": "25 mg", "form": "Tablette", "category": "Entwässerung"},
    {"name": "Gabapentin", "dosage": "300 mg", "form": "Kapsel", "category": "Neurologie"},
    {"name": "Pregabalin", "dosage": "75 mg", "form": "Kapsel", "category": "Neurologie"},
    {"name": "Levodopa", "dosage": "100 mg", "form": "Tablette", "category": "Neurologie"},
    {"name": "Diazepam", "dosage": "5 mg", "form": "Tablette", "category": "Beruhigung"},
    {"name": "Lorazepam", "dosage": "1 mg", "form": "Tablette", "category": "Beruhigung"},
    {"name": "Sertralin", "dosage": "50 mg", "form": "Tablette", "category": "Psyche"},
    {"name": "Citalopram", "dosage": "20 mg", "form": "Tablette", "category": "Psyche"},
    {"name": "Voltaren", "dosage": "1 %", "form": "Creme", "category": "Schmerz"},
    {"name": "Diclofenac Gel", "dosage": "1 %", "form": "Creme", "category": "Schmerz"},
    {"name": "Bepanthen", "dosage": "5 %", "form": "Creme", "category": "Wundheilung"},
    {"name": "Fenistil", "dosage": "0,1 %", "form": "Creme", "category": "Allergie"},
    {"name": "Hydrocortison", "dosage": "0,5 %", "form": "Creme", "category": "Haut"},
    {"name": "Heparin", "dosage": "60.000 I.E.", "form": "Creme", "category": "Durchblutung"},
    {"name": "Vitamin C", "dosage": "500 mg", "form": "Tablette", "category": "Vitamine"},
    {"name": "Folsäure", "dosage": "5 mg", "form": "Tablette", "category": "Vitamine"},
]


# ---------------- Auth helpers ----------------
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@api_router.get("/health")
async def health():
    return {"ok": True, "mode": "local" if USE_LOCAL_DB else "mongo"}


# ---------------- Auth routes ----------------
@api_router.post("/auth/session")
async def create_session(req: SessionRequest):
    # Local Windows/dev mode: accept a local token instead of Emergent OAuth.
    if req.session_token.startswith("local") or req.session_token == "dev":
        data = {
            "email": "local@vylnax.pro",
            "name": "VYLNAX Benutzer",
            "picture": "",
            "session_token": req.session_token if req.session_token else uid("session"),
        }
    else:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": req.session_token})
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session token")
        data = resp.json()
    email = data["email"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        role = existing.get("role", "patient")
    else:
        user_id = uid("user")
        role = "patient"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "role": role,
            "created_at": now_utc().isoformat(),
        })
        # Auto-create a self patient for new user
        await db.patients.insert_one({
            "id": uid("pat"),
            "owner_id": user_id,
            "name": data.get("name", "Ich"),
            "age": None, "room": None, "notes": "Eigenes Profil",
            "is_self": True,
            "created_at": now_utc().isoformat(),
        })

    session_token = data["session_token"]
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.put("/auth/role")
async def update_role(body: RoleUpdate, user=Depends(get_current_user)):
    if body.role not in ("patient", "relative", "caregiver"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": body.role}})
    return {"ok": True, "role": body.role}


# ---------------- Patients ----------------
@api_router.get("/patients")
async def list_patients(user=Depends(get_current_user)):
    docs = await db.patients.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda d: (not d.get("is_self", False), d.get("created_at", "")))
    return docs


@api_router.post("/patients")
async def add_patient(
    body: PatientCreate,
    user=Depends(get_current_user)
):
    patient_data = body.model_dump()

    doc = {
        "_id": uid("pat"),
        "owner_id": user["user_id"],
        **patient_data,
        "is_self": False,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.patients.insert_one(doc)

    doc.pop("_id", None)

    return doc
    


@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, user=Depends(get_current_user)):
    await db.patients.delete_one({"id": patient_id, "owner_id": user["user_id"]})
    await db.medications.delete_many({"patient_id": patient_id})
    await db.intakes.delete_many({"patient_id": patient_id})
    return {"ok": True}


async def _owns_patient(user, patient_id):
    p = await db.patients.find_one({"id": patient_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p
# ---------------- Relatives ----------------

@api_router.get("/relatives")
async def list_relatives(user=Depends(get_current_user)):
    docs = await db.relatives.find(
        {"owner_id": user["user_id"]},
        {"_id": 0},
    ).to_list(200)

    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.post("/relatives")
async def add_relative(
    body: RelativeCreate,
    user=Depends(get_current_user),
):
    relative_data = body.model_dump()

    doc = {
        "_id": uid("rel"),
        "owner_id": user["user_id"],
        **relative_data,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.relatives.insert_one(doc)
    doc.pop("_id", None)

    return doc


@api_router.delete("/relatives/{relative_id}")
async def delete_relative(
    relative_id: str,
    user=Depends(get_current_user),
):
    result = await db.relatives.delete_one({
        "_id": relative_id,
        "owner_id": user["user_id"],
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Relative not found",
        )

    return {"ok": True}


# ---------------- Caregivers ----------------

@api_router.get("/caregivers")
async def list_caregivers(user=Depends(get_current_user)):
    docs = await db.caregivers.find(
        {"owner_id": user["user_id"]}
    ).to_list(200)

    for doc in docs:
        doc["id"] = str(doc.get("id") or doc["_id"])
        doc.pop("_id", None)

    docs.sort(
        key=lambda d: d.get("created_at", ""),
        reverse=True
    )

    return docs


@api_router.post("/caregivers")
async def add_caregiver(
    body: CaregiverCreate,
    user=Depends(get_current_user),
):
    caregiver_data = body.model_dump()
    caregiver_id = uid("care")

    doc = {
        "_id": caregiver_id,
        "id": caregiver_id,
        "owner_id": user["user_id"],
        **caregiver_data,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.caregivers.insert_one(doc)

    doc.pop("_id", None)
    return doc


@api_router.delete("/caregivers/{caregiver_id}")
async def delete_caregiver(
    caregiver_id: str,
    user=Depends(get_current_user),
):
    result = await db.caregivers.delete_one(
        {
            "_id": caregiver_id,
            "owner_id": user["user_id"],
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Caregiver not found"
        )

    return {
        "success": True,
        "deleted_id": caregiver_id,
    }


# ---------------- Doctors ----------------

@api_router.get("/doctors")
async def list_doctors(user=Depends(get_current_user)):
    docs = await db.doctors.find(
        {"owner_id": user["user_id"]},
        {"_id": 0},
    ).to_list(200)

    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.post("/doctors")
async def add_doctor(
    body: DoctorCreate,
    user=Depends(get_current_user),
):
    doctor_data = body.model_dump()

    doc = {
        "_id": uid("doc"),
        "owner_id": user["user_id"],
        **doctor_data,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.doctors.insert_one(doc)
    doc.pop("_id", None)

    return doc


@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(
    doctor_id: str,
    user=Depends(get_current_user),
):
    result = await db.doctors.delete_one({
        "_id": doctor_id,
        "owner_id": user["user_id"],
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    return {"ok": True}

# ---------------- Medications ----------------
@api_router.get("/patients/{patient_id}/medications")
async def list_meds(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    return await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)


@api_router.post("/patients/{patient_id}/medications")
async def add_med(patient_id: str, body: MedicationCreate, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    doc = {
        "id": uid("med"),
        "patient_id": patient_id,
        "name": body.name,
        "dosage": body.dosage,
        "form": body.form,
        "times": sorted(body.times),
        "days": body.days,
        "color": body.color,
        "frequency": body.frequency,
        "prescriber": body.prescriber,
        "note": body.note,
        "created_at": now_utc().isoformat(),
    }
    await db.medications.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/medications/{med_id}")
async def delete_med(med_id: str, user=Depends(get_current_user)):
    med = await db.medications.find_one({"id": med_id}, {"_id": 0})
    if med:
        await _owns_patient(user, med["patient_id"])
        await db.medications.delete_one({"id": med_id})
        await db.intakes.delete_many({"medication_id": med_id})
    return {"ok": True}


# ---------------- Schedule ----------------
@api_router.get("/patients/{patient_id}/schedule")
async def schedule(patient_id: str, date_str: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    weekday = d.weekday()  # 0=Mon
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)
    logs = await db.intakes.find(
        {"patient_id": patient_id, "scheduled_date": date_str}, {"_id": 0}
    ).to_list(1000)
    log_map = {(l["medication_id"], l["scheduled_time"]): l for l in logs}

    now = now_utc()
    items = []
    for m in meds:
        if weekday not in m.get("days", []):
            continue
        for t in m.get("times", []):
            log = log_map.get((m["id"], t))
            if log:
                status = log["status"]
            else:
                # determine pending vs missed
                slot_dt = datetime.strptime(f"{date_str} {t}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
                if slot_dt < now - timedelta(hours=2):
                    status = "missed"
                else:
                    status = "pending"
            items.append({
                "medication_id": m["id"],
                "name": m["name"],
                "dosage": m["dosage"],
                "form": m["form"],
                "color": m.get("color", "#1A65A9"),
                "time": t,
                "status": status,
                "taken_at": log.get("taken_at") if log else None,
            })
    items.sort(key=lambda x: x["time"])
    return {"date": date_str, "items": items}


# ---------------- Intake actions ----------------
@api_router.post("/intake")
async def record_intake(body: IntakeAction, user=Depends(get_current_user)):
    await _owns_patient(user, body.patient_id)
    if body.status not in ("taken", "missed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    key = {
        "patient_id": body.patient_id,
        "medication_id": body.medication_id,
        "scheduled_date": body.scheduled_date,
        "scheduled_time": body.scheduled_time,
    }
    doc = {
        **key,
        "status": body.status,
        "taken_at": now_utc().isoformat() if body.status == "taken" else None,
    }
    await db.intakes.update_one(key, {"$set": doc}, upsert=True)
    return {"ok": True, **doc}


# ---------------- Reports ----------------
@api_router.get("/patients/{patient_id}/reports")
async def reports(patient_id: str, period: str = "week", user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    days = {"day": 1, "week": 7, "month": 30}.get(period, 7)
    today = now_utc().date()
    start = today - timedelta(days=days - 1)
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)
    logs = await db.intakes.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).to_list(5000)
    log_map = {}
    for l in logs:
        log_map[(l["medication_id"], l["scheduled_date"], l["scheduled_time"])] = l["status"]

    now = now_utc()
    total = taken = missed = pending = 0
    daily = []
    for i in range(days):
        d = start + timedelta(days=i)
        ds = d.strftime("%Y-%m-%d")
        wd = d.weekday()
        d_total = d_taken = d_missed = 0
        for m in meds:
            if wd not in m.get("days", []):
                continue
            for t in m.get("times", []):
                d_total += 1
                st = log_map.get((m["id"], ds, t))
                if st == "taken":
                    d_taken += 1
                elif st == "missed":
                    d_missed += 1
                else:
                    slot_dt = datetime.strptime(f"{ds} {t}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
                    if slot_dt < now - timedelta(hours=2):
                        d_missed += 1
                    else:
                        pending += 1
        total += d_total
        taken += d_taken
        missed += d_missed
        daily.append({
            "date": ds,
            "label": WEEKDAYS[wd],
            "total": d_total,
            "taken": d_taken,
            "missed": d_missed,
            "rate": round((d_taken / d_total) * 100) if d_total else 0,
        })
    scheduled = taken + missed
    adherence = round((taken / scheduled) * 100) if scheduled else 100
    return {
        "period": period,
        "adherence": adherence,
        "taken": taken,
        "missed": missed,
        "pending": pending,
        "total": total,
        "daily": daily,
    }


# ---------------- Device (simulated, medical-grade) ----------------
def _compartment_status(tablets, capacity):
    ratio = tablets / capacity if capacity else 0
    if tablets <= 0:
        return "empty"
    if ratio <= 0.25:
        return "low"
    return "ok"


@api_router.get("/patients/{patient_id}/device")
async def device(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(200)

    state = await db.device_state.find_one({"patient_id": patient_id}, {"_id": 0})
    if not state:
        state = {
            "patient_id": patient_id,
            "firmware": "3.2.1",
            "serial": f"VX-{patient_id[-6:].upper()}",
            "last_restart": now_utc().isoformat(),
            "last_maintenance": (now_utc() - timedelta(days=12)).isoformat(),
        }
        await db.device_state.insert_one(dict(state))

    minute = now_utc().minute
    hour = now_utc().hour

    # Compartments from medications (fallback demo compartments)
    compartments = []
    caps = 30
    base_meds = meds if meds else [
        {"name": "Metformin", "color": "#1A65A9"}, {"name": "Ramipril", "color": "#0B3A64"},
        {"name": "Aspirin", "color": "#DC2626"}, {"name": "Vitamin D3", "color": "#0284C7"},
    ]
    for i, m in enumerate(base_meds[:12]):
        # deterministic-ish remaining count
        tablets = max(0, (caps - ((i * 7 + minute) % caps)))
        if i == 2:
            tablets = 4   # one low
        if i == 3 and len(base_meds) > 3:
            tablets = 0   # one empty
        compartments.append({
            "slot": i + 1,
            "med": m["name"],
            "color": m.get("color", "#1A65A9"),
            "tablets": tablets,
            "capacity": caps,
            "status": _compartment_status(tablets, caps),
        })

    daily_use = max(1, sum(len(m.get("times", [1])) for m in base_meds))
    total_tablets = sum(c["tablets"] for c in compartments)
    days_remaining = int(total_tablets / daily_use) if daily_use else 0

    water_level = max(80, 500 - (minute % 6) * 60)
    remaining_doses = water_level // 40

    low_comps = [c for c in compartments if c["status"] in ("low", "empty")]
    reminders = []
    if low_comps:
        reminders.append({"type": "refill", "title": "Nachfüllen erforderlich", "detail": f"{len(low_comps)} Fach/Fächer niedrig oder leer.", "urgent": any(c["status"] == "empty" for c in low_comps)})
    if water_level < 150:
        reminders.append({"type": "water", "title": "Wasser nachfüllen", "detail": f"Nur noch {water_level} ml – ca. {remaining_doses} Dosen.", "urgent": True})
    reminders.append({"type": "cleaning", "title": "Reinigung & UVC-Wartung", "detail": "Nächste empfohlene Reinigung in 3 Tagen.", "urgent": False})

    error_log = [
        {"time": (now_utc() - timedelta(hours=5)).isoformat(), "code": "SYNC-OK", "message": "Synchronisation erfolgreich", "severity": "info"},
        {"time": (now_utc() - timedelta(days=1, hours=2)).isoformat(), "code": "WATER-LOW", "message": "Wasserstand niedrig erkannt", "severity": "warning"},
        {"time": (now_utc() - timedelta(days=3)).isoformat(), "code": "COMP-EMPTY", "message": "Fach 3 leer gemeldet", "severity": "warning"},
    ]
    maintenance_history = [
        {"date": state["last_maintenance"][:10], "type": "Reinigung", "note": "Standardreinigung & UVC durchgeführt"},
        {"date": (now_utc() - timedelta(days=40)).strftime("%Y-%m-%d"), "type": "Firmware", "note": "Update auf 3.1.0"},
        {"date": (now_utc() - timedelta(days=90)).strftime("%Y-%m-%d"), "type": "Inspektion", "note": "Erstinbetriebnahme"},
    ]

    latest_fw = "3.3.0"
    dispenser = {
        "id": "dispenser-1",
        "name": "VYLNAX PRO",
        "serial": state["serial"],
        "firmware": state["firmware"],
        "latest_firmware": latest_fw,
        "update_available": state["firmware"] != latest_fw,
        "connected": True,
        "status": "Alles in Ordnung" if not low_comps and water_level >= 150 else "Wartung empfohlen",
        "bluetooth_signal": 78 + (minute % 20),
        "wifi_signal": 65 + (minute % 30),
        "last_sync": now_utc().isoformat(),
        "battery": 100,
        "battery_health": 96,
        "power_supply": "Netzbetrieb",
        "backup_battery": 88,
        "temperature_c": round(21.5 + (minute % 10) * 0.2, 1),
        "humidity_pct": 40 + (minute % 12),
        "water": {
            "level_ml": water_level, "max_ml": 500, "remaining_doses": remaining_doses,
            "pump_status": "Bereit", "uvc_status": "Aktiv – sterilisiert",
            "refill_due": water_level < 150, "cleaning_due": False,
        },
        "compartments": compartments,
        "compartments_total": len(compartments),
        "compartments_filled": len([c for c in compartments if c["status"] == "ok"]),
        "days_remaining": days_remaining,
        "error_log": error_log,
        "maintenance_history": maintenance_history,
        "location": "Wohnzimmer, Zuhause",
        "reminders": reminders,
        "last_restart": state["last_restart"],
    }
    band = {
        "id": "band-1", "name": "VYLNAX Band", "connected": True,
        "battery": max(35, 90 - minute % 40), "battery_health": 92,
        "heart_rate": 68 + minute % 8, "steps": 3200 + minute * 30,
        "bluetooth_signal": 82 + (minute % 15), "firmware": "1.4.2",
        "last_sync": now_utc().isoformat(), "location": "Am Handgelenk",
    }

    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    devices = [
        {"id": "dispenser-1", "name": "VYLNAX PRO", "type": "dispenser", "patient": p.get("name") if p else "", "location": dispenser["location"], "connected": True},
        {"id": "band-1", "name": "VYLNAX Band", "type": "band", "patient": p.get("name") if p else "", "location": band["location"], "connected": True},
    ]

    return {"devices": devices, "dispenser": dispenser, "band": band}


class DeviceAction(BaseModel):
    action: str  # firmware | restart | run_diagnostics
    device_id: Optional[str] = "dispenser-1"


@api_router.post("/patients/{patient_id}/device/action")
async def device_action(patient_id: str, body: DeviceAction, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    state = await db.device_state.find_one({"patient_id": patient_id}, {"_id": 0})
    if not state:
        raise HTTPException(status_code=404, detail="Kein Gerät")
    if body.action == "firmware":
        await db.device_state.update_one({"patient_id": patient_id}, {"$set": {"firmware": "3.3.0"}})
        return {"ok": True, "message": "Firmware erfolgreich auf 3.3.0 aktualisiert.", "firmware": "3.3.0"}
    if body.action == "restart":
        await db.device_state.update_one({"patient_id": patient_id}, {"$set": {"last_restart": now_utc().isoformat()}})
        return {"ok": True, "message": "Gerät wird neu gestartet…"}
    if body.action == "run_diagnostics":
        return {
            "ok": True,
            "message": "Diagnose abgeschlossen – keine kritischen Fehler.",
            "results": [
                {"check": "Motor & Ausgabemechanik", "status": "ok"},
                {"check": "Wasserpumpe", "status": "ok"},
                {"check": "UVC-Sterilisation", "status": "ok"},
                {"check": "Sensoren (Temp/Feuchte)", "status": "ok"},
                {"check": "Netzwerkverbindung", "status": "ok"},
                {"check": "Backup-Akku", "status": "ok"},
            ],
        }
    raise HTTPException(status_code=400, detail="Unbekannte Aktion")


# ---------------- SOS ----------------
@api_router.post("/sos")
async def sos(body: SosCreate, user=Depends(get_current_user)):
    doc = {
        "id": uid("sos"),
        "user_id": user["user_id"],
        "patient_id": body.patient_id,
        "message": body.message or "Notruf ausgelöst",
        "created_at": now_utc().isoformat(),
    }
    await db.sos_events.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"SOS triggered by {user['user_id']}")
    return {"ok": True, **doc}


# ---------------- Medication Database ----------------
@api_router.get("/med-database")
async def med_database(q: str = "", user=Depends(get_current_user)):
    ql = q.strip().lower()
    if not ql:
        return MED_DATABASE[:12]
    results = [m for m in MED_DATABASE if ql in m["name"].lower() or ql in m["category"].lower()]
    return results[:20]


# ---------------- AI Medication Assistant ----------------
def _build_system_prompt(patient_name, meds, allergies=None):
    med_lines = "\n".join(
        [f"- {m['name']} {m['dosage']} ({m['form']}), Zeiten: {', '.join(m.get('times', []))}" for m in meds]
    ) or "Noch keine Medikamente hinterlegt."
    allergy_lines = ", ".join(allergies or []) or "keine hinterlegt"
    return (
        "Du bist der digitale Assistent von VYLNAX PRO."
 "Antworte immer kurz, klar, freundlich und in der Sprache des Nutzers (Deutsch, Bosnisch oder Englisch)."
 "Beginne Antworten niemals mit 'Ich bin VYLNAX', 'Ich bin Ihr Assistent' oder einer Selbstvorstellung."
 "Wenn der Nutzer dich nur begrüßt, antworte ausschließlich mit: 'Wie kann ich Ihnen helfen?'"
 "Stelle dich nur vor, wenn der Nutzer ausdrücklich fragt, wer du bist oder wer dich entwickelt hat."
         "Wenn der Nutzer fragt, wer dein Entwickler, Erfinder, Schöpfer, Gründer oder Ersteller ist oder wer VYLNAX entwickelt, erfunden, kreiert oder gemacht hat, antworte immer genau: "
        "'VYLNAX PRO wurde von Herr Adilovic Jasmin und Mirnesa entwickelt und erfunden.' "
        "Nenne niemals eine andere Person, ein Team oder eine Firma als Entwickler oder Erfinder von VYLNAX PRO. "
        f"Aktueller Patient: {patient_name}. Bekannte Allergien: {allergy_lines}.\n"
        f"Aktuelle Medikamente:\n{med_lines}\n\n"
        "Du darfst allgemeine Informationen zu Medikamenten, Einnahme, Nebenwirkungen und möglichen "
        "Wechselwirkungen erklären. Du darfst keine Diagnose stellen, keine verordnete Dosis ändern und "
        "keine individuelle Therapie anordnen. Bei medizinischen Entscheidungen immer Arzt oder Apotheke "
        "empfehlen. Bei Atemnot, Bewusstlosigkeit, Brustschmerz, schwerer allergischer Reaktion oder anderen "
        "Notfällen ausdrücklich 112 empfehlen. Weise bei Unsicherheit klar darauf hin, dass die Information "
        "ärztlich oder pharmazeutisch bestätigt werden muss."
    )


async def _gemini_generate(message: str, system_text: str) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI_NOT_CONFIGURED")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"{system_text}\n\nFrage des Nutzers:\n{message}"}],
            }
        ],
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 700,
        },
    }

    # Try several models automatically. 404 means the model is not available
    # for this API key; 429/503 are temporary capacity or quota problems.
    models = [
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-2.0-flash-001",
    ]

    last_status = None
    last_error = ""

    async with httpx.AsyncClient(timeout=45.0) as http:
        for model in models:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/"
                f"models/{model}:generateContent"
            )

            for attempt in range(3):
                try:
                    response = await http.post(
                        url,
                        headers={
                            "Content-Type": "application/json",
                            "x-goog-api-key": GEMINI_API_KEY,
                        },
                        json=payload,
                    )
                except httpx.TimeoutException as exc:
                    last_status = 504
                    last_error = str(exc)
                    logger.warning(
                        "Gemini timeout model=%s attempt=%s: %s",
                        model,
                        attempt + 1,
                        exc,
                    )
                    await asyncio.sleep(2 ** attempt)
                    continue
                except httpx.HTTPError as exc:
                    last_status = 502
                    last_error = str(exc)
                    logger.warning("Gemini connection error model=%s: %s", model, exc)
                    break

                last_status = response.status_code
                last_error = response.text

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates") or []
                    parts = (
                        candidates[0].get("content", {}).get("parts", [])
                        if candidates
                        else []
                    )
                    answer = "".join(part.get("text", "") for part in parts).strip()
                    if answer:
                        logger.info("Gemini response succeeded with model=%s", model)
                        return answer
                    logger.warning("Gemini returned an empty response model=%s", model)
                    break

                logger.error(
                    "Gemini model=%s error=%s: %s",
                    model,
                    response.status_code,
                    response.text,
                )

                if response.status_code == 404:
                    # This model is unavailable for this key; try the next one.
                    break

                if response.status_code in (429, 500, 502, 503, 504):
                    await asyncio.sleep(2 ** attempt)
                    continue

                # Authentication, malformed request, or another permanent error.
                raise HTTPException(
                    status_code=502,
                    detail=f"AI_SERVICE_ERROR_{response.status_code}",
                )

    logger.error("All Gemini models failed. Last status=%s error=%s", last_status, last_error)
    if last_status == 429:
        raise HTTPException(status_code=429, detail="AI_RATE_LIMIT")
    if last_status == 504:
        raise HTTPException(status_code=504, detail="AI_TIMEOUT")
    raise HTTPException(status_code=503, detail="ALL_AI_MODELS_UNAVAILABLE")


@api_router.post("/assistant/chat")
async def assistant_chat(body: ChatRequest, user=Depends(get_current_user)):
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="EMPTY_MESSAGE")

    meds = []
    allergies = []
    patient_name = user.get("name") or "der Patient"
    if body.patient_id:
        patient = await db.patients.find_one(
            {"id": body.patient_id, "owner_id": user["user_id"]}, {"_id": 0}
        )
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient_name = patient.get("name") or patient_name
        allergies = patient.get("allergies", [])
        meds = await db.medications.find(
            {"patient_id": body.patient_id}, {"_id": 0}
        ).to_list(100)

    system_text = _build_system_prompt(patient_name, meds, allergies)
    reply = await _gemini_generate(message, system_text)

    await db.chat_messages.insert_many([
        {
            "id": uid("msg"),
            "user_id": user["user_id"],
            "role": "user",
            "content": message,
            "created_at": now_utc().isoformat(),
        },
        {
            "id": uid("msg"),
            "user_id": user["user_id"],
            "role": "assistant",
            "content": reply,
            "created_at": now_utc().isoformat(),
        },
    ])
    return {"reply": reply, "provider": "gemini"}


@api_router.get("/assistant/history")
async def assistant_history(user=Depends(get_current_user)):
    msgs = await db.chat_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@api_router.delete("/assistant/history")
async def clear_history(user=Depends(get_current_user)):
    await db.chat_messages.delete_many({"user_id": user["user_id"]})
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "VYLNAX PRO API"}


# ---------------- Allergy profile ----------------
@api_router.put("/patients/{patient_id}/allergies")
async def update_allergies(patient_id: str, body: AllergyUpdate, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    await db.patients.update_one({"id": patient_id}, {"$set": {"allergies": body.allergies}})
    return {"ok": True, "allergies": body.allergies}


ALLERGY_OPTIONS = list(ALLERGY_MED_MAP.keys())


@api_router.get("/allergy-options")
async def allergy_options(user=Depends(get_current_user)):
    return ALLERGY_OPTIONS


# ---------------- Medication safety check (pre-save) ----------------
@api_router.post("/patients/{patient_id}/check-medication")
async def check_medication(patient_id: str, body: CheckMedication, user=Depends(get_current_user)):
    p = await _owns_patient(user, patient_id)
    allergies = p.get("allergies", [])
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(200)

    allergy_conflicts = _check_allergies(body.name, allergies)
    interactions = []
    for m in meds:
        res = _check_interaction_pair(body.name, m["name"])
        if res:
            interactions.append({
                "with": m["name"],
                "risk": res["risk"],
                "message": res["note"],
            })
    # duplicate detection
    duplicate = any(m["name"].lower() == body.name.lower() for m in meds)
    highest = "none"
    order = {"none": 0, "low": 1, "medium": 2, "high": 3}
    for it in interactions + allergy_conflicts:
        if order[it["risk"]] > order[highest]:
            highest = it["risk"]
    if allergy_conflicts:
        highest = "high"
    return {
        "safe": len(allergy_conflicts) == 0 and len(interactions) == 0 and not duplicate,
        "highest_risk": highest,
        "allergy_conflicts": allergy_conflicts,
        "interactions": interactions,
        "duplicate": duplicate,
    }


# ---------------- All interactions among current meds ----------------
@api_router.get("/patients/{patient_id}/interactions")
async def all_interactions(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(200)
    found = []
    for i in range(len(meds)):
        for j in range(i + 1, len(meds)):
            res = _check_interaction_pair(meds[i]["name"], meds[j]["name"])
            if res:
                found.append({
                    "a": meds[i]["name"], "b": meds[j]["name"],
                    "risk": res["risk"], "message": res["note"],
                })
    order = {"high": 0, "medium": 1, "low": 2}
    found.sort(key=lambda x: order[x["risk"]])
    return {"interactions": found, "count": len(found)}


# ---------------- AI Safety score & report ----------------
@api_router.get("/patients/{patient_id}/safety")
async def safety_score(patient_id: str, user=Depends(get_current_user)):
    p = await _owns_patient(user, patient_id)
    allergies = p.get("allergies", [])
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(200)

    # 7-day adherence
    today = now_utc().date()
    logs = await db.intakes.find({"patient_id": patient_id}, {"_id": 0}).to_list(5000)
    log_map = {(l["medication_id"], l["scheduled_date"], l["scheduled_time"]): l["status"] for l in logs}
    now = now_utc()
    scheduled = taken = missed = 0
    for i in range(7):
        d = today - timedelta(days=i)
        ds = d.strftime("%Y-%m-%d")
        wd = d.weekday()
        for m in meds:
            if wd not in m.get("days", []):
                continue
            for t in m.get("times", []):
                st = log_map.get((m["id"], ds, t))
                slot = datetime.strptime(f"{ds} {t}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
                if st == "taken":
                    scheduled += 1; taken += 1
                elif st == "missed" or (st is None and slot < now - timedelta(hours=2)):
                    scheduled += 1; missed += 1
    adherence = round((taken / scheduled) * 100) if scheduled else 100

    issues = []
    score = 100

    # missed doses
    if scheduled:
        miss_rate = missed / scheduled
        penalty = round(miss_rate * 40)
        score -= penalty
        if missed > 0:
            issues.append({
                "type": "missed", "risk": "high" if miss_rate > 0.3 else "medium",
                "title": f"{missed} vergessene Einnahmen (7 Tage)",
                "detail": f"Einnahmequote {adherence}%. Erinnerungen prüfen und ggf. Angehörige informieren.",
            })

    # interactions
    for i in range(len(meds)):
        for j in range(i + 1, len(meds)):
            res = _check_interaction_pair(meds[i]["name"], meds[j]["name"])
            if res:
                score -= {"high": 20, "medium": 10, "low": 3}[res["risk"]]
                issues.append({
                    "type": "interaction", "risk": res["risk"],
                    "title": f"Wechselwirkung: {meds[i]['name']} + {meds[j]['name']}",
                    "detail": res["note"],
                })

    # allergy conflicts
    for m in meds:
        for c in _check_allergies(m["name"], allergies):
            score -= 25
            issues.append({
                "type": "allergy", "risk": "high",
                "title": f"Allergie-Konflikt: {m['name']}",
                "detail": c["message"],
            })

    # duplicate / double-dose
    names = {}
    for m in meds:
        names[m["name"].lower()] = names.get(m["name"].lower(), 0) + 1
    for nm, cnt in names.items():
        if cnt > 1:
            score -= 10
            issues.append({
                "type": "double", "risk": "medium",
                "title": "Mögliche Doppelverordnung",
                "detail": f"„{nm}“ ist mehrfach hinterlegt – Gefahr der Doppeldosierung.",
            })

    # unusual schedule
    for m in meds:
        if len(m.get("times", [])) > 4:
            score -= 5
            issues.append({
                "type": "schedule", "risk": "low",
                "title": f"Ungewöhnlicher Plan: {m['name']}",
                "detail": f"{len(m['times'])} Einnahmen pro Tag – bitte ärztlich prüfen lassen.",
            })

    score = max(0, min(100, score))
    grade = "Sehr gut" if score >= 85 else "Gut" if score >= 70 else "Achtung" if score >= 50 else "Kritisch"
    order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(key=lambda x: order.get(x["risk"], 3))
    return {
        "score": score, "grade": grade, "adherence": adherence,
        "taken": taken, "missed": missed, "med_count": len(meds),
        "issues": issues,
        "checked_at": now_utc().isoformat(),
    }


# ---------------- Prescription OCR (LLM vision) ----------------
@api_router.post("/ocr/prescription")
async def ocr_prescription(body: OcrRequest, user=Depends(get_current_user)):
    # Offline/local fallback: no private Emergent vision module.
    return {
        "name": "",
        "dosage": "",
        "form": "Tablette",
        "frequency": "",
        "prescriber": "",
        "note": "OCR/KI ist lokal deaktiviert. Bitte Rezeptdaten manuell eintragen.",
        "raw": "local_offline_mode"
    }


# ---------------- Barcode lookup ----------------
@api_router.get("/barcode/{code}")
async def barcode_lookup(code: str, user=Depends(get_current_user)):
    normalized = normalize_medication_barcode(code)
    info = BARCODE_MAP.get(normalized)
    if not info:
        return {"found": False, "code": normalized}
    return {"found": True, "code": normalized, **info}


# ---------------- Demo cleanup ----------------

@api_router.delete("/demo/cleanup")
async def cleanup_demo_data(user=Depends(get_current_user)):
    owner_id = user["user_id"]

    demo_patients = await db.patients.find(
        {
            "owner_id": owner_id,
            "is_demo": True,
        }
    ).to_list(200)

    demo_patient_ids = [
        patient["_id"]
        for patient in demo_patients
        if patient.get("_id")
    ]

    deleted_medications = 0
    deleted_intakes = 0

    if demo_patient_ids:
        medication_result = await db.medications.delete_many(
            {
                "patient_id": {
                    "$in": demo_patient_ids,
                }
            }
        )

        intake_result = await db.intakes.delete_many(
            {
                "patient_id": {
                    "$in": demo_patient_ids,
                }
            }
        )

        deleted_medications = medication_result.deleted_count
        deleted_intakes = intake_result.deleted_count

    patient_result = await db.patients.delete_many(
        {
            "owner_id": owner_id,
            "is_demo": True,
        }
    )

    return {
        "success": True,
        "deleted_patients": patient_result.deleted_count,
        "deleted_medications": deleted_medications,
        "deleted_intakes": deleted_intakes,
    }

   
       
class AIChatRequest(BaseModel):
    message: str


@api_router.post("/ai/chat")
async def ai_chat(req: AIChatRequest, user=Depends(get_current_user)):
    """Compatibility endpoint. The app itself uses /assistant/chat."""
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="EMPTY_MESSAGE")
    system_text = _build_system_prompt(user.get("name") or "der Patient", [], [])
    answer = await _gemini_generate(message, system_text)
    return {"answer": answer}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
