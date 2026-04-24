"""Backend tests for AAN Services admin API."""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://employee-registry-14.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@aanservices.in"
ADMIN_PASSWORD = "Admin@123"

TINY_PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert data["token_type"] == "bearer"

    def test_invalid_login_returns_401(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrong-password-xyz"},
        )
        assert r.status_code == 401

    def test_me_returns_current_admin(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_me_without_token_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_brute_force_lockout(self, api_client):
        # Use random unique email so it does NOT lock the real admin
        fake_email = f"bf_{uuid.uuid4().hex[:8]}@example.com"
        last_status = None
        for _ in range(6):
            r = api_client.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": fake_email, "password": "wrong"},
            )
            last_status = r.status_code
            if r.status_code == 429:
                break
        assert last_status == 429, f"Expected 429 after 5 attempts, got {last_status}"


# ---------- Industries ----------
class TestIndustries:
    created_ids: list = []

    def test_list_industries_authenticated_has_seeded(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/industries", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 8
        names = [i["name"] for i in items]
        for expected in ["Manufacturing", "IT & Software", "Retail", "Hospitality",
                         "Construction", "Healthcare", "Logistics & Warehousing", "Security Services"]:
            assert expected in names, f"Missing seeded industry: {expected}"

    def test_list_industries_unauthenticated_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/industries")
        assert r.status_code == 401

    def test_create_industry_and_verify(self, api_client, auth_headers):
        name = f"TEST_Industry_{uuid.uuid4().hex[:6]}"
        r = api_client.post(
            f"{BASE_URL}/api/industries",
            headers=auth_headers,
            json={"name": name, "description": "test desc"},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["name"] == name
        assert data["description"] == "test desc"
        assert "id" in data
        TestIndustries.created_ids.append(data["id"])

        # GET verification
        r2 = api_client.get(f"{BASE_URL}/api/industries", headers=auth_headers)
        assert any(i["id"] == data["id"] for i in r2.json())

    def test_duplicate_industry_409(self, api_client, auth_headers):
        name = f"TEST_Dup_{uuid.uuid4().hex[:6]}"
        r1 = api_client.post(
            f"{BASE_URL}/api/industries", headers=auth_headers, json={"name": name}
        )
        assert r1.status_code == 201
        TestIndustries.created_ids.append(r1.json()["id"])
        r2 = api_client.post(
            f"{BASE_URL}/api/industries", headers=auth_headers, json={"name": name}
        )
        assert r2.status_code == 409

    def test_update_industry_propagates_name(self, api_client, auth_headers):
        # Create industry
        ind_name = f"TEST_Prop_{uuid.uuid4().hex[:6]}"
        ri = api_client.post(
            f"{BASE_URL}/api/industries", headers=auth_headers, json={"name": ind_name}
        )
        ind_id = ri.json()["id"]
        TestIndustries.created_ids.append(ind_id)

        # Create employee linked to this industry
        re_ = api_client.post(
            f"{BASE_URL}/api/employees",
            headers=auth_headers,
            json={
                "name": "TEST_Propagate_User",
                "phone": "9999999999",
                "industry_id": ind_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        assert re_.status_code == 201, re_.text
        emp_id = re_.json()["id"]

        # Update industry name
        new_name = ind_name + "_UPD"
        ru = api_client.put(
            f"{BASE_URL}/api/industries/{ind_id}",
            headers=auth_headers,
            json={"name": new_name},
        )
        assert ru.status_code == 200
        assert ru.json()["name"] == new_name

        # Verify employee industry_name was updated
        rg = api_client.get(f"{BASE_URL}/api/employees/{emp_id}", headers=auth_headers)
        assert rg.status_code == 200
        assert rg.json()["industry_name"] == new_name

        # Cleanup employee
        api_client.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=auth_headers)

    def test_delete_industry_in_use_returns_409(self, api_client, auth_headers):
        ind_name = f"TEST_InUse_{uuid.uuid4().hex[:6]}"
        ri = api_client.post(
            f"{BASE_URL}/api/industries", headers=auth_headers, json={"name": ind_name}
        )
        ind_id = ri.json()["id"]

        re_ = api_client.post(
            f"{BASE_URL}/api/employees",
            headers=auth_headers,
            json={
                "name": "TEST_InUse_User",
                "phone": "8888888888",
                "industry_id": ind_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        emp_id = re_.json()["id"]

        rd = api_client.delete(f"{BASE_URL}/api/industries/{ind_id}", headers=auth_headers)
        assert rd.status_code == 409

        # Cleanup
        api_client.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=auth_headers)
        api_client.delete(f"{BASE_URL}/api/industries/{ind_id}", headers=auth_headers)

    def test_delete_industry_unused_succeeds(self, api_client, auth_headers):
        ind_name = f"TEST_Del_{uuid.uuid4().hex[:6]}"
        ri = api_client.post(
            f"{BASE_URL}/api/industries", headers=auth_headers, json={"name": ind_name}
        )
        ind_id = ri.json()["id"]
        rd = api_client.delete(f"{BASE_URL}/api/industries/{ind_id}", headers=auth_headers)
        assert rd.status_code == 200
        # Verify gone
        rl = api_client.get(f"{BASE_URL}/api/industries", headers=auth_headers)
        assert not any(i["id"] == ind_id for i in rl.json())

    @classmethod
    def teardown_class(cls):
        # Best-effort cleanup
        try:
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            )
            if r.status_code == 200:
                tok = r.json()["access_token"]
                h = {"Authorization": f"Bearer {tok}"}
                for iid in cls.created_ids:
                    requests.delete(f"{BASE_URL}/api/industries/{iid}", headers=h)
        except Exception:
            pass


# ---------- Employees ----------
class TestEmployees:
    emp_ids: list = []
    ind_id: str = None

    @classmethod
    def setup_class(cls):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        cls.token = r.json()["access_token"]
        cls.h = {"Authorization": f"Bearer {cls.token}", "Content-Type": "application/json"}
        # Create dedicated test industry
        ri = requests.post(
            f"{BASE_URL}/api/industries",
            headers=cls.h,
            json={"name": f"TEST_EmpInd_{uuid.uuid4().hex[:6]}"},
        )
        cls.ind_id = ri.json()["id"]

    def test_create_employee_sets_industry_name(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/employees",
            headers=self.h,
            json={
                "name": "TEST_Alice",
                "phone": "9000000001",
                "email": "alice@test.com",
                "designation": "Engineer",
                "industry_id": self.ind_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["industry_id"] == self.ind_id
        assert data["industry_name"].startswith("TEST_EmpInd_")
        assert data["aadhaar_image_base64"] == TINY_PNG_B64
        TestEmployees.emp_ids.append(data["id"])

    def test_create_employee_invalid_industry_400(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/employees",
            headers=self.h,
            json={
                "name": "TEST_Bad",
                "phone": "9000000002",
                "industry_id": "non-existent-id",
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        assert r.status_code == 400

    def test_list_employees_strips_aadhaar(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/employees", headers=self.h)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for item in items:
            assert "aadhaar_image_base64" not in item

    def test_list_employees_search_and_filter(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/employees?q=TEST_Alice&industry_id={self.ind_id}",
            headers=self.h,
        )
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert any(i["name"] == "TEST_Alice" for i in items)

    def test_get_employee_full_includes_aadhaar(self, api_client):
        assert TestEmployees.emp_ids
        eid = TestEmployees.emp_ids[0]
        r = api_client.get(f"{BASE_URL}/api/employees/{eid}", headers=self.h)
        assert r.status_code == 200
        data = r.json()
        assert data["aadhaar_image_base64"] == TINY_PNG_B64

    def test_update_employee_change_industry(self, api_client):
        # Create second industry
        ri = api_client.post(
            f"{BASE_URL}/api/industries",
            headers=self.h,
            json={"name": f"TEST_EmpInd2_{uuid.uuid4().hex[:6]}"},
        )
        new_ind_id = ri.json()["id"]
        new_ind_name = ri.json()["name"]

        eid = TestEmployees.emp_ids[0]
        r = api_client.put(
            f"{BASE_URL}/api/employees/{eid}",
            headers=self.h,
            json={"industry_id": new_ind_id, "designation": "Sr Engineer"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["industry_id"] == new_ind_id
        assert data["industry_name"] == new_ind_name
        assert data["designation"] == "Sr Engineer"

        # Cleanup the 2nd industry after moving back
        api_client.put(
            f"{BASE_URL}/api/employees/{eid}",
            headers=self.h,
            json={"industry_id": self.ind_id},
        )
        api_client.delete(f"{BASE_URL}/api/industries/{new_ind_id}", headers=self.h)

    def test_delete_employee(self, api_client):
        # Create a fresh employee to delete
        r = api_client.post(
            f"{BASE_URL}/api/employees",
            headers=self.h,
            json={
                "name": "TEST_ToDelete",
                "phone": "9000000099",
                "industry_id": self.ind_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        eid = r.json()["id"]
        rd = api_client.delete(f"{BASE_URL}/api/employees/{eid}", headers=self.h)
        assert rd.status_code == 200
        rg = api_client.get(f"{BASE_URL}/api/employees/{eid}", headers=self.h)
        assert rg.status_code == 404

    def test_stats_endpoint(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/stats", headers=self.h)
        assert r.status_code == 200
        data = r.json()
        assert "total_employees" in data
        assert "total_industries" in data
        assert isinstance(data["recent_employees"], list)
        assert data["total_industries"] >= 8

    def test_employees_unauthenticated_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/employees")
        assert r.status_code == 401

    @classmethod
    def teardown_class(cls):
        try:
            for eid in cls.emp_ids:
                requests.delete(f"{BASE_URL}/api/employees/{eid}", headers=cls.h)
            if cls.ind_id:
                requests.delete(f"{BASE_URL}/api/industries/{cls.ind_id}", headers=cls.h)
        except Exception:
            pass
