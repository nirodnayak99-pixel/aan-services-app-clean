"""Iteration 3 tests: User management, CSV export, manager role restrictions."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://employee-registry-14.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "admin@aanservices.in"
ADMIN_PASSWORD = "Admin@123"

TINY_PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _login(email: str, password: str):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- User management (admin only) ----------------
class TestUserManagement:
    created_user_ids: list = []

    @classmethod
    def setup_class(cls):
        cls.admin_token = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        cls.ah = _h(cls.admin_token)

    def test_list_users_as_admin_contains_admin(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/users", headers=self.ah)
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list)
        assert any(u["email"] == ADMIN_EMAIL and u["role"] == "admin" for u in users)

    def test_list_users_unauthenticated_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/users")
        assert r.status_code == 401

    def test_create_manager_user_and_verify_via_get(self, api_client):
        email = f"test_mgr_{uuid.uuid4().hex[:6]}@aanservices.in"
        payload = {"email": email, "name": "TEST_Mgr", "password": "Manager@123", "role": "manager"}
        r = api_client.post(f"{BASE_URL}/api/users", headers=self.ah, json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["email"] == email
        assert data["role"] == "manager"
        assert data["name"] == "TEST_Mgr"
        assert "id" in data and "password_hash" not in data
        TestUserManagement.created_user_ids.append(data["id"])

        # Verify GET
        r2 = api_client.get(f"{BASE_URL}/api/users", headers=self.ah)
        assert any(u["id"] == data["id"] for u in r2.json())

    def test_create_admin_user_allowed(self, api_client):
        email = f"test_adm_{uuid.uuid4().hex[:6]}@aanservices.in"
        r = api_client.post(
            f"{BASE_URL}/api/users",
            headers=self.ah,
            json={"email": email, "name": "TEST_Adm", "password": "Admin@987", "role": "admin"},
        )
        assert r.status_code == 201, r.text
        assert r.json()["role"] == "admin"
        TestUserManagement.created_user_ids.append(r.json()["id"])

    def test_create_duplicate_email_409(self, api_client):
        email = f"test_dup_{uuid.uuid4().hex[:6]}@aanservices.in"
        p = {"email": email, "name": "Dup", "password": "Secret@123", "role": "manager"}
        r1 = api_client.post(f"{BASE_URL}/api/users", headers=self.ah, json=p)
        assert r1.status_code == 201
        TestUserManagement.created_user_ids.append(r1.json()["id"])
        r2 = api_client.post(f"{BASE_URL}/api/users", headers=self.ah, json=p)
        assert r2.status_code == 409

    def test_create_invalid_role_400(self, api_client):
        email = f"test_bad_{uuid.uuid4().hex[:6]}@aanservices.in"
        r = api_client.post(
            f"{BASE_URL}/api/users",
            headers=self.ah,
            json={"email": email, "name": "Bad", "password": "Secret@123", "role": "superuser"},
        )
        assert r.status_code == 400

    def test_delete_user_success_and_verify(self, api_client):
        email = f"test_del_{uuid.uuid4().hex[:6]}@aanservices.in"
        rc = api_client.post(
            f"{BASE_URL}/api/users",
            headers=self.ah,
            json={"email": email, "name": "ToDel", "password": "Secret@123", "role": "manager"},
        )
        assert rc.status_code == 201
        uid = rc.json()["id"]
        rd = api_client.delete(f"{BASE_URL}/api/users/{uid}", headers=self.ah)
        assert rd.status_code == 200
        # Verify gone
        rl = api_client.get(f"{BASE_URL}/api/users", headers=self.ah)
        assert not any(u["id"] == uid for u in rl.json())

    def test_delete_nonexistent_user_404(self, api_client):
        r = api_client.delete(f"{BASE_URL}/api/users/does-not-exist-xyz", headers=self.ah)
        assert r.status_code == 404

    def test_cannot_delete_self_400(self, api_client):
        me = api_client.get(f"{BASE_URL}/api/auth/me", headers=self.ah).json()
        r = api_client.delete(f"{BASE_URL}/api/users/{me['id']}", headers=self.ah)
        assert r.status_code == 400

    @classmethod
    def teardown_class(cls):
        for uid in cls.created_user_ids:
            try:
                requests.delete(f"{BASE_URL}/api/users/{uid}", headers=cls.ah)
            except Exception:
                pass


# ---------------- Manager role restrictions ----------------
class TestManagerRoleRestrictions:
    manager_email: str = ""
    manager_password: str = "Manager@123"
    manager_user_id: str = ""
    admin_token: str = ""
    manager_token: str = ""
    test_industry_id: str = ""
    test_employee_id: str = ""

    @classmethod
    def setup_class(cls):
        cls.admin_token = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        cls.ah = _h(cls.admin_token)

        # Create a manager user
        cls.manager_email = f"test_mgrrole_{uuid.uuid4().hex[:6]}@aanservices.in"
        rc = requests.post(
            f"{BASE_URL}/api/users",
            headers=cls.ah,
            json={
                "email": cls.manager_email,
                "name": "TEST_MgrRole",
                "password": cls.manager_password,
                "role": "manager",
            },
        )
        assert rc.status_code == 201, rc.text
        cls.manager_user_id = rc.json()["id"]

        cls.manager_token = _login(cls.manager_email, cls.manager_password)
        cls.mh = _h(cls.manager_token)

        # Create an industry + employee (as admin) for manager tests
        ri = requests.post(
            f"{BASE_URL}/api/industries",
            headers=cls.ah,
            json={"name": f"TEST_MgrInd_{uuid.uuid4().hex[:6]}"},
        )
        cls.test_industry_id = ri.json()["id"]

        re_ = requests.post(
            f"{BASE_URL}/api/employees",
            headers=cls.ah,
            json={
                "name": "TEST_MgrEmp",
                "phone": "9111111111",
                "industry_id": cls.test_industry_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        cls.test_employee_id = re_.json()["id"]

    # --- Manager can do these ---
    def test_manager_can_list_employees(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/employees", headers=self.mh)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_manager_can_list_industries(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/industries", headers=self.mh)
        assert r.status_code == 200

    def test_manager_can_create_employee(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/employees",
            headers=self.mh,
            json={
                "name": "TEST_MgrCreated",
                "phone": "9222222222",
                "industry_id": self.test_industry_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        assert r.status_code == 201, r.text
        # cleanup
        eid = r.json()["id"]
        requests.delete(f"{BASE_URL}/api/employees/{eid}", headers=self.ah)

    def test_manager_can_update_employee(self, api_client):
        r = api_client.put(
            f"{BASE_URL}/api/employees/{self.test_employee_id}",
            headers=self.mh,
            json={"designation": "Mgr-updated"},
        )
        assert r.status_code == 200
        assert r.json()["designation"] == "Mgr-updated"

    def test_manager_can_view_stats(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/stats", headers=self.mh)
        assert r.status_code == 200

    # --- Manager CANNOT do these (403) ---
    def test_manager_cannot_create_industry(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/industries",
            headers=self.mh,
            json={"name": f"TEST_MgrShouldFail_{uuid.uuid4().hex[:6]}"},
        )
        assert r.status_code == 403

    def test_manager_cannot_delete_industry(self, api_client):
        r = api_client.delete(
            f"{BASE_URL}/api/industries/{self.test_industry_id}", headers=self.mh
        )
        assert r.status_code == 403

    def test_manager_cannot_delete_employee(self, api_client):
        r = api_client.delete(
            f"{BASE_URL}/api/employees/{self.test_employee_id}", headers=self.mh
        )
        assert r.status_code == 403

    def test_manager_cannot_list_users(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/users", headers=self.mh)
        assert r.status_code == 403

    def test_manager_cannot_create_user(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/users",
            headers=self.mh,
            json={
                "email": f"mgr_blocked_{uuid.uuid4().hex[:6]}@aanservices.in",
                "name": "Blocked",
                "password": "Secret@123",
                "role": "manager",
            },
        )
        assert r.status_code == 403

    def test_manager_cannot_delete_user(self, api_client):
        # try deleting admin's own id or any id - should be 403 before hitting logic
        r = api_client.delete(f"{BASE_URL}/api/users/some-id", headers=self.mh)
        assert r.status_code == 403

    @classmethod
    def teardown_class(cls):
        try:
            requests.delete(f"{BASE_URL}/api/employees/{cls.test_employee_id}", headers=cls.ah)
            requests.delete(f"{BASE_URL}/api/industries/{cls.test_industry_id}", headers=cls.ah)
            requests.delete(f"{BASE_URL}/api/users/{cls.manager_user_id}", headers=cls.ah)
        except Exception:
            pass


# ---------------- CSV export ----------------
class TestCsvExport:
    ind_id: str = ""
    emp_id: str = ""
    mgr_user_id: str = ""
    mgr_email: str = ""

    @classmethod
    def setup_class(cls):
        cls.admin_token = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        cls.ah = _h(cls.admin_token)

        ri = requests.post(
            f"{BASE_URL}/api/industries",
            headers=cls.ah,
            json={"name": f"TEST_CsvInd_{uuid.uuid4().hex[:6]}"},
        )
        cls.ind_id = ri.json()["id"]

        re_ = requests.post(
            f"{BASE_URL}/api/employees",
            headers=cls.ah,
            json={
                "name": "TEST_CsvEmployee",
                "phone": "9333333333",
                "email": "csv@test.com",
                "designation": "CSV-tester",
                "industry_id": cls.ind_id,
                "aadhaar_image_base64": TINY_PNG_B64,
            },
        )
        cls.emp_id = re_.json()["id"]

    def test_csv_export_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/employees/export.csv")
        assert r.status_code == 401

    def test_csv_export_as_admin(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/employees/export.csv", headers=self.ah)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".csv" in cd.lower()
        body = r.text
        # header row present
        assert "Name" in body and "Phone" in body and "Industry" in body
        # our test employee present
        assert "TEST_CsvEmployee" in body
        assert "CSV-tester" in body

    def test_csv_export_filter_by_industry(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/employees/export.csv?industry_id={self.ind_id}",
            headers=self.ah,
        )
        assert r.status_code == 200
        body = r.text
        lines = [l for l in body.splitlines() if l.strip()]
        # header + at least our test row
        assert len(lines) >= 2
        assert "TEST_CsvEmployee" in body

    def test_csv_export_filter_empty_industry_returns_header_only(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/employees/export.csv?industry_id=no-such-industry",
            headers=self.ah,
        )
        assert r.status_code == 200
        lines = [l for l in r.text.splitlines() if l.strip()]
        assert len(lines) == 1  # only header

    def test_csv_export_as_manager_allowed(self, api_client):
        # Create a manager and call export as manager — should succeed (any authenticated user)
        email = f"test_csvmgr_{uuid.uuid4().hex[:6]}@aanservices.in"
        rc = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.ah,
            json={"email": email, "name": "CsvMgr", "password": "Manager@123", "role": "manager"},
        )
        assert rc.status_code == 201
        TestCsvExport.mgr_user_id = rc.json()["id"]
        TestCsvExport.mgr_email = email
        mgr_tok = _login(email, "Manager@123")
        r = api_client.get(
            f"{BASE_URL}/api/employees/export.csv", headers=_h(mgr_tok)
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")

    @classmethod
    def teardown_class(cls):
        try:
            requests.delete(f"{BASE_URL}/api/employees/{cls.emp_id}", headers=cls.ah)
            requests.delete(f"{BASE_URL}/api/industries/{cls.ind_id}", headers=cls.ah)
            if cls.mgr_user_id:
                requests.delete(f"{BASE_URL}/api/users/{cls.mgr_user_id}", headers=cls.ah)
        except Exception:
            pass
