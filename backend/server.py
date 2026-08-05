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
import secrets
import hashlib
import hmac
import httpx
import asyncio
import sqlite3
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date
from zoneinfo import ZoneInfo
# Emergent LLM is private; app runs locally without this package.
LlmChat = UserMessage = ImageContent = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MEDICATION_DB_PATH = ROOT_DIR / "medications_reference.sqlite3"


def _medication_db_connection():
    if not MEDICATION_DB_PATH.exists():
        return None
    connection = sqlite3.connect(f"file:{MEDICATION_DB_PATH}?mode=ro", uri=True, timeout=5)
    connection.row_factory = sqlite3.Row
    return connection


def _fts_query(value: str) -> str:
    tokens = re.findall(r"[0-9A-Za-zÀ-žµ]+", (value or "").strip())
    return " ".join(f'"{token.replace(chr(34), "")}"*' for token in tokens[:6])


def _app_medication_form(form_short: str, form_name: str) -> str:
    value = f"{form_short or ''} {form_name or ''}".lower()
    if "kaps" in value:
        return "Kapsel"
    if "tropf" in value or "lösung" in value or "loesung" in value:
        return "Tropfen"
    if "sprit" in value or "injek" in value or "ampull" in value:
        return "Spritze"
    if "creme" in value or "salbe" in value or "gel" in value:
        return "Creme"
    if "table" in value or "dragee" in value:
        return "Tablette"
    return "Sonstiges"

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
APP_TIMEZONE = os.environ.get("APP_TIMEZONE", "Europe/Berlin")
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
    role: str  # patient | relative | caregiver | doctor | admin


class AccessUserCreate(BaseModel):
    name: str
    role: str  # patient | relative | caregiver | doctor
    pin: str
    source_id: Optional[str] = None
    patient_id: Optional[str] = None
    active: bool = True


class AccessUserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    pin: Optional[str] = None
    patient_id: Optional[str] = None
    active: Optional[bool] = None


class AccessLoginRequest(BaseModel):
    access_user_id: str
    pin: str
    patient_id: Optional[str] = None


class AccessBiometricRequest(BaseModel):
    access_user_id: str
    patient_id: Optional[str] = None
    device_id: str


class BiometricEnrollmentRequest(BaseModel):
    access_user_id: str
    device_id: str
    enabled: bool = True


class ActivePatientRequest(BaseModel):
    patient_id: str


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
    patient_id: str
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
    patient_id: str
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
    patient_id: str
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
    reference_id: Optional[str] = None
    pzn: Optional[str] = None
    active_substances: List[str] = []
    pharmaceutical_form: Optional[str] = None


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
    language: str = "de"
def _normalize_ai_language(value: Optional[str]) -> str:
    language = (value or "de").strip().lower()

    if language in {"bs", "bs-ba", "bosanski", "bosnian"}:
        return "bs"

    if language in {"en", "en-us", "en-gb", "english"}:
        return "en"

    return "de"


def _language_instruction(language: str) -> str:
    if language == "bs":
        return (
            "Odgovaraj isključivo na bosanskom jeziku. "
            "Koristi prirodan bosanski jezik i kratke, jasne rečenice. "
            "Ne odgovaraj na njemačkom osim kada korisnik izričito traži prevod. "
            "Medicinska pravila sigurnosti iz ostatka upute moraju uvijek ostati važeća."
        )

    if language == "en":
        return (
            "Answer exclusively in English. "
            "Use short, clear and natural sentences. "
            "Do not answer in German unless the user explicitly asks for a translation. "
            "All medical safety rules in the rest of the prompt remain mandatory."
        )

    return (
        "Antworte ausschließlich auf Deutsch. "
        "Nutze kurze, klare und natürliche Sätze. "
        "Antworte nur dann in einer anderen Sprache, wenn der Nutzer ausdrücklich um eine Übersetzung bittet. "
        "Alle medizinischen Sicherheitsregeln bleiben verbindlich."
    )

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



ACCESS_ROLES = {"patient", "relative", "caregiver", "doctor"}
WRITE_ROLES = {"caregiver", "doctor"}
ADMIN_ROLES = {"admin"}


def _validate_pin(pin: str):
    if not re.fullmatch(r"\d{4,6}", pin or ""):
        raise HTTPException(
            status_code=400,
            detail="PIN must contain 4 to 6 digits",
        )


def _hash_pin(pin: str, salt_hex: Optional[str] = None):
    _validate_pin(pin)
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt,
        210_000,
    )
    return salt.hex(), digest.hex()


def _verify_pin(pin: str, salt_hex: str, digest_hex: str):
    try:
        _, calculated = _hash_pin(pin, salt_hex)
        return hmac.compare_digest(calculated, digest_hex)
    except Exception:
        return False


def _access_permissions(role: str):
    role = (role or "").lower()
    can_write = role in WRITE_ROLES
    return {
        "can_view": role in ACCESS_ROLES or role in ADMIN_ROLES,
        "can_create": can_write,
        "can_update": can_write,
        "can_delete": can_write,
        "can_manage_access": role in ADMIN_ROLES,
    }


def _public_access_user(doc: dict):
    if not doc:
        return None
    result = dict(doc)
    result.pop("_id", None)
    result.pop("pin_hash", None)
    result.pop("pin_salt", None)
    result["permissions"] = _access_permissions(result.get("role", ""))
    return result


DEFAULT_ROLE_PINS = {
    "patient": "0000",
    "doctor": "1111",
    "caregiver": "2222",
    "relative": "3333",
}


async def _ensure_access_user(owner_id: str, name: str, role: str, source_id: str, patient_id: Optional[str]):
    existing = await db.access_users.find_one({
        "owner_id": owner_id,
        "source_id": source_id,
        "role": role,
    }, {"_id": 0})
    if existing:
        return existing
    pin = DEFAULT_ROLE_PINS[role]
    salt, pin_hash = _hash_pin(pin)
    doc = {
        "id": uid("access"),
        "owner_id": owner_id,
        "name": name.strip() or role.title(),
        "role": role,
        "source_id": source_id,
        "patient_id": patient_id,
        "pin_salt": salt,
        "pin_hash": pin_hash,
        "active": True,
        "biometric_devices": [],
        "failed_attempts": 0,
        "locked_until": None,
        "last_login_at": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }
    await db.access_users.insert_one(doc)
    return doc


async def _ensure_demo_profiles(owner_id: str):
    """Create stable first-run demo profiles for an empty or partially configured account.

    The operation is idempotent: it can safely run on every login and will never
    duplicate the Muster patient or Jasmin caregiver.
    """
    # Remove the mistakenly created Jasmin-as-patient login from earlier demo builds.
    # The record is removed only when it has no medication or intake history.
    mistaken_patients = await db.patients.find({
        "owner_id": owner_id,
        "name": "Jasmin Adilović",
    }, {"_id": 0}).to_list(20)
    for mistaken in mistaken_patients:
        mistaken_id = mistaken.get("id")
        has_medication = await db.medications.find_one({"patient_id": mistaken_id})
        has_intake = await db.intakes.find_one({"patient_id": mistaken_id})
        if mistaken_id and not has_medication and not has_intake:
            await db.access_sessions.delete_many({"owner_id": owner_id, "patient_id": mistaken_id})
            await db.access_users.delete_many({
                "owner_id": owner_id,
                "role": "patient",
                "$or": [{"patient_id": mistaken_id}, {"source_id": mistaken_id}],
            })
            await db.patients.delete_one({"owner_id": owner_id, "id": mistaken_id})

    patient = await db.patients.find_one({
        "owner_id": owner_id,
        "demo_key": "muster-patient",
    }, {"_id": 0})
    if not patient:
        patient_id = uid("pat")
        patient = {
            "id": patient_id,
            "owner_id": owner_id,
            "name": "Max Mustermann",
            "first_name": "Max",
            "last_name": "Mustermann",
            "birth_date": "1948-05-12",
            "gender": "männlich",
            "age": 78,
            "care_grade": "Pflegegrad 2",
            "room": "Musterzimmer 1",
            "notes": "Musterpatient für die VYLNAX-PRO-Demonstration",
            "is_self": False,
            "demo_key": "muster-patient",
            "created_at": now_utc().isoformat(),
            "updated_at": now_utc().isoformat(),
        }
        await db.patients.insert_one(dict(patient))
    patient_id = patient["id"]
    await _ensure_access_user(owner_id, "Max Mustermann", "patient", patient_id, patient_id)

    caregiver = await db.caregivers.find_one({
        "owner_id": owner_id,
        "demo_key": "jasmin-primary-caregiver",
    }, {"_id": 0})
    if not caregiver:
        caregiver_id = uid("care")
        caregiver = {
            "id": caregiver_id,
            "owner_id": owner_id,
            "patient_id": patient_id,
            "first_name": "Jasmin",
            "last_name": "Adilović",
            "professional_role": "Zuständige Pflegefachkraft",
            "work_area": "Ambulante Pflege",
            "organization": "VYLNAX PRO Demo",
            "is_primary_caregiver": True,
            "available_for_emergency": True,
            "notes": "Primär zuständige PFK für den Musterpatienten",
            "demo_key": "jasmin-primary-caregiver",
            "created_at": now_utc().isoformat(),
            "updated_at": now_utc().isoformat(),
        }
        await db.caregivers.insert_one(dict(caregiver))
    else:
        caregiver_id = caregiver["id"]
        if caregiver.get("patient_id") != patient_id:
            await db.caregivers.update_one(
                {"id": caregiver_id, "owner_id": owner_id},
                {"$set": {"patient_id": patient_id, "updated_at": now_utc().isoformat()}},
            )
    await _ensure_access_user(owner_id, "Jasmin Adilović", "caregiver", caregiver_id, patient_id)
    return {"patient_id": patient_id, "caregiver_id": caregiver_id}


async def _write_audit_log(
    owner_id: str,
    action: str,
    access_user: Optional[dict] = None,
    patient_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict] = None,
):
    doc = {
        "id": uid("audit"),
        "owner_id": owner_id,
        "patient_id": patient_id,
        "access_user_id": access_user.get("id") if access_user else None,
        "access_user_name": access_user.get("name") if access_user else None,
        "access_role": access_user.get("role") if access_user else "owner",
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "created_at": now_utc().isoformat(),
    }
    await db.audit_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def get_current_access_session(
    user=Depends(get_current_user),
    x_access_token: Optional[str] = Header(None, alias="X-Access-Token"),
):
    if not x_access_token:
        raise HTTPException(
            status_code=401,
            detail="Access profile login required",
        )

    session = await db.access_sessions.find_one(
        {
            "access_token": x_access_token,
            "owner_id": user["user_id"],
        },
        {"_id": 0},
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid access session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now_utc():
        await db.access_sessions.delete_one({"access_token": x_access_token})
        raise HTTPException(status_code=401, detail="Access session expired")

    access_user = await db.access_users.find_one(
        {
            "id": session["access_user_id"],
            "owner_id": user["user_id"],
            "active": True,
        },
        {"_id": 0},
    )
    if not access_user:
        raise HTTPException(status_code=401, detail="Access user not found or inactive")

    return {
        "owner": user,
        "session": session,
        "access_user": access_user,
        "patient_id": session.get("patient_id"),
    }


async def require_write_access(
    access=Depends(get_current_access_session),
):
    role = access["access_user"].get("role")
    if role not in WRITE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Read-only access. Only caregiver or doctor may change data.",
        )
    return access


async def _assert_access_patient(access: dict, patient_id: str):
    active_patient_id = access.get("patient_id")
    assigned_patient_id = access["access_user"].get("patient_id")

    if active_patient_id and active_patient_id != patient_id:
        raise HTTPException(
            status_code=403,
            detail="This access session is connected to another patient",
        )
    if assigned_patient_id and assigned_patient_id != patient_id:
        raise HTTPException(
            status_code=403,
            detail="This access profile is not assigned to this patient",
        )


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
        # Auto-create a self patient and PIN access profile for new user
        self_patient_id = uid("pat")
        await db.patients.insert_one({
            "id": self_patient_id,
            "owner_id": user_id,
            "name": data.get("name", "Ich"),
            "age": None, "room": None, "notes": "Eigenes Profil",
            "is_self": True,
            "created_at": now_utc().isoformat(),
        })
        await _ensure_access_user(
            user_id, data.get("name", "Ich"), "patient", self_patient_id, self_patient_id
        )

    session_token = data["session_token"]
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    # Repair older installations: every stored person gets a PIN login profile.
    old_patients = await db.patients.find({"owner_id": user_id}, {"_id": 0}).to_list(500)
    for patient in old_patients:
        await _ensure_access_user(user_id, patient.get("name", "Patient"), "patient", patient["id"], patient["id"])
    for collection_name, role in (("relatives", "relative"), ("caregivers", "caregiver"), ("doctors", "doctor")):
        collection = getattr(db, collection_name)
        people = await collection.find({"owner_id": user_id}, {"_id": 0}).to_list(500)
        for person in people:
            name = " ".join(filter(None, [person.get("title"), person.get("first_name"), person.get("last_name")])).strip()
            await _ensure_access_user(user_id, name or role.title(), role, person.get("id"), person.get("patient_id"))

    # Always keep the first-run Muster patient and the assigned Jasmin PFK available.
    await _ensure_demo_profiles(user_id)

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
    if body.role not in ("patient", "relative", "caregiver", "doctor", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": body.role}})
    return {"ok": True, "role": body.role}



@api_router.post("/demo/seed")
async def seed_demo_profiles(user=Depends(get_current_user)):
    ids = await _ensure_demo_profiles(user["user_id"])
    docs = await db.access_users.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: (d.get("role", ""), d.get("name", "")))
    return {"ok": True, **ids, "access_users": [_public_access_user(doc) for doc in docs]}


