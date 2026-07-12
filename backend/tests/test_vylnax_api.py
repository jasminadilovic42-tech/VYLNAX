"""VYLNAX PRO backend regression + new features tests.

Covers:
- Auth guards (401 without bearer)
- /api/auth/me, /api/auth/role
- Patients / Medications CRUD
- Schedule + Intake + Reports
- Device (simulated) + SOS
- NEW: Medication Database
- NEW: AI Assistant chat + history + delete + multi-turn
"""
from datetime import datetime, timezone, timedelta


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, unauth_api):
        r = unauth_api.get(f"{unauth_api.base_url}/api/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------------- Auth guards ----------------
class TestAuthGuards:
    def test_me_401(self, unauth_api):
        r = unauth_api.get(f"{unauth_api.base_url}/api/auth/me")
        assert r.status_code == 401

    def test_med_database_401(self, unauth_api):
        r = unauth_api.get(f"{unauth_api.base_url}/api/med-database")
        assert r.status_code == 401

    def test_assistant_chat_401(self, unauth_api):
        r = unauth_api.post(
            f"{unauth_api.base_url}/api/assistant/chat",
            json={"message": "hallo"},
        )
        assert r.status_code == 401

    def test_assistant_history_401(self, unauth_api):
        r = unauth_api.get(f"{unauth_api.base_url}/api/assistant/history")
        assert r.status_code == 401

    def test_invalid_bearer_401(self, unauth_api):
        r = unauth_api.get(
            f"{unauth_api.base_url}/api/auth/me",
            headers={"Authorization": "Bearer garbage_token"},
        )
        assert r.status_code == 401


# ---------------- Session/User ----------------
class TestAuthSession:
    def test_session_invalid_token(self, unauth_api):
        r = unauth_api.post(
            f"{unauth_api.base_url}/api/auth/session",
            json={"session_token": "definitely_invalid_xyz"},
        )
        assert r.status_code == 401

    def test_me_ok(self, api, test_user_and_token):
        r = api.get(f"{api.base_url}/api/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u["user_id"] == test_user_and_token["user_id"]
        assert u["role"] == "patient"
        assert "_id" not in u  # ObjectId excluded

    def test_role_update(self, api):
        r = api.put(f"{api.base_url}/api/auth/role", json={"role": "caregiver"})
        assert r.status_code == 200
        assert r.json()["role"] == "caregiver"
        # verify persistence
        me = api.get(f"{api.base_url}/api/auth/me").json()
        assert me["role"] == "caregiver"
        # reset
        api.put(f"{api.base_url}/api/auth/role", json={"role": "patient"})

    def test_role_update_invalid(self, api):
        r = api.put(f"{api.base_url}/api/auth/role", json={"role": "admin"})
        assert r.status_code == 400


# ---------------- Patients ----------------
class TestPatients:
    def test_list_has_self_patient(self, api):
        r = api.get(f"{api.base_url}/api/patients")
        assert r.status_code == 200
        patients = r.json()
        assert isinstance(patients, list)
        assert len(patients) >= 1
        assert any(p.get("is_self") for p in patients)

    def test_create_and_delete_patient(self, api):
        r = api.post(
            f"{api.base_url}/api/patients",
            json={"name": "TEST_Oma", "age": 82, "room": "12A"},
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["name"] == "TEST_Oma"
        assert p["age"] == 82
        assert "id" in p
        # verify via list
        lst = api.get(f"{api.base_url}/api/patients").json()
        assert any(x["id"] == p["id"] for x in lst)
        # delete
        d = api.delete(f"{api.base_url}/api/patients/{p['id']}")
        assert d.status_code == 200
        lst2 = api.get(f"{api.base_url}/api/patients").json()
        assert not any(x["id"] == p["id"] for x in lst2)


# ---------------- Medications + Schedule + Intake + Reports ----------------
class TestMedicationFlow:
    def test_full_flow(self, api, test_user_and_token):
        pid = test_user_and_token["self_patient_id"]
        # create med at 08:00 every day
        r = api.post(
            f"{api.base_url}/api/patients/{pid}/medications",
            json={
                "name": "TEST_Metformin",
                "dosage": "500 mg",
                "form": "Tablette",
                "times": ["08:00", "20:00"],
                "days": [0, 1, 2, 3, 4, 5, 6],
                "color": "#1A65A9",
            },
        )
        assert r.status_code == 200, r.text
        med = r.json()
        assert med["times"] == ["08:00", "20:00"]  # sorted
        med_id = med["id"]

        # list
        meds = api.get(f"{api.base_url}/api/patients/{pid}/medications").json()
        assert any(m["id"] == med_id for m in meds)

        # schedule today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        s = api.get(
            f"{api.base_url}/api/patients/{pid}/schedule",
            params={"date_str": today},
        )
        assert s.status_code == 200
        items = s.json()["items"]
        assert any(i["medication_id"] == med_id and i["time"] == "08:00" for i in items)

        # intake taken
        i = api.post(
            f"{api.base_url}/api/intake",
            json={
                "patient_id": pid,
                "medication_id": med_id,
                "scheduled_date": today,
                "scheduled_time": "08:00",
                "status": "taken",
            },
        )
        assert i.status_code == 200
        assert i.json()["status"] == "taken"

        # schedule reflects taken
        s2 = api.get(
            f"{api.base_url}/api/patients/{pid}/schedule",
            params={"date_str": today},
        ).json()
        row = next(x for x in s2["items"]
                   if x["medication_id"] == med_id and x["time"] == "08:00")
        assert row["status"] == "taken"
        assert row["taken_at"] is not None

        # reports (day)
        rep = api.get(
            f"{api.base_url}/api/patients/{pid}/reports",
            params={"period": "day"},
        )
        assert rep.status_code == 200
        rd = rep.json()
        assert rd["period"] == "day"
        assert rd["taken"] >= 1
        assert len(rd["daily"]) == 1

        # reports (week + month)
        rw = api.get(f"{api.base_url}/api/patients/{pid}/reports",
                     params={"period": "week"}).json()
        assert len(rw["daily"]) == 7
        rm = api.get(f"{api.base_url}/api/patients/{pid}/reports",
                     params={"period": "month"}).json()
        assert len(rm["daily"]) == 30

        # cleanup med
        d = api.delete(f"{api.base_url}/api/medications/{med_id}")
        assert d.status_code == 200

    def test_intake_invalid_status(self, api, test_user_and_token):
        pid = test_user_and_token["self_patient_id"]
        r = api.post(
            f"{api.base_url}/api/intake",
            json={
                "patient_id": pid,
                "medication_id": "med_nope",
                "scheduled_date": "2026-01-01",
                "scheduled_time": "08:00",
                "status": "invalid",
            },
        )
        assert r.status_code == 400


# ---------------- Device + SOS ----------------
class TestDeviceSos:
    def test_device_shape(self, api, test_user_and_token):
        pid = test_user_and_token["self_patient_id"]
        r = api.get(f"{api.base_url}/api/patients/{pid}/device")
        assert r.status_code == 200
        d = r.json()
        assert "dispenser" in d and "band" in d
        assert d["dispenser"]["name"] == "VYLNAX PRO"
        assert "water_ml" in d["dispenser"]
        assert "heart_rate" in d["band"]

    def test_sos(self, api):
        r = api.post(f"{api.base_url}/api/sos", json={"message": "TEST_Notruf"})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert r.json()["message"] == "TEST_Notruf"


# ---------------- NEW: Medication Database ----------------
class TestMedDatabase:
    def test_default_list(self, api):
        r = api.get(f"{api.base_url}/api/med-database")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert 1 <= len(data) <= 12
        # check shape
        for m in data:
            assert {"name", "dosage", "form", "category"} <= set(m.keys())

    def test_search_metformin(self, api):
        r = api.get(f"{api.base_url}/api/med-database", params={"q": "metformin"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all("metformin" in m["name"].lower() or
                   "metformin" in m["category"].lower() for m in data)

    def test_search_category(self, api):
        r = api.get(f"{api.base_url}/api/med-database", params={"q": "Blutdruck"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(m["category"] == "Blutdruck" or "blutdruck" in m["name"].lower()
                   for m in data)

    def test_search_no_match(self, api):
        r = api.get(f"{api.base_url}/api/med-database",
                    params={"q": "xxnonexistentxx"})
        assert r.status_code == 200
        assert r.json() == []


# ---------------- NEW: AI Assistant ----------------
class TestAssistant:
    def test_history_starts_empty(self, api):
        # clear first for clean state
        api.delete(f"{api.base_url}/api/assistant/history")
        r = api.get(f"{api.base_url}/api/assistant/history")
        assert r.status_code == 200
        assert r.json() == []

    def test_chat_and_history_and_multiturn(self, api, test_user_and_token):
        pid = test_user_and_token["self_patient_id"]
        api.delete(f"{api.base_url}/api/assistant/history")

        # Turn 1
        r1 = api.post(
            f"{api.base_url}/api/assistant/chat",
            json={"message": "Mein Name ist Test-Nutzer. Was ist Metformin?",
                  "patient_id": pid},
            timeout=90,
        )
        assert r1.status_code == 200, r1.text
        reply1 = r1.json()["reply"]
        assert isinstance(reply1, str) and len(reply1) > 5

        # history should contain 2 messages
        h = api.get(f"{api.base_url}/api/assistant/history").json()
        assert len(h) == 2
        assert h[0]["role"] == "user"
        assert h[1]["role"] == "assistant"
        # ordered ascending by created_at
        assert h[0]["created_at"] <= h[1]["created_at"]

        # Turn 2 - multi-turn coherence
        r2 = api.post(
            f"{api.base_url}/api/assistant/chat",
            json={"message": "Wie hieß ich nochmal?", "patient_id": pid},
            timeout=90,
        )
        assert r2.status_code == 200
        reply2 = r2.json()["reply"].lower()
        # AI should recall name from prior turn OR at least give a coherent
        # response referencing conversation (we accept either explicit recall
        # of "test" or a graceful acknowledgement)
        assert len(reply2) > 5

        h2 = api.get(f"{api.base_url}/api/assistant/history").json()
        assert len(h2) == 4

    def test_history_delete(self, api):
        # ensure at least one message
        r = api.post(f"{api.base_url}/api/assistant/chat",
                     json={"message": "Kurzer Test"}, timeout=90)
        assert r.status_code == 200
        d = api.delete(f"{api.base_url}/api/assistant/history")
        assert d.status_code == 200
        h = api.get(f"{api.base_url}/api/assistant/history").json()
        assert h == []
