"""Shared test fixtures for VYLNAX PRO backend tests."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL"
) else "https://care-connect-701.preview.emergentagent.com"


def _now():
    return datetime.now(timezone.utc)


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo():
    # Backend .env has these values
    client = MongoClient("mongodb://localhost:27017")
    return client["test_database"]


@pytest.fixture(scope="session")
def test_user_and_token(mongo):
    """
    Since Google OAuth cannot be automated headless, we insert a
    synthetic user + session directly into MongoDB. This mirrors
    what /api/auth/session would produce after a real OAuth exchange.
    """
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    token = f"TEST_TOKEN_{uuid.uuid4().hex}"
    email = f"TEST_{uuid.uuid4().hex[:8]}@vylnax.test"

    mongo.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "TEST User",
        "picture": "",
        "role": "patient",
        "created_at": _now().isoformat(),
    })
    mongo.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": (_now() + timedelta(days=1)).isoformat(),
        "created_at": _now().isoformat(),
    })
    # Auto-create self patient like /auth/session does
    self_patient_id = f"pat_{uuid.uuid4().hex[:12]}"
    mongo.patients.insert_one({
        "id": self_patient_id,
        "owner_id": user_id,
        "name": "TEST User",
        "age": None, "room": None, "notes": "Eigenes Profil",
        "is_self": True,
        "created_at": _now().isoformat(),
    })

    yield {"user_id": user_id, "token": token, "email": email,
           "self_patient_id": self_patient_id}

    # cleanup
    mongo.users.delete_many({"user_id": user_id})
    mongo.user_sessions.delete_many({"user_id": user_id})
    mongo.patients.delete_many({"owner_id": user_id})
    mongo.medications.delete_many({"patient_id": {"$regex": "^pat_"}, "_synthetic": True})
    mongo.chat_messages.delete_many({"user_id": user_id})


@pytest.fixture
def api(base_url, test_user_and_token):
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_user_and_token['token']}",
    })
    session.base_url = base_url
    return session


@pytest.fixture
def unauth_api(base_url):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    session.base_url = base_url
    return session