# ---------------- Access management ----------------
@api_router.get("/access-users")
async def list_access_users(user=Depends(get_current_user)):
    docs = await db.access_users.find(
        {"owner_id": user["user_id"]},
        {"_id": 0},
    ).to_list(500)
    docs.sort(key=lambda d: (d.get("role", ""), d.get("name", "")))
    return [_public_access_user(doc) for doc in docs]


@api_router.post("/access-users")
async def create_access_user(
    body: AccessUserCreate,
    user=Depends(get_current_user),
):
    role = body.role.strip().lower()
    if role not in ACCESS_ROLES:
        raise HTTPException(status_code=400, detail="Invalid access role")

    salt, pin_hash = _hash_pin(body.pin)
    access_user_id = uid("access")

    if body.patient_id:
        await _owns_patient(user, body.patient_id)

    doc = {
        "id": access_user_id,
        "owner_id": user["user_id"],
        "name": body.name.strip(),
        "role": role,
        "source_id": body.source_id,
        "patient_id": body.patient_id,
        "pin_salt": salt,
        "pin_hash": pin_hash,
        "active": body.active,
        "biometric_devices": [],
        "failed_attempts": 0,
        "locked_until": None,
        "last_login_at": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }
    await db.access_users.insert_one(doc)
    await _write_audit_log(
        owner_id=user["user_id"],
        action="access_user_created",
        patient_id=body.patient_id,
        target_type="access_user",
        target_id=access_user_id,
        details={"name": body.name, "role": role},
    )
    return _public_access_user(doc)


@api_router.put("/access-users/{access_user_id}")
async def update_access_user(
    access_user_id: str,
    body: AccessUserUpdate,
    user=Depends(get_current_user),
):
    existing = await db.access_users.find_one(
        {"id": access_user_id, "owner_id": user["user_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Access user not found")

    updates = body.model_dump(exclude_none=True)

    if "role" in updates:
        updates["role"] = updates["role"].strip().lower()
        if updates["role"] not in ACCESS_ROLES:
            raise HTTPException(status_code=400, detail="Invalid access role")

    if "patient_id" in updates and updates["patient_id"]:
        await _owns_patient(user, updates["patient_id"])

    pin = updates.pop("pin", None)
    if pin is not None:
        salt, pin_hash = _hash_pin(pin)
        updates["pin_salt"] = salt
        updates["pin_hash"] = pin_hash
        updates["failed_attempts"] = 0
        updates["locked_until"] = None

    updates["updated_at"] = now_utc().isoformat()

    await db.access_users.update_one(
        {"id": access_user_id, "owner_id": user["user_id"]},
        {"$set": updates},
    )
    updated = await db.access_users.find_one(
        {"id": access_user_id, "owner_id": user["user_id"]},
        {"_id": 0},
    )
    await _write_audit_log(
        owner_id=user["user_id"],
        action="access_user_updated",
        patient_id=updated.get("patient_id"),
        target_type="access_user",
        target_id=access_user_id,
        details={"changed_fields": sorted(updates.keys())},
    )
    return _public_access_user(updated)


@api_router.delete("/access-users/{access_user_id}")
async def delete_access_user(
    access_user_id: str,
    user=Depends(get_current_user),
):
    existing = await db.access_users.find_one(
        {"id": access_user_id, "owner_id": user["user_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Access user not found")

    await db.access_sessions.delete_many(
        {
            "access_user_id": access_user_id,
            "owner_id": user["user_id"],
        }
    )
    await db.access_users.delete_one(
        {
            "id": access_user_id,
            "owner_id": user["user_id"],
        }
    )
    await _write_audit_log(
        owner_id=user["user_id"],
        action="access_user_deleted",
        patient_id=existing.get("patient_id"),
        target_type="access_user",
        target_id=access_user_id,
        details={"name": existing.get("name"), "role": existing.get("role")},
    )
    return {"ok": True}


@api_router.post("/access/login")
async def access_login(
    body: AccessLoginRequest,
    user=Depends(get_current_user),
):
    access_user = await db.access_users.find_one(
        {
            "id": body.access_user_id,
            "owner_id": user["user_id"],
            "active": True,
        },
        {"_id": 0},
    )
    if not access_user:
        raise HTTPException(status_code=404, detail="Access user not found")

    locked_until = access_user.get("locked_until")
    if isinstance(locked_until, str) and locked_until:
        locked_until_dt = datetime.fromisoformat(locked_until)
        if locked_until_dt.tzinfo is None:
            locked_until_dt = locked_until_dt.replace(tzinfo=timezone.utc)
        if locked_until_dt > now_utc():
            raise HTTPException(
                status_code=423,
                detail="Access profile temporarily locked",
            )

    if not _verify_pin(
        body.pin,
        access_user.get("pin_salt", ""),
        access_user.get("pin_hash", ""),
    ):
        attempts = int(access_user.get("failed_attempts", 0)) + 1
        updates = {"failed_attempts": attempts}
        if attempts >= 5:
            updates["locked_until"] = (now_utc() + timedelta(minutes=15)).isoformat()
            updates["failed_attempts"] = 0
        await db.access_users.update_one(
            {"id": access_user["id"]},
            {"$set": updates},
        )
        await _write_audit_log(
            owner_id=user["user_id"],
            action="access_login_failed",
            access_user=access_user,
            patient_id=body.patient_id or access_user.get("patient_id"),
            target_type="access_user",
            target_id=access_user["id"],
        )
        raise HTTPException(status_code=401, detail="Invalid PIN")

    patient_id = body.patient_id or access_user.get("patient_id")
    if patient_id:
        await _owns_patient(user, patient_id)
    if access_user.get("patient_id") and patient_id != access_user.get("patient_id"):
        raise HTTPException(
            status_code=403,
            detail="Access profile is assigned to another patient",
        )

    access_token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(hours=12)

    await db.access_sessions.delete_many(
        {
            "access_user_id": access_user["id"],
            "owner_id": user["user_id"],
        }
    )
    await db.access_sessions.insert_one({
        "id": uid("access_session"),
        "access_token": access_token,
        "owner_id": user["user_id"],
        "access_user_id": access_user["id"],
        "patient_id": patient_id,
        "created_at": now_utc().isoformat(),
        "last_activity_at": now_utc().isoformat(),
        "expires_at": expires_at.isoformat(),
    })
    await db.access_users.update_one(
        {"id": access_user["id"]},
        {
            "$set": {
                "failed_attempts": 0,
                "locked_until": None,
                "last_login_at": now_utc().isoformat(),
            }
        },
    )
    await _write_audit_log(
        owner_id=user["user_id"],
        action="access_login",
        access_user=access_user,
        patient_id=patient_id,
        target_type="access_session",
    )
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat(),
        "patient_id": patient_id,
        "access_user": _public_access_user(access_user),
    }


@api_router.post("/access/logout")
async def access_logout(
    access=Depends(get_current_access_session),
):
    token = access["session"]["access_token"]
    await db.access_sessions.delete_one({"access_token": token})
    await _write_audit_log(
        owner_id=access["owner"]["user_id"],
        action="access_logout",
        access_user=access["access_user"],
        patient_id=access.get("patient_id"),
        target_type="access_session",
        target_id=access["session"].get("id"),
    )
    return {"ok": True}


@api_router.get("/access/me")
async def access_me(
    access=Depends(get_current_access_session),
):
    return {
        "patient_id": access.get("patient_id"),
        "access_user": _public_access_user(access["access_user"]),
        "expires_at": access["session"].get("expires_at"),
    }


@api_router.put("/access/active-patient")
async def set_active_patient(
    body: ActivePatientRequest,
    access=Depends(get_current_access_session),
):
    await _owns_patient(access["owner"], body.patient_id)

    assigned_patient_id = access["access_user"].get("patient_id")
    if assigned_patient_id and assigned_patient_id != body.patient_id:
        raise HTTPException(
            status_code=403,
            detail="Access profile is assigned to another patient",
        )

    await db.access_sessions.update_one(
        {"access_token": access["session"]["access_token"]},
        {
            "$set": {
                "patient_id": body.patient_id,
                "last_activity_at": now_utc().isoformat(),
            }
        },
    )
    await _write_audit_log(
        owner_id=access["owner"]["user_id"],
        action="active_patient_changed",
        access_user=access["access_user"],
        patient_id=body.patient_id,
        target_type="patient",
        target_id=body.patient_id,
    )
    return {"ok": True, "patient_id": body.patient_id}


@api_router.post("/access/biometric")
async def enroll_biometric(
    body: BiometricEnrollmentRequest,
    user=Depends(get_current_user),
):
    access_user = await db.access_users.find_one(
        {
            "id": body.access_user_id,
            "owner_id": user["user_id"],
        },
        {"_id": 0},
    )
    if not access_user:
        raise HTTPException(status_code=404, detail="Access user not found")

    devices = set(access_user.get("biometric_devices", []))
    if body.enabled:
        devices.add(body.device_id)
    else:
        devices.discard(body.device_id)

    await db.access_users.update_one(
        {"id": body.access_user_id, "owner_id": user["user_id"]},
        {
            "$set": {
                "biometric_devices": sorted(devices),
                "updated_at": now_utc().isoformat(),
            }
        },
    )
    return {
        "ok": True,
        "enabled": body.enabled,
        "device_id": body.device_id,
    }


@api_router.post("/access/biometric-login")
async def biometric_login(
    body: AccessBiometricRequest,
    user=Depends(get_current_user),
):
    access_user = await db.access_users.find_one(
        {
            "id": body.access_user_id,
            "owner_id": user["user_id"],
            "active": True,
        },
        {"_id": 0},
    )
    if not access_user:
        raise HTTPException(status_code=404, detail="Access user not found")

    if body.device_id not in access_user.get("biometric_devices", []):
        raise HTTPException(
            status_code=403,
            detail="Biometric login is not enabled for this device",
        )

    patient_id = body.patient_id or access_user.get("patient_id")
    if patient_id:
        await _owns_patient(user, patient_id)

    access_token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(hours=12)
    await db.access_sessions.insert_one({
        "id": uid("access_session"),
        "access_token": access_token,
        "owner_id": user["user_id"],
        "access_user_id": access_user["id"],
        "patient_id": patient_id,
        "created_at": now_utc().isoformat(),
        "last_activity_at": now_utc().isoformat(),
        "expires_at": expires_at.isoformat(),
        "authentication_method": "biometric",
    })
    await _write_audit_log(
        owner_id=user["user_id"],
        action="access_biometric_login",
        access_user=access_user,
        patient_id=patient_id,
        target_type="access_session",
    )
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat(),
        "patient_id": patient_id,
        "access_user": _public_access_user(access_user),
    }


@api_router.get("/audit-log")
async def list_audit_log(
    patient_id: Optional[str] = None,
    limit: int = 200,
    user=Depends(get_current_user),
):
    query = {"owner_id": user["user_id"]}
    if patient_id:
        await _owns_patient(user, patient_id)
        query["patient_id"] = patient_id

    safe_limit = max(1, min(limit, 1000))
    docs = await db.audit_logs.find(
        query,
        {"_id": 0},
    ).sort("created_at", -1).to_list(safe_limit)
    return docs


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

    patient_id = uid("pat")
    doc = {
        "_id": patient_id,
        "id": patient_id,
        "owner_id": user["user_id"],
        **patient_data,
        "is_self": False,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.patients.insert_one(doc)
    await _ensure_access_user(user["user_id"], doc["name"], "patient", patient_id, patient_id)

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
async def list_relatives(
    patient_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    if patient_id:
        await _owns_patient(user, patient_id)

    docs = await db.relatives.find(
        {"owner_id": user["user_id"]},
        {"_id": 0},
    ).to_list(200)

    if patient_id:
        docs = [
            doc for doc in docs
            if not doc.get("patient_id") or doc.get("patient_id") == patient_id
        ]

    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.post("/relatives")
async def add_relative(
    body: RelativeCreate,
    user=Depends(get_current_user),
):
    await _owns_patient(user, body.patient_id)
    relative_data = body.model_dump()

    relative_id = uid("rel")
    doc = {
        "_id": relative_id,
        "id": relative_id,
        "owner_id": user["user_id"],
        **relative_data,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.relatives.insert_one(doc)
    await _ensure_access_user(user["user_id"], f"{body.first_name} {body.last_name}", "relative", relative_id, body.patient_id)
    doc.pop("_id", None)
    return doc


@api_router.delete("/relatives/{relative_id}")
async def delete_relative(
    relative_id: str,
    user=Depends(get_current_user),
):
    result = await db.relatives.delete_one({
        "id": relative_id,
        "owner_id": user["user_id"],
    })

    if result.deleted_count == 0:
        result = await db.relatives.delete_one({
            "_id": relative_id,
            "owner_id": user["user_id"],
        })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Relative not found")

    await db.access_users.delete_many({
        "owner_id": user["user_id"],
        "source_id": relative_id,
        "role": "relative",
    })
    return {"ok": True}


# ---------------- Caregivers ----------------

@api_router.get("/caregivers")
async def list_caregivers(
    patient_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    if patient_id:
        await _owns_patient(user, patient_id)

    docs = await db.caregivers.find(
        {"owner_id": user["user_id"]}
    ).to_list(200)

    normalized_docs = []
    for doc in docs:
        doc["id"] = str(doc.get("id") or doc.get("_id"))
        doc.pop("_id", None)

        if (
            not patient_id
            or not doc.get("patient_id")
            or doc.get("patient_id") == patient_id
        ):
            normalized_docs.append(doc)

    normalized_docs.sort(
        key=lambda d: d.get("created_at", ""),
        reverse=True,
    )
    return normalized_docs


@api_router.post("/caregivers")
async def add_caregiver(
    body: CaregiverCreate,
    user=Depends(get_current_user),
):
    await _owns_patient(user, body.patient_id)
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
    await _ensure_access_user(user["user_id"], f"{body.first_name} {body.last_name}", "caregiver", caregiver_id, body.patient_id)
    doc.pop("_id", None)
    return doc


@api_router.delete("/caregivers/{caregiver_id}")
async def delete_caregiver(
    caregiver_id: str,
    user=Depends(get_current_user),
):
    result = await db.caregivers.delete_one({
        "id": caregiver_id,
        "owner_id": user["user_id"],
    })

    if result.deleted_count == 0:
        result = await db.caregivers.delete_one({
            "_id": caregiver_id,
            "owner_id": user["user_id"],
        })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Caregiver not found")

    await db.access_users.delete_many({
        "owner_id": user["user_id"],
        "source_id": caregiver_id,
        "role": "caregiver",
    })
    return {"ok": True, "deleted_id": caregiver_id}


# ---------------- Doctors ----------------

@api_router.get("/doctors")
async def list_doctors(
    patient_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    if patient_id:
        await _owns_patient(user, patient_id)

    docs = await db.doctors.find(
        {"owner_id": user["user_id"]},
        {"_id": 0},
    ).to_list(200)

    if patient_id:
        docs = [
            doc for doc in docs
            if not doc.get("patient_id") or doc.get("patient_id") == patient_id
        ]

    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.post("/doctors")
async def add_doctor(
    body: DoctorCreate,
    user=Depends(get_current_user),
):
    await _owns_patient(user, body.patient_id)
    doctor_data = body.model_dump()

    doctor_id = uid("doc")
    doc = {
        "_id": doctor_id,
        "id": doctor_id,
        "owner_id": user["user_id"],
        **doctor_data,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }

    await db.doctors.insert_one(doc)
    await _ensure_access_user(user["user_id"], f"{body.title or ''} {body.first_name} {body.last_name}".strip(), "doctor", doctor_id, body.patient_id)
    doc.pop("_id", None)
    return doc


@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(
    doctor_id: str,
    user=Depends(get_current_user),
):
    result = await db.doctors.delete_one({
        "id": doctor_id,
        "owner_id": user["user_id"],
    })

    if result.deleted_count == 0:
        result = await db.doctors.delete_one({
            "_id": doctor_id,
            "owner_id": user["user_id"],
        })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")

    await db.access_users.delete_many({
        "owner_id": user["user_id"],
        "source_id": doctor_id,
        "role": "doctor",
    })
    return {"ok": True}


# ---------------- Medications ----------------
@api_router.get("/patients/{patient_id}/medications")
async def list_meds(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    return await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)


@api_router.post("/patients/{patient_id}/medications")
async def add_med(
    patient_id: str,
    body: MedicationCreate,
    access=Depends(require_write_access),
):
    user = access["owner"]
    await _assert_access_patient(access, patient_id)
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
        "reference_id": body.reference_id,
        "pzn": body.pzn,
        "active_substances": body.active_substances,
        "pharmaceutical_form": body.pharmaceutical_form,
        "created_at": now_utc().isoformat(),
    }
    await db.medications.insert_one(doc)
    doc.pop("_id", None)
    await _write_audit_log(
        owner_id=user["user_id"],
        action="medication_created",
        patient_id=patient_id,
        target_type="medication",
        target_id=doc["id"],
        details={"name": doc["name"], "dosage": doc["dosage"]},
    )
    return doc


@api_router.delete("/medications/{med_id}")
async def delete_med(
    med_id: str,
    user=Depends(get_current_user),
    access=Depends(require_write_access),
):
    med = await db.medications.find_one({"id": med_id}, {"_id": 0})
    if med:
        await _owns_patient(user, med["patient_id"])
        await _assert_access_patient(access, med["patient_id"])
        await db.medications.delete_one({"id": med_id})
        await db.intakes.delete_many({"medication_id": med_id})
        await _write_audit_log(
            owner_id=user["user_id"],
            action="medication_deleted",
            access_user=access["access_user"],
            patient_id=med["patient_id"],
            target_type="medication",
            target_id=med_id,
            details={"name": med.get("name"), "dosage": med.get("dosage")},
        )
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
async def record_intake(
    body: IntakeAction,
    user=Depends(get_current_user),
    access=Depends(require_write_access),
):
    await _owns_patient(user, body.patient_id)
    await _assert_access_patient(access, body.patient_id)
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
    await _write_audit_log(
        owner_id=user["user_id"],
        action="intake_recorded",
        access_user=access["access_user"],
        patient_id=body.patient_id,
        target_type="intake",
        target_id=body.medication_id,
        details={
            "status": body.status,
            "scheduled_date": body.scheduled_date,
            "scheduled_time": body.scheduled_time,
        },
    )
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
async def device_action(
    patient_id: str,
    body: DeviceAction,
    user=Depends(get_current_user),
    access=Depends(require_write_access),
):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
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



# Push models must be declared before FastAPI routes use them.
class PushDeviceRegister(BaseModel):
    token: str
    platform: str = "unknown"
    access_user_id: str
    patient_id: Optional[str] = None
    device_name: Optional[str] = None

class PushDeviceUnregister(BaseModel):
    token: str

class PushPreferencesUpdate(BaseModel):
    sos: bool = True
    medication: bool = True
    vitals: bool = True
    daily_summary: bool = False


async def _send_expo_push(tokens, title, body, data=None):
    tokens = list(dict.fromkeys(t for t in tokens if isinstance(t, str) and t.startswith("ExponentPushToken")))
    if not tokens:
        return {"sent": 0, "tickets": []}
    messages = [{"to": t, "title": title, "body": body, "sound": "default", "channelId": "alerts", "priority": "high", "data": data or {}} for t in tokens]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post("https://exp.host/--/api/v2/push/send", json=messages, headers={"Accept":"application/json","Accept-encoding":"gzip, deflate","Content-Type":"application/json"})
            response.raise_for_status()
            payload = response.json()
            return {"sent": len(tokens), "tickets": payload.get("data", [])}
    except Exception as exc:
        logger.warning("Expo push failed: %s", exc)
        return {"sent": 0, "error": str(exc), "tickets": []}

async def _push_tokens_for_patient(patient_id, event_type, roles=None):
    devices = await db.push_devices.find({"patient_id": patient_id, "active": True}, {"_id": 0}).to_list(500)
    out=[]
    role_set=set(roles or [])
    for d in devices:
        access_user = await db.access_users.find_one({"id": d.get("access_user_id")}, {"_id": 0}) or {}
        if role_set and access_user.get("role") not in role_set:
            continue
        prefs = await db.push_preferences.find_one({"access_user_id": d.get("access_user_id")}, {"_id":0}) or {}
        if prefs.get(event_type, event_type != "daily_summary"):
            out.append(d.get("token"))
    return out

# ---------------- Push notifications ----------------
@api_router.post("/push-devices/register")
async def register_push_device(body: PushDeviceRegister, user=Depends(get_current_user), access=Depends(get_current_access_session)):
    if body.access_user_id != access["access_user"].get("id"):
        raise HTTPException(status_code=403, detail="Falsches Benutzerprofil")
    if body.patient_id:
        await _owns_patient(user, body.patient_id)
        await _assert_access_patient(access, body.patient_id)
    doc={"token":body.token,"user_id":user["user_id"],"access_user_id":body.access_user_id,"patient_id":body.patient_id or access["access_user"].get("patient_id"),"platform":body.platform,"device_name":body.device_name,"active":True,"updated_at":now_utc().isoformat()}
    current=await db.push_devices.find_one({"token":body.token},{"_id":0})
    if current: await db.push_devices.update_one({"token":body.token},{"$set":doc})
    else:
        doc["id"]=uid("push")
        doc["created_at"]=now_utc().isoformat()
        await db.push_devices.insert_one(dict(doc))
    return {"ok":True,"device":doc}

@api_router.post("/push-devices/unregister")
async def unregister_push_device(body: PushDeviceUnregister, user=Depends(get_current_user), access=Depends(get_current_access_session)):
    await db.push_devices.update_one({"token":body.token,"access_user_id":access["access_user"].get("id")},{"$set":{"active":False,"updated_at":now_utc().isoformat()}})
    return {"ok":True}

@api_router.get("/push-devices/me")
async def my_push_devices(user=Depends(get_current_user), access=Depends(get_current_access_session)):
    aid=access["access_user"].get("id")
    devices=await db.push_devices.find({"access_user_id":aid,"active":True},{"_id":0}).to_list(50)
    prefs=await db.push_preferences.find_one({"access_user_id":aid},{"_id":0}) or {"sos":True,"medication":True,"vitals":True,"daily_summary":False}
    return {"devices":devices,"preferences":prefs}

@api_router.put("/push-preferences")
async def update_push_preferences(body: PushPreferencesUpdate, user=Depends(get_current_user), access=Depends(get_current_access_session)):
    aid=access["access_user"].get("id")
    values={**body.model_dump(),"access_user_id":aid,"updated_at":now_utc().isoformat()}
    current=await db.push_preferences.find_one({"access_user_id":aid},{"_id":0})
    if current: await db.push_preferences.update_one({"access_user_id":aid},{"$set":values})
    else:
        values["id"]=uid("pushpref")
        await db.push_preferences.insert_one(dict(values))
    return values

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
    contacts = []
    if body.patient_id:
        contacts = await db.safety_contacts.find({"patient_id": body.patient_id, "receives_sos": True}, {"_id": 0}).to_list(100)
        contacts = sorted(contacts, key=lambda x: int(x.get("priority", 99)))
    doc["delivery"] = [{"contact_id": c.get("id"), "name": c.get("name"), "channel": "phone" if c.get("phone") else "email", "status": "queued"} for c in contacts]
    doc["contact_count"] = len(contacts)
    await db.sos_events.insert_one(dict(doc))
    push_result = {"sent": 0}
    if body.patient_id:
        tokens = await _push_tokens_for_patient(body.patient_id, "sos")
        push_result = await _send_expo_push(tokens, "VYLNAX SOS-Alarm", doc["message"], {"route":"/notifications","patient_id":body.patient_id,"notification_id":doc["id"],"type":"sos"})
    doc["push"] = push_result
    doc.pop("_id", None)
    logger.info(f"SOS triggered by {user['user_id']}")
    return {"ok": True, **doc}


# ---------------- Medication Database ----------------
@api_router.get("/med-database")
async def med_database(
    q: str = "",
    limit: int = 30,
    offset: int = 0,
):
    query = q.strip()

    if len(query) < 2:
        return {
            "items": [],
            "limit": limit,
            "offset": offset,
            "has_more": False,
        }

    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    query = q.strip()
    if len(query) < 2:
        return []

    connection = _medication_db_connection()
    if connection is None:
        ql = query.lower()
        return [m for m in MED_DATABASE if ql in m["name"].lower() or ql in m["category"].lower()][:20]

    try:
        # Exact PZN searches are prioritized; otherwise FTS prefix search covers
        # product names and active substances without loading the full database.
        if query.isdigit():
            rows = connection.execute(
                """
                SELECT m.rmp_key, m.pzn, m.name, m.form_short, m.form_name
                FROM medicinal_products m
                WHERE m.pzn = ? OR m.pzn LIKE ?
                ORDER BY CASE WHEN m.pzn = ? THEN 0 ELSE 1 END, m.name
                LIMIT 20
                """,
                (query.zfill(8), f"{query}%", query.zfill(8)),
            ).fetchall()
        else:
            match = _fts_query(query)
            rows = connection.execute(
                """
                SELECT m.rmp_key, m.pzn, m.name, m.form_short, m.form_name
                FROM medication_fts f
                JOIN medicinal_products m ON m.rmp_key = f.rmp_key
                WHERE medication_fts MATCH ?
                ORDER BY bm25 medication_fts, m.name
                LIMIT 20
                """.replace("bm25 medication_fts", "bm25(medication_fts)"),
                (match,),
            ).fetchall()

        results = []
        for row in rows:
            substance_rows = connection.execute(
                """
                SELECT DISTINCT s.name, s.strength, s.rank
                FROM pharmaceutical_products p
                JOIN substances s ON s.rpp_key = p.rpp_key
                WHERE p.rmp_key = ?
                ORDER BY s.rank, s.name
                """,
                (row["rmp_key"],),
            ).fetchall()
            substances = [
                {"name": item["name"], "strength": item["strength"] or ""}
                for item in substance_rows
            ]
            strengths = list(dict.fromkeys(item["strength"] for item in substances if item["strength"]))
            substance_names = list(dict.fromkeys(item["name"] for item in substances if item["name"]))
            results.append({
                "id": row["rmp_key"],
                "pzn": row["pzn"],
                "name": row["name"],
                "dosage": " + ".join(strengths[:3]),
                "form": _app_medication_form(row["form_short"], row["form_name"]),
                "pharmaceutical_form": row["form_name"] or row["form_short"] or "",
                "category": "Wirkstoff: " + ", ".join(substance_names[:3]) if substance_names else "Referenzarzneimittel",
                "substances": substances,
            })
        return results
    except sqlite3.Error as exc:
        logger.exception("Medication database search failed: %s", exc)
        raise HTTPException(status_code=503, detail="Medication database temporarily unavailable")
    finally:
        connection.close()


# ---------------- AI Medication Assistant ----------------

# ---------------- VYLNAX AI: glasovne radnje i medicinska sigurnost ----------------


def _current_local_datetime_text():
    local_now = datetime.now(ZoneInfo(APP_TIMEZONE))
    weekday_names = [
        "Montag", "Dienstag", "Mittwoch", "Donnerstag",
        "Freitag", "Samstag", "Sonntag"
    ]
    month_names = [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember"
    ]
    return (
        f"{weekday_names[local_now.weekday()]}, der {local_now.day}. "
        f"{month_names[local_now.month - 1]} {local_now.year}, "
        f"{local_now.strftime('%H:%M')} Uhr"
    )


def _is_current_date_question(message: str):
    value = (message or "").strip().lower()
    patterns = (
        "welcher tag ist heute",
        "welches datum ist heute",
        "wie spät ist es",
        "wie spaet ist es",
        "koji je danas dan",
        "koji je datum danas",
        "koliko je sati",
    )
    return any(pattern in value for pattern in patterns)

SAVE_VITALS_INTENT = re.compile(
    r"\b("
    r"speicher(?:e|n)?|dokumentier(?:e|en)?|trag(?:e|en)?\s+ein|"
    r"spremi|sačuvaj|sacuvaj|zapiši|zapisi|unesi|evidentiraj"
    r")\b",
    re.IGNORECASE,
)


def _extract_voice_vitals(message: str):
    """Prepoznaje vitalne vrijednosti iz njemačkih i bosanskih glasovnih naredbi."""
    value = (message or "").strip()
    result = {}

    blood_pressure = re.search(
        r"\b(?:rr|blutdruck|krvni\s+pritisak|pritisak)\s*"
        r"(?:ist|je|beträgt|iznosi|:)?\s*"
        r"(\d{2,3})\s*(?:/|zu|sa|na)\s*(\d{2,3})\b",
        value,
        re.IGNORECASE,
    )
    if blood_pressure:
        result["blood_pressure"] = {
            "systolic": int(blood_pressure.group(1)),
            "diastolic": int(blood_pressure.group(2)),
        }

    pulse = re.search(
        r"\b(?:puls|pulse)\s*(?:ist|je|beträgt|iznosi|:)?\s*(\d{2,3})\b",
        value,
        re.IGNORECASE,
    )
    if pulse:
        result["pulse"] = float(pulse.group(1))

    spo2 = re.search(
        r"\b(?:spo2|sp\s*o\s*2|sauerstoffsättigung|sauerstoff|saturacija)\s*"
        r"(?:ist|je|beträgt|iznosi|:)?\s*(\d{2,3})(?:\s*%)?\b",
        value,
        re.IGNORECASE,
    )
    if spo2:
        result["spo2"] = float(spo2.group(1))

    temperature = re.search(
        r"\b(?:temperatur|temperature|temperatura)\s*"
        r"(?:ist|je|beträgt|iznosi|:)?\s*(\d{2}(?:[.,]\d)?)\b",
        value,
        re.IGNORECASE,
    )
    if temperature:
        result["temperature"] = float(temperature.group(1).replace(",", "."))

    weight = re.search(
        r"\b(?:gewicht|težina|tezina)\s*"
        r"(?:ist|je|beträgt|iznosi|:)?\s*"
        r"(\d{2,3}(?:[.,]\d)?)\s*(?:kg|kilogramm)?\b",
        value,
        re.IGNORECASE,
    )
    if weight:
        result["weight"] = float(weight.group(1).replace(",", "."))

    glucose = re.search(
        r"\b(?:blutzucker|glukose|šećer|secer)\s*"
        r"(?:ist|je|beträgt|iznosi|:)?\s*"
        r"(\d{2,3}(?:[.,]\d)?)\s*(mg\s*/\s*d[lL]|mmol\s*/\s*[lL])?\b",
        value,
        re.IGNORECASE,
    )
    if glucose:
        raw_unit = (glucose.group(2) or "mg/dl").replace(" ", "").lower()
        result["glucose"] = {
            "value": float(glucose.group(1).replace(",", ".")),
            "unit": "mmol/l" if raw_unit.startswith("mmol") else "mg/dl",
        }

    return result


async def _store_ai_vital(
    patient_id: str,
    vital_type: str,
    *,
    value=None,
    systolic=None,
    diastolic=None,
    unit=None,
    source_text: str = "",
):
    """Upisuje vrijednost istim formatom koji koristi ekran Vitalwerte."""
    body = VitalCreate(
        vital_type=vital_type,
        value=value,
        systolic=systolic,
        diastolic=diastolic,
        unit=unit,
        source="voice_ai",
        note=f"Über VYLNAX Sprachassistent dokumentiert: {source_text[:240]}",
        measured_at=now_utc().isoformat(),
    )
    level, alert_message = _vital_alert(body)
    document = {
        "id": uid("vital"),
        "patient_id": patient_id,
        "vital_type": body.vital_type,
        "value": body.value,
        "systolic": body.systolic,
        "diastolic": body.diastolic,
        "unit": body.unit,
        "source": body.source,
        "note": body.note,
        "measured_at": body.measured_at,
        "alert_level": level,
        "alert_message": alert_message,
        "created_at": now_utc().isoformat(),
    }
    await db.vitals.insert_one(dict(document))

    if level != "normal":
        alert_id = uid("alert")
        await db.health_alerts.insert_one({
            "id": alert_id,
            "patient_id": patient_id,
            "type": "vital",
            "level": level,
            "severity": level,
            "message": alert_message,
            "vital_id": document["id"],
            "acknowledged": False,
            "created_at": now_utc().isoformat(),
        })
        tokens = await _push_tokens_for_patient(patient_id, "vitals")
        await _send_expo_push(
            tokens,
            "VYLNAX Vitalwert-Hinweis",
            alert_message or "Auffälliger Vitalwert",
            {
                "route": "/notifications",
                "patient_id": patient_id,
                "notification_id": alert_id,
                "type": "vital",
            },
        )

    await db.habit_events.insert_one({
        "id": uid("habit"),
        "patient_id": patient_id,
        "event_type": f"vital_{vital_type}",
        "value": value,
        "metadata": {"source": "voice_ai"},
        "created_at": now_utc().isoformat(),
    })
    document.pop("_id", None)
    return document


async def _save_voice_vitals(patient_id: str, values: dict, source_text: str):
    saved = []

    if "blood_pressure" in values:
        bp = values["blood_pressure"]
        saved.append(await _store_ai_vital(
            patient_id,
            "blood_pressure",
            systolic=bp["systolic"],
            diastolic=bp["diastolic"],
            unit="mmHg",
            source_text=source_text,
        ))

    if "pulse" in values:
        saved.append(await _store_ai_vital(
            patient_id,
            "pulse",
            value=values["pulse"],
            unit="/min",
            source_text=source_text,
        ))

    if "spo2" in values:
        saved.append(await _store_ai_vital(
            patient_id,
            "spo2",
            value=values["spo2"],
            unit="%",
            source_text=source_text,
        ))

    if "temperature" in values:
        saved.append(await _store_ai_vital(
            patient_id,
            "temperature",
            value=values["temperature"],
            unit="°C",
            source_text=source_text,
        ))

    if "weight" in values:
        saved.append(await _store_ai_vital(
            patient_id,
            "weight",
            value=values["weight"],
            unit="kg",
            source_text=source_text,
        ))

    if "glucose" in values:
        glucose = values["glucose"]
        saved.append(await _store_ai_vital(
            patient_id,
            "glucose",
            value=glucose["value"],
            unit=glucose["unit"],
            source_text=source_text,
        ))

    return saved


def _voice_vitals_confirmation(patient_name: str, values: dict):
    parts = []

    if "blood_pressure" in values:
        bp = values["blood_pressure"]
        parts.append(f"den Blutdruck {bp['systolic']} zu {bp['diastolic']}")

    if "pulse" in values:
        parts.append(f"den Puls {int(values['pulse'])} Schläge pro Minute")

    if "spo2" in values:
        parts.append(f"die Sauerstoffsättigung {int(values['spo2'])} Prozent")

    if "temperature" in values:
        parts.append(
            f"die Temperatur {str(values['temperature']).replace('.', ',')} Grad Celsius"
        )

    if "weight" in values:
        parts.append(
            f"das Gewicht {str(values['weight']).replace('.', ',')} Kilogramm"
        )

    if "glucose" in values:
        glucose = values["glucose"]
        spoken_unit = (
            "Millimol pro Liter"
            if glucose["unit"] == "mmol/l"
            else "Milligramm pro Deziliter"
        )
        parts.append(f"den Blutzucker {glucose['value']:g} {spoken_unit}")

    if not parts:
        return (
            "Ich konnte keine eindeutige Vitalwertangabe erkennen. "
            "Bitte nennen Sie den Wert noch einmal."
        )

    if len(parts) == 1:
        listing = parts[0]
    else:
        listing = ", ".join(parts[:-1]) + " und " + parts[-1]

    return (
        f"Ich habe für {patient_name} {listing} gespeichert. "
        "Die Messung ist jetzt unter Vitalwerte sichtbar. "
        "Das ist eine Dokumentation und keine medizinische Diagnose."
    )


def _build_system_prompt(patient_name, meds, allergies=None):
    med_lines = "\n".join(
        [
            f"- {m['name']} {m['dosage']} ({m['form']}), Zeiten: {', '.join(m.get('times', []))}"
            for m in meds
        ]
    ) or "Noch keine Medikamente hinterlegt."
    allergy_lines = ", ".join(allergies or []) or "keine hinterlegt"

    return (
        "Du bist der digitale VYLNAX Care Assistant. "
        "Sprich warm, ruhig, freundlich und menschlich, niemals kalt oder roboterhaft. "
        "Antworte in der Sprache des Nutzers: Deutsch, Bosnisch, Kroatisch, Serbisch oder Englisch. "
        "Nutze kurze, natürliche Sätze, die sich gut vorlesen lassen. "
        "Verwende keine Tabellen, Sternchen oder unnötigen Abkürzungen. "
        "Schreibe VYLNAX im gesprochenen Fließtext als Vilnaks, damit der Name nicht buchstabiert wird. "
        "Schreibe medizinische Einheiten möglichst ausgeschrieben, zum Beispiel Milligramm pro Deziliter. "
        "Beginne nicht mit einer Selbstvorstellung, außer der Nutzer fragt ausdrücklich danach. "
        "Bei einer Begrüßung antworte kurz und herzlich. "
        "Wenn nach Entwickler, Erfinder, Gründer, Schöpfer oder Ersteller gefragt wird, antworte genau: "
        "'VYLNAX PRO wurde von Herr Adilovic Jasmin und Mirnesa entwickelt und erfunden.' "
        f"Aktuelles Datum und Uhrzeit: {_current_local_datetime_text()}. "
        f"Aktueller Patient: {patient_name}. Bekannte Allergien: {allergy_lines}.\n"
        f"Aktuelle dokumentierte Medikamente:\n{med_lines}\n\n"
        "Verbindliche medizinische Sicherheitsregeln: "
        "Stelle niemals eine Diagnose und behaupte niemals, eine Krankheit sicher erkannt zu haben. "
        "Empfehle niemals ein Medikament zur Einnahme, auch kein rezeptfreies Medikament. "
        "Empfehle niemals, eine Dosis zu erhöhen, zu senken, auszulassen oder eine Therapie zu beginnen, "
        "abzusetzen oder zu pausieren. "
        "Du darfst allgemein erklären, wofür ein Medikament verwendet wird, wie es grundsätzlich wirkt "
        "und welche bekannten Nebenwirkungen oder allgemeinen Wechselwirkungen möglich sind. "
        "Ob ein Medikament für den konkreten Patienten geeignet ist, darfst du nicht entscheiden. "
        "Verweise bei individuellen Therapiefragen auf Arzt oder Apotheke. "
        "Du darfst dokumentierte Vitalwerte und zeitliche Trends sachlich zusammenfassen. "
        "Formuliere dabei ausdrücklich, dass dies keine Diagnose und keine medizinische Entscheidung ersetzt. "
        "Bei Atemnot, Bewusstlosigkeit, Brustschmerz, Schlaganfallzeichen, einer schweren allergischen Reaktion "
        "oder einer anderen akuten Gefahr weise auf den Notruf 112 hin. "
        "Behaupte niemals, Daten gespeichert zu haben. Eine Speicherbestätigung darf ausschließlich "
        "die Anwendung nach einem tatsächlich erfolgreichen Datenbankeintrag geben."
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


def _looks_like_symptom(text: str) -> bool:
    lowered = text.lower()
    markers = [
        "schmerz", "weh", "schwindel", "übel", "erbrechen", "durchfall", "fieber",
        "kopfschmerz", "bauchschmerz", "atemnot", "brustschmerz", "müde", "schwach",
        "boli", "bol", "vrtoglav", "mučnin", "mucnin", "povra", "temperatur",
        "glavobolj", "stomak", "trbuh", "disanje", "prsa", "umor", "slabost",
        "pain", "dizzy", "nausea", "vomit", "fever", "headache", "stomach",
        "shortness of breath", "chest pain", "tired", "weak"
    ]
    return any(marker in lowered for marker in markers)


async def _assistant_patient_context(patient_id: str):
    cutoff = (now_utc() - timedelta(days=30)).isoformat()
    journal = await db.care_journal.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(12)
    vitals = await db.vitals.find({"patient_id": patient_id}, {"_id": 0}).sort("measured_at", -1).to_list(12)
    habits = await db.habit_events.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    habits = [h for h in habits if h.get("created_at", "") >= cutoff]
    memories = await db.ai_memories.find({"patient_id": patient_id, "active": True}, {"_id": 0}).sort("updated_at", -1).to_list(20)

    journal_lines = [f"- {j.get('created_at','')[:10]} [{j.get('category','Beobachtung')}]: {j.get('text','')[:240]}" for j in journal]
    vital_lines = []
    for v in vitals:
        if v.get("vital_type") == "blood_pressure":
            value = f"{v.get('systolic')}/{v.get('diastolic')} mmHg"
        else:
            value = f"{v.get('value')} {v.get('unit') or ''}".strip()
        vital_lines.append(f"- {v.get('measured_at','')[:16]} {v.get('vital_type')}: {value} ({v.get('alert_level','normal')})")
    memory_lines = [f"- {m.get('label')}: {m.get('value')}" for m in memories]

    hours = {}
    for event in habits:
        try:
            hour = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00")).hour
            hours[hour] = hours.get(hour, 0) + 1
        except Exception:
            pass
    peak = max(hours, key=hours.get) if hours else None
    habit_text = f"Häufigste dokumentierte Aktivitätszeit: {peak:02d}:00 Uhr." if peak is not None else "Noch kein belastbares Aktivitätsmuster."
    return {
        "prompt": "\n".join([
            "Langzeit-Merkpunkte des Patienten:", *(memory_lines or ["- Noch keine bestätigten Merkpunkte."]),
            "Letzte dokumentierte Beobachtungen/Symptome:", *(journal_lines or ["- Keine Einträge vorhanden."]),
            "Letzte Vitalwerte:", *(vital_lines or ["- Keine Messwerte vorhanden."]),
            f"Gewohnheitsmuster: {habit_text}",
            "Nutze diese Informationen nur als Kontext. Behaupte nicht, dass ein Zusammenhang medizinisch bewiesen ist."
        ]),
        "memories": memories,
        "recent_journal": journal[:5],
        "recent_vitals": vitals[:5],
        "habit_summary": habit_text,
    }


@api_router.post("/assistant/chat")
async def assistant_chat(body: ChatRequest, user=Depends(get_current_user)):
    message = body.message.strip()
message = body.message.strip()
language = _normalize_ai_language(body.language)
    if not message:
        raise HTTPException(status_code=400, detail="EMPTY_MESSAGE")

    meds = []
    allergies = []
    patient_name = user.get("name") or "den Patienten"
    patient_context = None
    patient = None

    if body.patient_id:
        patient = await db.patients.find_one(
            {"id": body.patient_id, "owner_id": user["user_id"]},
            {"_id": 0},
        )
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        patient_name = patient.get("name") or patient_name
        allergies = patient.get("allergies", [])
        meds = await db.medications.find(
            {"patient_id": body.patient_id},
            {"_id": 0},
        ).to_list(100)
        patient_context = await _assistant_patient_context(body.patient_id)

    if _is_current_date_question(message):
    current_datetime = _current_local_datetime_text()

    if language == "bs":
        reply = f"Danas je {current_datetime}."
    elif language == "en":
        reply = f"Today is {current_datetime}."
    else:
        reply = f"Heute ist {current_datetime}."
        common = {
            "user_id": user["user_id"],
            "patient_id": body.patient_id,
        }
        await db.chat_messages.insert_many([
            {
                "id": uid("msg"),
                **common,
                "role": "user",
                "content": message,
                "created_at": now_utc().isoformat(),
            },
            {
                "id": uid("msg"),
                **common,
                "role": "assistant",
                "content": reply,
                "created_at": now_utc().isoformat(),
            },
        ])
        return {
            "reply": reply,
            "provider": "local_action",
            "action": "current_datetime",
            "suggest_journal": False,
            "source_text": None,
        }

    extracted_vitals = _extract_voice_vitals(message)
    wants_to_save = bool(SAVE_VITALS_INTENT.search(message))

    if wants_to_save and extracted_vitals:
        if not body.patient_id or not patient:
            reply = (
                "Bitte wählen Sie zuerst einen Patienten aus. "
                "Ohne aktiven Patienten kann ich die Messwerte nicht sicher speichern."
            )
            return {
                "reply": reply,
                "provider": "local_action",
                "action": "vitals_not_saved",
                "saved_vitals": [],
                "suggest_journal": False,
                "source_text": None,
            }

        saved_vitals = await _save_voice_vitals(
            body.patient_id,
            extracted_vitals,
            message,
        )
        reply = _voice_vitals_confirmation(patient_name, extracted_vitals)

        common = {
            "user_id": user["user_id"],
            "patient_id": body.patient_id,
        }
        await db.chat_messages.insert_many([
            {
                "id": uid("msg"),
                **common,
                "role": "user",
                "content": message,
                "created_at": now_utc().isoformat(),
            },
            {
                "id": uid("msg"),
                **common,
                "role": "assistant",
                "content": reply,
                "created_at": now_utc().isoformat(),
                "action": "vitals_saved",
            },
        ])

        return {
            "reply": reply,
            "provider": "local_action",
            "action": "vitals_saved",
            "saved_vitals": saved_vitals,
            "suggest_journal": False,
            "source_text": None,
        }
system_text = _build_system_prompt(patient_name, meds, allergies)

system_text = (
    _language_instruction(language)
    + "\n\n"
    + system_text
)

if patient_context:
    system_text += "\n\n" + patient_context["prompt"]

reply = await _gemini_generate(message, system_text)
    suggest_journal = bool(
        body.patient_id and _looks_like_symptom(message)
    )

    common = {
        "user_id": user["user_id"],
        "patient_id": body.patient_id,
    }
    await db.chat_messages.insert_many([
        {
            "id": uid("msg"),
            **common,
            "role": "user",
            "content": message,
            "created_at": now_utc().isoformat(),
        },
        {
            "id": uid("msg"),
            **common,
            "role": "assistant",
            "content": reply,
            "created_at": now_utc().isoformat(),
            "suggest_journal": suggest_journal,
            "source_text": message if suggest_journal else None,
        },
    ])

    if body.patient_id:
        await db.habit_events.insert_one({
            "id": uid("habit"),
            "patient_id": body.patient_id,
            "event_type": "ai_conversation",
            "metadata": {"symptom_candidate": suggest_journal},
            "created_at": now_utc().isoformat(),
        })

    return {
        "reply": reply,
        "provider": "gemini",
        "suggest_journal": suggest_journal,
        "source_text": message if suggest_journal else None,
    }


@api_router.get("/assistant/history")
async def assistant_history(patient_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if patient_id:
        await _owns_patient(user, patient_id)
        query["patient_id"] = patient_id
    msgs = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@api_router.delete("/assistant/history")
async def clear_history(patient_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if patient_id:
        await _owns_patient(user, patient_id)
        query["patient_id"] = patient_id
    await db.chat_messages.delete_many(query)
    return {"ok": True}


class AIMemoryUpsert(BaseModel):
    label: str
    value: str


@api_router.get("/patients/{patient_id}/assistant-context")
async def assistant_context(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    return await _assistant_patient_context(patient_id)


@api_router.post("/patients/{patient_id}/assistant-memory")
async def save_assistant_memory(patient_id: str, body: AIMemoryUpsert, user=Depends(get_current_user), access=Depends(require_write_access)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    label = body.label.strip()
    value = body.value.strip()
    if not label or not value:
        raise HTTPException(status_code=400, detail="LABEL_AND_VALUE_REQUIRED")
    now = now_utc().isoformat()
    doc = {"id": uid("memory"), "patient_id": patient_id, "label": label, "value": value, "active": True, "updated_at": now, "created_at": now}
    existing = await db.ai_memories.find_one({"patient_id": patient_id, "label": label}, {"_id": 0})
    if existing:
        doc["id"] = existing.get("id", doc["id"])
        doc["created_at"] = existing.get("created_at", now)
    await db.ai_memories.update_one({"patient_id": patient_id, "label": label}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/")
async def root():
    return {"message": "VYLNAX PRO API"}


# ---------------- Allergy profile ----------------
@api_router.put("/patients/{patient_id}/allergies")
async def update_allergies(
    patient_id: str,
    body: AllergyUpdate,
    user=Depends(get_current_user),
    access=Depends(require_write_access),
):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    await db.patients.update_one(
        {"id": patient_id},
        {"$set": {"allergies": body.allergies, "updated_at": now_utc().isoformat()}},
    )
    await _write_audit_log(
        owner_id=user["user_id"],
        action="allergies_updated",
        access_user=access["access_user"],
        patient_id=patient_id,
        target_type="patient",
        target_id=patient_id,
        details={"allergies": body.allergies},
    )
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
    if info:
        return {"found": True, "code": normalized, **info}

    connection = _medication_db_connection()
    if connection is None:
        return {"found": False, "code": normalized}
    try:
        row = connection.execute(
            "SELECT rmp_key, pzn, name, form_short, form_name FROM medicinal_products WHERE pzn = ? LIMIT 1",
            (normalized,),
        ).fetchone()
        if not row:
            return {"found": False, "code": normalized}
        substance_rows = connection.execute(
            """
            SELECT DISTINCT s.name, s.strength, s.rank
            FROM pharmaceutical_products p
            JOIN substances s ON s.rpp_key = p.rpp_key
            WHERE p.rmp_key = ? ORDER BY s.rank, s.name
            """,
            (row["rmp_key"],),
        ).fetchall()
        strengths = list(dict.fromkeys(r["strength"] for r in substance_rows if r["strength"]))
        return {
            "found": True,
            "code": normalized,
            "pzn": row["pzn"],
            "name": row["name"],
            "dosage": " + ".join(strengths[:3]),
            "form": _app_medication_form(row["form_short"], row["form_name"]),
            "pharmaceutical_form": row["form_name"] or row["form_short"] or "",
        }
    finally:
        connection.close()


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




# ---------------- Vitals, alerts & care journal ----------------
class VitalCreate(BaseModel):
    vital_type: str  # blood_pressure | pulse | spo2 | temperature | weight | steps
    value: Optional[float] = None
    systolic: Optional[int] = None
    diastolic: Optional[int] = None
    unit: Optional[str] = None
    source: str = "manual"
    note: Optional[str] = None
    measured_at: Optional[str] = None

class JournalCreate(BaseModel):
    category: str = "observation"
    text: str
    mood: Optional[str] = None
    tags: List[str] = []

def _vital_alert(body: VitalCreate):
    t = body.vital_type
    level = "normal"
    message = None
    if t == "blood_pressure" and body.systolic is not None and body.diastolic is not None:
        if body.systolic >= 180 or body.diastolic >= 120:
            level, message = "critical", "Sehr hoher Blutdruck – medizinisch abklären."
        elif body.systolic >= 140 or body.diastolic >= 90:
            level, message = "warning", "Blutdruck liegt über dem Zielbereich."
        elif body.systolic < 90 or body.diastolic < 60:
            level, message = "warning", "Blutdruck ist niedrig."
    elif t == "pulse" and body.value is not None:
        if body.value < 40 or body.value > 130:
            level, message = "critical", "Puls liegt deutlich außerhalb des üblichen Bereichs."
        elif body.value < 50 or body.value > 100:
            level, message = "warning", "Puls liegt außerhalb des üblichen Ruhebereichs."
    elif t == "spo2" and body.value is not None:
        if body.value < 90:
            level, message = "critical", "Sauerstoffsättigung ist sehr niedrig."
        elif body.value < 94:
            level, message = "warning", "Sauerstoffsättigung ist erniedrigt."
    elif t == "temperature" and body.value is not None:
        if body.value >= 39.0:
            level, message = "critical", "Hohes Fieber gemessen."
        elif body.value >= 38.0:
            level, message = "warning", "Erhöhte Körpertemperatur gemessen."
    return level, message

@api_router.post("/patients/{patient_id}/vitals")
async def create_vital(patient_id: str, body: VitalCreate, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    level, message = _vital_alert(body)
    doc = {
        "id": uid("vital"), "patient_id": patient_id, "vital_type": body.vital_type,
        "value": body.value, "systolic": body.systolic, "diastolic": body.diastolic,
        "unit": body.unit, "source": body.source, "note": body.note,
        "measured_at": body.measured_at or now_utc().isoformat(),
        "alert_level": level, "alert_message": message, "created_at": now_utc().isoformat(),
    }
    await db.vitals.insert_one(dict(doc))
    if level != "normal":
        alert_id = uid("alert")
        await db.health_alerts.insert_one({
            "id": alert_id, "patient_id": patient_id, "type": "vital",
            "level": level, "severity": level, "message": message, "vital_id": doc["id"],
            "acknowledged": False, "created_at": now_utc().isoformat(),
        })
        tokens = await _push_tokens_for_patient(patient_id, "vitals")
        await _send_expo_push(tokens, "VYLNAX Vitalwert-Hinweis", message or "Auffälliger Vitalwert", {"route":"/notifications","patient_id":patient_id,"notification_id":alert_id,"type":"vital"})
    await db.habit_events.insert_one({"id": uid("habit"), "patient_id": patient_id, "event_type": f"vital_{body.vital_type}", "value": body.value, "metadata": {"source": body.source}, "created_at": now_utc().isoformat()})
    return doc

@api_router.get("/patients/{patient_id}/vitals")
async def list_vitals(patient_id: str, vital_type: Optional[str] = None, limit: int = 100, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    query = {"patient_id": patient_id}
    if vital_type: query["vital_type"] = vital_type
    rows = await db.vitals.find(query, {"_id": 0}).sort("measured_at", -1).to_list(max(1, min(limit, 500)))
    return rows

@api_router.get("/patients/{patient_id}/health-summary")
async def health_summary(patient_id: str, days: int = 7, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    cutoff = (now_utc() - timedelta(days=max(1, min(days, 90)))).isoformat()
    rows = await db.vitals.find({"patient_id": patient_id}, {"_id": 0}).to_list(5000)
    rows = [r for r in rows if r.get("measured_at", "") >= cutoff]
    latest, grouped = {}, {}
    for r in sorted(rows, key=lambda x: x.get("measured_at", "")):
        latest[r.get("vital_type", "other")] = r
        grouped.setdefault(r.get("vital_type", "other"), []).append(r)
    insights = []
    for typ, vals in grouped.items():
        nums = [v.get("value") for v in vals if isinstance(v.get("value"), (int, float))]
        if len(nums) >= 2:
            delta = nums[-1] - nums[0]
            if abs(delta) >= (5 if typ in ("pulse", "weight") else 2):
                direction = "gestiegen" if delta > 0 else "gesunken"
                insights.append(f"{typ}: im Zeitraum um {abs(delta):.1f} {direction}.")
    alerts = await db.health_alerts.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"days": days, "latest": latest, "measurements": len(rows), "alerts": alerts, "insights": insights or ["Noch nicht genügend Messwerte für eine Trendanalyse."]}

@api_router.post("/patients/{patient_id}/journal")
async def create_journal(patient_id: str, body: JournalCreate, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    if not body.text.strip(): raise HTTPException(status_code=400, detail="Text fehlt")
    doc = {"id": uid("journal"), "patient_id": patient_id, "category": body.category, "text": body.text.strip(), "mood": body.mood, "tags": body.tags, "author": user.get("name"), "created_at": now_utc().isoformat()}
    await db.care_journal.insert_one(dict(doc))
    await db.habit_events.insert_one({"id": uid("habit"), "patient_id": patient_id, "event_type": "journal_entry", "metadata": {"category": body.category}, "created_at": now_utc().isoformat()})
    return doc

@api_router.get("/patients/{patient_id}/journal")
async def list_journal(patient_id: str, limit: int = 100, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    return await db.care_journal.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))

# ---------------- Connected devices & habit learning ----------------
class DevicePairRequest(BaseModel):
    device_type: str
    method: str
    name: Optional[str] = None
    hardware_id: Optional[str] = None

class HabitEventRequest(BaseModel):
    event_type: str
    value: Optional[float] = None
    metadata: dict = {}

@api_router.post("/patients/{patient_id}/devices/pair")
async def pair_patient_device(patient_id: str, body: DevicePairRequest, user=Depends(get_current_user), access=Depends(require_write_access)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    if body.device_type not in ("dispenser", "band") or body.method not in ("wifi", "bluetooth", "qr"):
        raise HTTPException(status_code=400, detail="Ungültiges Gerät oder Verbindungsmethode")
    device_id = body.hardware_id or f"{body.device_type}-{uuid.uuid4().hex[:8]}"
    doc = {
        "id": device_id, "patient_id": patient_id, "device_type": body.device_type,
        "name": body.name or ("VYLNAX PRO" if body.device_type == "dispenser" else "VYLNAX Band"),
        "method": body.method, "connected": True, "paired_at": now_utc().isoformat(),
        "last_sync": now_utc().isoformat(), "wifi_configured": body.method == "wifi",
        "bluetooth_configured": body.method == "bluetooth",
    }
    await db.paired_devices.update_one({"id": device_id}, {"$set": doc}, upsert=True)
    return doc

@api_router.get("/patients/{patient_id}/devices")
async def patient_devices(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    return await db.paired_devices.find({"patient_id": patient_id}, {"_id": 0}).to_list(20)

@api_router.post("/patients/{patient_id}/habits/events")
async def record_habit_event(patient_id: str, body: HabitEventRequest, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    doc = {"id": str(uuid.uuid4()), "patient_id": patient_id, "event_type": body.event_type,
           "value": body.value, "metadata": body.metadata, "created_at": now_utc().isoformat()}
    await db.habit_events.insert_one(dict(doc))
    return {"ok": True, **doc}

@api_router.get("/patients/{patient_id}/habits/summary")
async def habit_summary(patient_id: str, days: int = 30, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    days = max(1, min(days, 90))
    cutoff = (now_utc() - timedelta(days=days)).isoformat()
    events = await db.habit_events.find({"patient_id": patient_id}, {"_id": 0}).to_list(10000)
    events = [e for e in events if e.get("created_at", "") >= cutoff]
    by_type = {}
    hours = {}
    for e in events:
        t=e.get("event_type", "other"); by_type[t]=by_type.get(t,0)+1
        try:
            h=datetime.fromisoformat(e["created_at"].replace("Z", "+00:00")).hour
            hours[h]=hours.get(h,0)+1
        except Exception: pass
    peak_hour=max(hours, key=hours.get) if hours else None
    return {"days": days, "total_events": len(events), "by_type": by_type, "most_active_hour": peak_hour,
            "insights": [
                "VYLNAX lernt bevorzugte Einnahmezeiten aus bestätigten Einnahmen." if events else "Noch nicht genügend Daten zum Erkennen von Gewohnheiten.",
                f"Häufigste Aktivitätszeit: {peak_hour:02d}:00 Uhr." if peak_hour is not None else "Aktivitätsmuster wird nach mehreren Tagen sichtbar."
            ]}


# ---------------- Smart medication reminders & escalation ----------------
class ReminderSettingsUpdate(BaseModel):
    enabled: bool = True
    first_reminder_minutes: int = 5
    second_reminder_minutes: int = 15
    notify_relative_minutes: int = 30
    notify_caregiver_minutes: int = 60
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"
    voice_enabled: bool = True

@api_router.get("/patients/{patient_id}/reminder-settings")
async def get_reminder_settings(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    row = await db.reminder_settings.find_one({"patient_id": patient_id}, {"_id": 0})
    return row or {
        "patient_id": patient_id, "enabled": True, "first_reminder_minutes": 5,
        "second_reminder_minutes": 15, "notify_relative_minutes": 30,
        "notify_caregiver_minutes": 60, "quiet_hours_start": "22:00",
        "quiet_hours_end": "07:00", "voice_enabled": True,
    }

@api_router.put("/patients/{patient_id}/reminder-settings")
async def update_reminder_settings(patient_id: str, body: ReminderSettingsUpdate, user=Depends(get_current_user), access=Depends(require_write_access)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    values = body.model_dump()
    for key in ("first_reminder_minutes", "second_reminder_minutes", "notify_relative_minutes", "notify_caregiver_minutes"):
        values[key] = max(0, min(int(values[key]), 1440))
    doc = {"patient_id": patient_id, **values, "updated_at": now_utc().isoformat(), "updated_by": access["access_user"].get("name")}
    await db.reminder_settings.update_one({"patient_id": patient_id}, {"$set": doc}, upsert=True)
    return doc

@api_router.get("/patients/{patient_id}/reminder-center")
async def reminder_center(patient_id: str, date_str: Optional[str] = None, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    ds = date_str or now_utc().strftime("%Y-%m-%d")
    settings = await db.reminder_settings.find_one({"patient_id": patient_id}, {"_id": 0}) or {
        "enabled": True, "first_reminder_minutes": 5, "second_reminder_minutes": 15,
        "notify_relative_minutes": 30, "notify_caregiver_minutes": 60,
        "voice_enabled": True,
    }
    d = datetime.strptime(ds, "%Y-%m-%d").date()
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)
    logs = await db.intakes.find({"patient_id": patient_id, "scheduled_date": ds}, {"_id": 0}).to_list(1000)
    log_map = {(x["medication_id"], x["scheduled_time"]): x for x in logs}
    now = now_utc()
    alerts=[]
    counts={"pending":0,"taken":0,"missed":0,"escalated":0}
    for med in meds:
        if d.weekday() not in med.get("days",[]): continue
        for tm in med.get("times",[]):
            log=log_map.get((med["id"],tm))
            if log and log.get("status")=="taken":
                counts["taken"]+=1; continue
            slot=datetime.strptime(f"{ds} {tm}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            delay=max(0,int((now-slot).total_seconds()//60))
            if log and log.get("status")=="missed": delay=max(delay, int(settings.get("notify_relative_minutes",30)))
            if now < slot:
                counts["pending"]+=1; continue
            stage="due"; recipient="patient"; message=f"{med['name']} {med.get('dosage','')} ist fällig."
            if delay >= int(settings.get("notify_caregiver_minutes",60)):
                stage="caregiver"; recipient="caregiver"; counts["escalated"]+=1
                message=f"PFK-Hinweis: {med['name']} wurde seit {delay} Minuten nicht bestätigt."
            elif delay >= int(settings.get("notify_relative_minutes",30)):
                stage="relative"; recipient="relative"; counts["escalated"]+=1
                message=f"Angehörigen-Hinweis: {med['name']} wurde seit {delay} Minuten nicht bestätigt."
            elif delay >= int(settings.get("second_reminder_minutes",15)):
                stage="second"; message=f"Zweite Erinnerung: Bitte {med['name']} einnehmen."
            elif delay >= int(settings.get("first_reminder_minutes",5)):
                stage="first"; message=f"Erinnerung: Bitte {med['name']} einnehmen."
            counts["missed"]+=1
            alerts.append({"id":f"{med['id']}-{tm}","medication_id":med["id"],"name":med["name"],"dosage":med.get("dosage"),"scheduled_time":tm,"delay_minutes":delay,"stage":stage,"recipient":recipient,"message":message})
    alerts.sort(key=lambda x:x["delay_minutes"], reverse=True)
    return {"date":ds,"settings":settings,"counts":counts,"alerts":alerts}

@api_router.post("/patients/{patient_id}/reminder-events/{reminder_id}/acknowledge")
async def acknowledge_reminder(patient_id: str, reminder_id: str, user=Depends(get_current_user), access=Depends(get_current_access_session)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    doc={"id":uid("remack"),"patient_id":patient_id,"reminder_id":reminder_id,"acknowledged_by":access["access_user"].get("name"),"role":access["access_user"].get("role"),"created_at":now_utc().isoformat()}
    await db.reminder_acknowledgements.insert_one(dict(doc))
    return doc


# ---------------- Phase 3: safety contacts, notification inbox & daily care summary ----------------
class SafetyContactCreate(BaseModel):
    name: str
    relation: str = "Angehörige"
    phone: Optional[str] = None
    email: Optional[str] = None
    priority: int = 1
    receives_sos: bool = True
    receives_medication_alerts: bool = True

class SafetyContactUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    priority: Optional[int] = None
    receives_sos: Optional[bool] = None
    receives_medication_alerts: Optional[bool] = None

class NotificationAcknowledge(BaseModel):
    note: Optional[str] = None

class PushDeviceRegister(BaseModel):
    token: str
    platform: str = "unknown"
    access_user_id: str
    patient_id: Optional[str] = None
    device_name: Optional[str] = None

class PushDeviceUnregister(BaseModel):
    token: str

class PushPreferencesUpdate(BaseModel):
    sos: bool = True
    medication: bool = True
    vitals: bool = True
    daily_summary: bool = False

@api_router.get("/patients/{patient_id}/safety-contacts")
async def list_safety_contacts(patient_id: str, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    rows = await db.safety_contacts.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    return sorted(rows, key=lambda x: (int(x.get("priority", 99)), x.get("name", "")))

@api_router.post("/patients/{patient_id}/safety-contacts")
async def create_safety_contact(patient_id: str, body: SafetyContactCreate, user=Depends(get_current_user), access=Depends(require_write_access)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name fehlt")
    if not (body.phone or body.email):
        raise HTTPException(status_code=400, detail="Telefon oder E-Mail erforderlich")
    doc = {
        "id": uid("contact"), "patient_id": patient_id, "name": body.name.strip(),
        "relation": body.relation.strip() or "Angehörige", "phone": body.phone, "email": body.email,
        "priority": max(1, min(int(body.priority), 9)), "receives_sos": body.receives_sos,
        "receives_medication_alerts": body.receives_medication_alerts,
        "created_at": now_utc().isoformat(), "created_by": access["access_user"].get("name"),
    }
    await db.safety_contacts.insert_one(dict(doc))
    return doc

@api_router.put("/patients/{patient_id}/safety-contacts/{contact_id}")
async def update_safety_contact(patient_id: str, contact_id: str, body: SafetyContactUpdate, user=Depends(get_current_user), access=Depends(require_write_access)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    current = await db.safety_contacts.find_one({"id": contact_id, "patient_id": patient_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Kontakt nicht gefunden")
    values = {k: v for k, v in body.model_dump().items() if v is not None}
    if "priority" in values:
        values["priority"] = max(1, min(int(values["priority"]), 9))
    values["updated_at"] = now_utc().isoformat()
    await db.safety_contacts.update_one({"id": contact_id, "patient_id": patient_id}, {"$set": values})
    return {**current, **values}

@api_router.delete("/patients/{patient_id}/safety-contacts/{contact_id}")
async def delete_safety_contact(patient_id: str, contact_id: str, user=Depends(get_current_user), access=Depends(require_write_access)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    result = await db.safety_contacts.delete_one({"id": contact_id, "patient_id": patient_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Kontakt nicht gefunden")
    return {"ok": True}

async def _generated_notification_rows(patient_id: str, user):
    rows = []
    # Persistent SOS alarms
    sos_rows = await db.sos_events.find({"patient_id": patient_id}, {"_id": 0}).to_list(200)
    for e in sos_rows:
        rows.append({
            "id": e["id"], "patient_id": patient_id, "type": "sos", "severity": "critical",
            "title": "SOS-Alarm", "message": e.get("message") or "Notruf ausgelöst",
            "created_at": e.get("created_at"), "acknowledged_at": e.get("acknowledged_at"),
            "acknowledged_by": e.get("acknowledged_by"), "source": "sos",
        })
    # Persisted vital alerts
    alerts = await db.health_alerts.find({"patient_id": patient_id}, {"_id": 0}).to_list(300)
    for a in alerts:
        rows.append({
            "id": a["id"], "patient_id": patient_id, "type": "vital", "severity": a.get("severity", "warning"),
            "title": "Vitalwert-Hinweis", "message": a.get("message", "Auffälliger Vitalwert"),
            "created_at": a.get("created_at"), "acknowledged_at": a.get("acknowledged_at"),
            "acknowledged_by": a.get("acknowledged_by"), "source": "health_alerts",
        })
    # Current medication escalation snapshot
    try:
        center = await reminder_center(patient_id, None, user)
        for a in center.get("alerts", []):
            if a.get("stage") not in ("relative", "caregiver"):
                continue
            rows.append({
                "id": f"med-{a['id']}", "patient_id": patient_id, "type": "medication",
                "severity": "critical" if a.get("stage") == "caregiver" else "warning",
                "title": "Medikament nicht bestätigt", "message": a.get("message"),
                "created_at": now_utc().isoformat(), "acknowledged_at": None,
                "recipient": a.get("recipient"), "source": "generated",
            })
    except Exception:
        pass
    return sorted(rows, key=lambda x: x.get("created_at") or "", reverse=True)

@api_router.get("/patients/{patient_id}/notifications")
async def patient_notifications(patient_id: str, include_acknowledged: bool = True, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    rows = await _generated_notification_rows(patient_id, user)
    if not include_acknowledged:
        rows = [x for x in rows if not x.get("acknowledged_at")]
    return {"items": rows[:300], "unread": sum(1 for x in rows if not x.get("acknowledged_at"))}

@api_router.post("/patients/{patient_id}/notifications/{notification_id}/acknowledge")
async def acknowledge_notification(patient_id: str, notification_id: str, body: NotificationAcknowledge, user=Depends(get_current_user), access=Depends(get_current_access_session)):
    await _owns_patient(user, patient_id)
    await _assert_access_patient(access, patient_id)
    who = access["access_user"].get("name")
    stamp = now_utc().isoformat()
    updated = False
    for collection in (db.sos_events, db.health_alerts):
        row = await collection.find_one({"id": notification_id, "patient_id": patient_id}, {"_id": 0})
        if row:
            await collection.update_one({"id": notification_id, "patient_id": patient_id}, {"$set": {"acknowledged_at": stamp, "acknowledged_by": who, "acknowledgement_note": body.note}})
            updated = True
            break
    if not updated and notification_id.startswith("med-"):
        await db.reminder_acknowledgements.insert_one({"id": uid("remack"), "patient_id": patient_id, "reminder_id": notification_id[4:], "acknowledged_by": who, "role": access["access_user"].get("role"), "created_at": stamp, "note": body.note})
        updated = True
    if not updated:
        raise HTTPException(status_code=404, detail="Hinweis nicht gefunden")
    return {"ok": True, "acknowledged_at": stamp, "acknowledged_by": who}

@api_router.get("/patients/{patient_id}/daily-summary")
async def daily_patient_summary(patient_id: str, date_str: Optional[str] = None, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    ds = date_str or now_utc().strftime("%Y-%m-%d")
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0}) or {"name": "Patient"}
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)
    logs = await db.intakes.find({"patient_id": patient_id, "scheduled_date": ds}, {"_id": 0}).to_list(1000)
    taken = sum(1 for x in logs if x.get("status") == "taken")
    missed = sum(1 for x in logs if x.get("status") == "missed")
    scheduled = 0
    try:
        d = datetime.strptime(ds, "%Y-%m-%d").date()
        scheduled = sum(len(m.get("times", [])) for m in meds if d.weekday() in m.get("days", []))
    except Exception:
        scheduled = len(logs)
    start = f"{ds}T00:00:00"
    end = f"{ds}T23:59:59"
    vitals = await db.vitals.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    vitals = [v for v in vitals if start <= (v.get("measured_at") or v.get("created_at") or "") <= end]
    journal = await db.care_journal.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    journal = [j for j in journal if start <= (j.get("created_at") or "") <= end]
    sos_rows = await db.sos_events.find({"patient_id": patient_id}, {"_id": 0}).to_list(200)
    sos_count = sum(1 for e in sos_rows if start <= (e.get("created_at") or "") <= end)
    alerts = await db.health_alerts.find({"patient_id": patient_id}, {"_id": 0}).to_list(300)
    alerts = [a for a in alerts if start <= (a.get("created_at") or "") <= end]
    adherence = round((taken / scheduled) * 100) if scheduled else 100
    highlights = []
    if missed: highlights.append(f"{missed} Einnahme(n) wurden als verpasst dokumentiert.")
    if alerts: highlights.append(f"{len(alerts)} auffällige Vitalwert-Meldung(en) wurden erkannt.")
    if sos_count: highlights.append(f"{sos_count} SOS-Ereignis(se) wurden ausgelöst.")
    if journal: highlights.append(f"{len(journal)} Eintrag/Einträge im Patiententagebuch.")
    if not highlights: highlights.append("Keine kritischen Ereignisse dokumentiert.")
    narrative = f"Tagesübersicht für {patient.get('name')} am {ds}: {taken} von {scheduled} geplanten Einnahmen bestätigt ({adherence} %). {len(vitals)} Vitalmessungen und {len(journal)} Tagebucheinträge wurden erfasst."
    return {
        "date": ds, "patient_name": patient.get("name"), "medication": {"scheduled": scheduled, "taken": taken, "missed": missed, "adherence_percent": adherence},
        "vitals_count": len(vitals), "journal_count": len(journal), "health_alerts": len(alerts), "sos_events": sos_count,
        "highlights": highlights, "summary": narrative,
        "disclaimer": "Automatisch erstellte Übersicht. Sie ersetzt keine medizinische Beurteilung.",
    }


# ---------------- Phase 5: scheduled medication and daily-summary delivery ----------------
def _local_now():
    try:
        return datetime.now(ZoneInfo(APP_TIMEZONE))
    except Exception:
        return now_utc()

def _cron_authorized(x_cron_secret: Optional[str]):
    if not CRON_SECRET:
        raise HTTPException(status_code=503, detail="CRON_SECRET ist nicht konfiguriert")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, CRON_SECRET):
        raise HTTPException(status_code=403, detail="Ungültiger Cron-Schlüssel")

async def _record_delivery(patient_id: str, event_type: str, event_key: str, title: str, body: str, roles, result: dict):
    doc={
        "id":uid("delivery"), "patient_id":patient_id, "event_type":event_type, "event_key":event_key,
        "title":title, "body":body, "roles":list(roles or []), "result":result,
        "created_at":now_utc().isoformat(),
    }
    await db.notification_deliveries.insert_one(dict(doc))
    doc.pop("_id",None)
    return doc

async def _delivery_already_sent(patient_id: str, event_key: str):
    return await db.notification_deliveries.find_one({"patient_id":patient_id,"event_key":event_key},{"_id":0})

async def _process_patient_reminders(patient: dict, local_now: datetime):
    patient_id=patient.get("id")
    ds=local_now.strftime("%Y-%m-%d")
    settings=await db.reminder_settings.find_one({"patient_id":patient_id},{"_id":0}) or {
        "enabled":True,"first_reminder_minutes":5,"second_reminder_minutes":15,
        "notify_relative_minutes":30,"notify_caregiver_minutes":60,
    }
    if not settings.get("enabled",True):
        return {"patient_id":patient_id,"checked":0,"sent":0,"skipped":0}
    meds=await db.medications.find({"patient_id":patient_id},{"_id":0}).to_list(500)
    logs=await db.intakes.find({"patient_id":patient_id,"scheduled_date":ds},{"_id":0}).to_list(1000)
    log_map={(x.get("medication_id"),x.get("scheduled_time")):x for x in logs}
    sent=skipped=checked=0
    weekday=local_now.date().weekday()
    stage_config=[
        ("caregiver",int(settings.get("notify_caregiver_minutes",60)),["caregiver","doctor"],"PFK-Hinweis"),
        ("relative",int(settings.get("notify_relative_minutes",30)),["relative"],"Angehörigen-Hinweis"),
        ("second",int(settings.get("second_reminder_minutes",15)),["patient"],"Zweite Erinnerung"),
        ("first",int(settings.get("first_reminder_minutes",5)),["patient"],"Medikamentenerinnerung"),
    ]
    for med in meds:
        if weekday not in med.get("days",[]):
            continue
        for tm in med.get("times",[]):
            checked+=1
            log=log_map.get((med.get("id"),tm))
            if log and log.get("status")=="taken":
                continue
            try:
                hour,minute=[int(x) for x in tm.split(":")[:2]]
                slot=local_now.replace(hour=hour,minute=minute,second=0,microsecond=0)
            except Exception:
                continue
            delay=int((local_now-slot).total_seconds()//60)
            if delay < 0:
                continue
            chosen=None
            for stage,threshold,roles,label in stage_config:
                if delay>=threshold:
                    chosen=(stage,roles,label)
                    break
            if not chosen:
                continue
            stage,roles,label=chosen
            reminder_id=f"{med.get('id')}-{tm}"
            event_key=f"med:{ds}:{reminder_id}:{stage}"
            if await _delivery_already_sent(patient_id,event_key):
                skipped+=1
                continue
            name=med.get("name","Medikament")
            dosage=med.get("dosage") or ""
            if stage=="caregiver": body=f"{name} {dosage} wurde seit {delay} Minuten nicht bestätigt.".strip()
            elif stage=="relative": body=f"{name} {dosage} wurde seit {delay} Minuten nicht bestätigt.".strip()
            else: body=f"Bitte {name} {dosage} jetzt einnehmen und in VYLNAX bestätigen.".strip()
            tokens=await _push_tokens_for_patient(patient_id,"medication",roles)
            result=await _send_expo_push(tokens,label,body,{"route":"/reminders","patient_id":patient_id,"type":"medication","reminder_id":reminder_id,"stage":stage})
            await _record_delivery(patient_id,"medication",event_key,label,body,roles,result)
            sent+=int(result.get("sent",0)>0)
    return {"patient_id":patient_id,"checked":checked,"sent":sent,"skipped":skipped}

async def _process_daily_summary(patient: dict, local_now: datetime):
    patient_id=patient.get("id")
    # One summary per day after 19:00 local time.
    if local_now.hour < 19:
        return {"patient_id":patient_id,"sent":0,"reason":"before_19"}
    ds=local_now.strftime("%Y-%m-%d")
    event_key=f"daily:{ds}"
    if await _delivery_already_sent(patient_id,event_key):
        return {"patient_id":patient_id,"sent":0,"reason":"already_sent"}
    # Reuse the same calculation as the API without requiring an HTTP session.
    meds=await db.medications.find({"patient_id":patient_id},{"_id":0}).to_list(500)
    logs=await db.intakes.find({"patient_id":patient_id,"scheduled_date":ds},{"_id":0}).to_list(1000)
    taken=sum(1 for x in logs if x.get("status")=="taken")
    scheduled=sum(len(m.get("times",[])) for m in meds if local_now.date().weekday() in m.get("days",[]))
    adherence=round((taken/scheduled)*100) if scheduled else 100
    title="VYLNAX Tagesübersicht"
    body=f"{patient.get('name','Patient')}: {taken} von {scheduled} Einnahmen bestätigt ({adherence} %)."
    roles=["relative","caregiver","doctor"]
    tokens=await _push_tokens_for_patient(patient_id,"daily_summary",roles)
    result=await _send_expo_push(tokens,title,body,{"route":"/daily-summary","patient_id":patient_id,"type":"daily_summary","date":ds})
    await _record_delivery(patient_id,"daily_summary",event_key,title,body,roles,result)
    return {"patient_id":patient_id,"sent":int(result.get("sent",0)>0),"scheduled":scheduled,"taken":taken}

async def _run_scheduled_jobs():
    local_now=_local_now()
    patients=await db.patients.find({}, {"_id":0}).to_list(5000)
    reminder_results=[]
    summary_results=[]
    for patient in patients:
        reminder_results.append(await _process_patient_reminders(patient,local_now))
        summary_results.append(await _process_daily_summary(patient,local_now))
    run={
        "id":uid("cronrun"),"started_at":now_utc().isoformat(),"local_time":local_now.isoformat(),
        "timezone":APP_TIMEZONE,"patients":len(patients),"reminders":reminder_results,"daily_summaries":summary_results,
    }
    run["finished_at"]=now_utc().isoformat()
    await db.scheduler_runs.insert_one(dict(run))
    run.pop("_id",None)
    return run

@api_router.post("/automation/run")
async def run_automation(x_cron_secret: Optional[str]=Header(default=None,alias="X-Cron-Secret")):
    _cron_authorized(x_cron_secret)
    return await _run_scheduled_jobs()

@api_router.post("/automation/run-manual")
async def run_automation_manual(user=Depends(get_current_user), access=Depends(require_write_access)):
    return await _run_scheduled_jobs()

@api_router.get("/automation/status")
async def automation_status(user=Depends(get_current_user), access=Depends(require_write_access)):
    runs=await db.scheduler_runs.find({}, {"_id":0}).sort("started_at",-1).to_list(20)
    deliveries=await db.notification_deliveries.find({}, {"_id":0}).sort("created_at",-1).to_list(100)
    return {"configured":bool(CRON_SECRET),"timezone":APP_TIMEZONE,"runs":runs,"deliveries":deliveries}



# ---------------- Phase 6: weekly AI-style risk and trend report ----------------
@api_router.get("/patients/{patient_id}/weekly-intelligence")
async def weekly_intelligence(patient_id: str, days: int = 7, user=Depends(get_current_user)):
    await _owns_patient(user, patient_id)
    days=max(7,min(days,30)); today=now_utc().date(); start=today-timedelta(days=days-1)
    meds=await db.medications.find({"patient_id":patient_id},{"_id":0}).to_list(500)
    logs=await db.intakes.find({"patient_id":patient_id},{"_id":0}).to_list(10000)
    log_map={(x.get("medication_id"),x.get("scheduled_date"),x.get("scheduled_time")):x.get("status") for x in logs}
    total=taken=missed=0; missed_by_hour={}; daily=[]
    for i in range(days):
        d=start+timedelta(days=i); ds=d.isoformat(); dtot=dtak=dmis=0
        for m in meds:
            if d.weekday() not in m.get("days",[]): continue
            for tm in m.get("times",[]):
                dtot+=1; st=log_map.get((m.get("id"),ds,tm))
                if st=="taken": dtak+=1
                elif st=="missed" or datetime.strptime(f"{ds} {tm}","%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)<now_utc()-timedelta(hours=2):
                    dmis+=1; missed_by_hour[tm[:2]]=missed_by_hour.get(tm[:2],0)+1
        total+=dtot; taken+=dtak; missed+=dmis
        daily.append({"date":ds,"scheduled":dtot,"taken":dtak,"missed":dmis,"adherence":round(dtak/max(1,dtak+dmis)*100)})
    adherence=round(taken/max(1,taken+missed)*100)
    vitals=await db.vitals.find({"patient_id":patient_id},{"_id":0}).to_list(5000)
    cutoff=datetime.combine(start,datetime.min.time(),tzinfo=timezone.utc).isoformat()
    vitals=[v for v in vitals if (v.get("measured_at") or v.get("created_at") or "")>=cutoff]
    alert_count=sum(1 for v in vitals if v.get("alert_level") in ("warning","critical"))
    journal=await db.care_journal.find({"patient_id":patient_id},{"_id":0}).to_list(2000)
    journal=[j for j in journal if (j.get("created_at") or "")>=cutoff]
    risk=0; reasons=[]
    if adherence<80: risk+=35; reasons.append("Einnahmequote unter 80 %.")
    elif adherence<90: risk+=18; reasons.append("Einnahmequote unter 90 %.")
    if missed>=3: risk+=25; reasons.append(f"{missed} wahrscheinlich versäumte Einnahmen.")
    if alert_count: risk+=min(25,alert_count*7); reasons.append(f"{alert_count} auffällige Vitalmessungen.")
    if not vitals: risk+=8; reasons.append("Keine Vitalmessungen im Zeitraum.")
    risk=min(100,risk); level="hoch" if risk>=60 else "mittel" if risk>=30 else "niedrig"
    peak=max(missed_by_hour,key=missed_by_hour.get) if missed_by_hour else None
    recommendations=[]
    if peak: recommendations.append(f"Erinnerung rund um {peak}:00 Uhr verstärken.")
    if adherence<90: recommendations.append("Einnahmeplan mit Patient und Bezugsperson prüfen.")
    if alert_count: recommendations.append("Auffällige Vitalwerte fachlich bewerten lassen.")
    if not recommendations: recommendations.append("Aktuellen Plan fortführen und Trends weiter beobachten.")
    narrative=f"In den letzten {days} Tagen wurden {taken} von {taken+missed} bewertbaren Einnahmen bestätigt ({adherence} %). Das berechnete Unterstützungsrisiko ist {level}."
    return {"days":days,"adherence":adherence,"taken":taken,"missed":missed,"risk_score":risk,"risk_level":level,"reasons":reasons or ["Keine deutlichen Risikosignale erkannt."],"recommendations":recommendations,"daily":daily,"vitals_count":len(vitals),"vital_alerts":alert_count,"journal_count":len(journal),"narrative":narrative,"disclaimer":"Automatische Orientierungshilfe, keine Diagnose oder medizinische Entscheidung."}


# ---------------- Phase 7: multi-patient care cockpit ----------------
@api_router.get("/care-dashboard")
async def care_dashboard(days: int = 7, user=Depends(get_current_user), access=Depends(get_current_access_session)):
    if access.get("role") not in ("caregiver", "doctor"):
        raise HTTPException(status_code=403, detail="Nur für PFK und Ärzte verfügbar")
    days=max(7,min(days,30))
    patients=await db.patients.find({"owner_id":user["user_id"]},{"_id":0}).to_list(500)
    rows=[]
    for patient in patients:
        report=await weekly_intelligence(patient["id"],days,user)
        priority=(3 if report["risk_level"]=="hoch" else 2 if report["risk_level"]=="mittel" else 1)
        rows.append({
            "patient": patient,
            "risk_score": report["risk_score"],
            "risk_level": report["risk_level"],
            "adherence": report["adherence"],
            "missed": report["missed"],
            "vital_alerts": report["vital_alerts"],
            "vitals_count": report["vitals_count"],
            "journal_count": report["journal_count"],
            "narrative": report["narrative"],
            "reasons": report["reasons"],
            "recommendations": report["recommendations"],
            "priority": priority,
        })
    rows.sort(key=lambda x:(-x["priority"],-x["risk_score"],x["patient"].get("name","").lower()))
    return {
        "days":days,
        "generated_at":now_utc().isoformat(),
        "total_patients":len(rows),
        "high_risk":sum(1 for x in rows if x["risk_level"]=="hoch"),
        "medium_risk":sum(1 for x in rows if x["risk_level"]=="mittel"),
        "low_risk":sum(1 for x in rows if x["risk_level"]=="niedrig"),
        "average_adherence":round(sum(x["adherence"] for x in rows)/max(1,len(rows))),
        "patients":rows,
        "disclaimer":"Priorisierungshilfe für Fachpersonal, keine Diagnose oder automatische medizinische Entscheidung."
    }

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
    await db.access_users.create_index("id", unique=True)
    await db.access_users.create_index("owner_id")
    await db.access_sessions.create_index("access_token", unique=True)
    await db.access_sessions.create_index("owner_id")
    await db.access_sessions.create_index("access_user_id")
    await db.audit_logs.create_index("owner_id")
    await db.audit_logs.create_index("patient_id")
    await db.audit_logs.create_index("created_at")


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)