from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Logging ----------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# ---------- ENV ----------
mongo_url = os.getenv("MONGO_URL")
db_name = os.getenv("DB_NAME", "test")

# ---------- Debug Logs ----------
logger.info(f"RAILWAY PORT = {os.getenv('PORT')}")
logger.info(f"MONGO_URL set: {'YES' if mongo_url else 'NO'}")
logger.info(f"DB_NAME: {db_name}")


if not mongo_url:
    raise RuntimeError("MONGO_URL is not set")

client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,
    minPoolSize=5,
    serverSelectionTimeoutMS=30000
)
db = client[db_name]

# ---------- App ----------
app = FastAPI(title="AAN Services API")
api_router = APIRouter()


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"message": "AAN API running"}

# ---------- JWT / Password Helpers ----------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day for admin mobile use

def get_jwt_secret() -> str:
    JWT_SECRET = os.getenv("JWT_SECRET")
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET missing at startup")
    return JWT_SECRET


async def hash_password(password: str) -> str:
    return await run_in_threadpool(
        lambda: bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds=12)
        ).decode("utf-8")
    )

async def verify_password(plain: str, hashed: str) -> bool:
    return await run_in_threadpool(
        lambda: bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8")
        )
    )

def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(expire.timestamp()),  # FIX: stable JWT format
        "type": "access",
    }

    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

bearer_scheme = HTTPBearer(auto_error=False)

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token: Optional[str] = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ---------- Brute force ----------
MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

async def check_lockout(identifier: str) -> None:
    record = await db.login_attempts.find_one({"identifier": identifier})

    if not record or not record.get("locked_until"):
        return

    locked_until = record["locked_until"]

    if isinstance(locked_until, str):
        locked_until = datetime.fromisoformat(locked_until)

    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)

    if locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

async def register_failed_attempt(identifier: str) -> None:
    now = datetime.now(timezone.utc)

    record = await db.login_attempts.find_one({"identifier": identifier})
    attempts = (record.get("attempts", 0) if record else 0) + 1

    update = {
        "$set": {
            "last_attempt": now
        },
        "$inc": {
            "attempts": 1
        }
    }

    if attempts >= MAX_ATTEMPTS:
        update = {
            "$set": {
                "locked_until": now + timedelta(minutes=LOCKOUT_MINUTES),
                "attempts": 0,
                "last_attempt": now
            }
        }

    await db.login_attempts.update_one(
        {"identifier": identifier},
        update,
        upsert=True
    )

async def clear_attempts(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})

# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str

class LoginResponse(BaseModel):
    user: UserPublic
    access_token: str
    token_type: str = "bearer"

class IndustryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=300)

class IndustryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=300)

class Industry(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, max_length=500)
    dob: Optional[str] = None  # ISO date string YYYY-MM-DD
    joining_date: Optional[str] = None
    designation: Optional[str] = Field(None, max_length=120)
    salary: Optional[float] = None
    industry_id: str
    aadhaar_image_url: str  # data URI or raw base64

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    dob: Optional[str] = None
    joining_date: Optional[str] = None
    designation: Optional[str] = None
    salary: Optional[float] = None
    industry_id: Optional[str] = None
    aadhaar_image_url: Optional[str] = None

class Employee(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[str] = None
    joining_date: Optional[str] = None
    designation: Optional[str] = None
    salary: Optional[float] = None
    industry_id: str
    industry_name: str
    aadhaar_image_url: str
    created_at: datetime

class EmployeeListItem(BaseModel):
    id: str
    name: str
    phone: str
    designation: Optional[str] = None
    industry_id: str
    industry_name: str
    created_at: datetime

class Stats(BaseModel):
    total_employees: int
    total_industries: int
    recent_employees: List[EmployeeListItem]

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default=ROLE_MANAGER)

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

# ---------- Auth Endpoints ----------
def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("x-real-ip", "")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request):
    email = payload.email.lower().strip()
    ip = _client_ip(request)
    identifier = f"{ip}:{email}"

    await check_lockout(identifier)

    user = await db.users.find_one({"email": email})

    if not user or not await verify_password(payload.password, user["password_hash"]):
        await register_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await clear_attempts(identifier)

    token = create_access_token(user["id"], user["email"])

    return LoginResponse(
        user=UserPublic(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"]
        ),
        access_token=token,
    )

@api_router.get("/auth/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(**{k: current_user[k] for k in ("id", "email", "name", "role")})

@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"success": True}

# ---------- Industries ----------
@api_router.get("/industries", response_model=List[Industry])
async def list_industries(current_user: dict = Depends(get_current_user)):
    items = await db.industries.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [Industry(**i) for i in items]

@api_router.post("/industries", response_model=Industry, status_code=201)
async def create_industry(body: IndustryCreate, current_user: dict = Depends(require_admin)):
    existing = await db.industries.find_one({"name": body.name.strip()})
    if existing:
        raise HTTPException(status_code=409, detail="Industry with this name already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "description": body.description.strip() if body.description else None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.industries.insert_one(doc)
    doc.pop("_id", None)
    return Industry(**doc)

@api_router.put("/industries/{industry_id}", response_model=Industry)
async def update_industry(
    industry_id: str, body: IndustryUpdate, current_user: dict = Depends(get_current_user)
):
    update_fields = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if "name" in update_fields:
        update_fields["name"] = update_fields["name"].strip()
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.industries.update_one({"id": industry_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")
    # If name updated, propagate to employees
    if "name" in update_fields:
        await db.employees.update_many(
            {"industry_id": industry_id}, {"$set": {"industry_name": update_fields["name"]}}
        )
    item = await db.industries.find_one({"id": industry_id}, {"_id": 0})
    return Industry(**item)

@api_router.delete("/industries/{industry_id}")
async def delete_industry(industry_id: str, current_user: dict = Depends(require_admin)):
    in_use = await db.employees.count_documents({"industry_id": industry_id})
    if in_use > 0:
        raise HTTPException(
            status_code=409, detail=f"Cannot delete: {in_use} employee(s) tagged to this industry"
        )
    result = await db.industries.delete_one({"id": industry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")
    return {"success": True}

# ---------- Employees ----------
@api_router.get("/employees", response_model=List[EmployeeListItem])
async def list_employees(
    q: Optional[str] = Query(None),
    industry_id: Optional[str] = Query(None),
):
    query: dict = {}
    if industry_id:
        query["industry_id"] = industry_id
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"designation": {"$regex": q, "$options": "i"}},
        ]
    items = await db.employees.find(
        query,
        {
            "_id": 0,
            "aadhaar_image_url": 0,
            "email": 0,
            "address": 0,
            "dob": 0,
            "joining_date": 0,
            "salary": 0,
        },
    ).sort("created_at", -1).to_list(2000)
    return [EmployeeListItem(**i) for i in items]

@api_router.post("/employees", response_model=Employee, status_code=201)
async def create_employee(body: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    industry = await db.industries.find_one({"id": body.industry_id}, {"_id": 0})
    if not industry:
        raise HTTPException(status_code=400, detail="Invalid industry_id")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "phone": body.phone.strip(),
        "email": body.email,
        "address": body.address,
        "dob": body.dob,
        "joining_date": body.joining_date,
        "designation": body.designation.strip() if body.designation else None,
        "salary": body.salary,
        "industry_id": body.industry_id,
        "industry_name": industry["name"],
        "aadhaar_image_url": body.aadhaar_image_url,
        "created_at": datetime.now(timezone.utc),
    }
    await db.employees.insert_one(doc)
    doc.pop("_id", None)
    return Employee(**doc)

@api_router.get("/employees/export.csv")
async def export_employees_csv(
    industry_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse

    query: dict = {}
    if industry_id:
        query["industry_id"] = industry_id

    employees = await db.employees.find(
        query,
        {"_id": 0, "aadhaar_image_url": 0},
    ).sort("created_at", -1).to_list(10000)

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Name", "Phone", "Email", "Designation", "Industry",
        "Address", "DOB", "Joining Date", "Salary (INR)", "Onboarded At",
    ])
    for e in employees:
        writer.writerow([
            e.get("name", ""),
            e.get("phone", ""),
            e.get("email", "") or "",
            e.get("designation", "") or "",
            e.get("industry_name", ""),
            e.get("address", "") or "",
            e.get("dob", "") or "",
            e.get("joining_date", "") or "",
            e.get("salary", "") if e.get("salary") is not None else "",
            e.get("created_at").isoformat() if e.get("created_at") else "",
        ])
    buf.seek(0)
    filename = f"aan_employees_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Employee not found")
    return Employee(**item)

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(
    employee_id: str, body: EmployeeUpdate, current_user: dict = Depends(get_current_user)
):
    update_fields = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if "industry_id" in update_fields:
        industry = await db.industries.find_one({"id": update_fields["industry_id"]}, {"_id": 0})
        if not industry:
            raise HTTPException(status_code=400, detail="Invalid industry_id")
        update_fields["industry_name"] = industry["name"]
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.employees.update_one({"id": employee_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    item = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    return Employee(**item)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, current_user: dict = Depends(require_admin)):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"success": True}

# ---------- User Management (super-admin only) ----------
@api_router.get("/users", response_model=List[UserOut])
async def list_users(current_user: dict = Depends(require_admin)):
    items = await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", 1).to_list(1000)
    return [UserOut(**u) for u in items]

@api_router.post("/users", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, current_user: dict = Depends(require_admin)):
    role = body.role.strip().lower()
    if role not in (ROLE_ADMIN, ROLE_MANAGER):
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name.strip(),
        "role": role,
        "password_hash": await hash_password(body.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return UserOut(**doc)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.delete_one({"id": user_id})
    return {"success": True}

# ---------- Stats ----------
@api_router.get("/stats", response_model=Stats)
async def get_stats(current_user: dict = Depends(get_current_user)):
    total_employees = await db.employees.count_documents({})
    total_industries = await db.industries.count_documents({})
    recent_cursor = db.employees.find(
        {},
        {
            "_id": 0,
            "aadhaar_image_url": 0,
            "email": 0,
            "address": 0,
            "dob": 0,
            "joining_date": 0,
            "salary": 0,
        },
    ).sort("created_at", -1).limit(5)
    recent = await recent_cursor.to_list(5)
    return Stats(
        total_employees=total_employees,
        total_industries=total_industries,
        recent_employees=[EmployeeListItem(**i) for i in recent],
    )

# ---------- Health ----------
@api_router.get("/status")
async def api_status():
    return {"service": "AAN API", "status": "ok"}

# ---------- Startup: seed ----------
DEFAULT_INDUSTRIES = [
    ("Manufacturing", "Factory, production, assembly line staffing"),
    ("IT & Software", "IT support, software development, infra"),
    ("Retail", "Shops, malls, supermarkets"),
    ("Hospitality", "Hotels, restaurants, catering"),
    ("Construction", "Civil, site labour, masonry"),
    ("Healthcare", "Hospitals, clinics, caregiving"),
    ("Logistics & Warehousing", "Warehouse, packing, delivery"),
    ("Security Services", "Guards, security personnel"),
]

async def seed_admin():
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    # ✅ Prevent startup crash if env vars are missing
    if not admin_email or not admin_password:
        logger.warning("ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin seeding.")
        return

    admin_email = admin_email.lower().strip()

    existing = await db.users.find_one({"email": admin_email})

    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": await hash_password(admin_password),
            "name": "AAN Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Seeded admin user: %s", admin_email)

    else:
        # ✅ Only update password if it has actually changed
        is_valid = await verify_password(admin_password, existing["password_hash"])

        if not is_valid:
            new_hash = await hash_password(admin_password)

            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": new_hash}},
            )
            logger.info("Updated admin password for: %s", admin_email)

async def seed_industries():
    for name, desc in DEFAULT_INDUSTRIES:
        exists = await db.industries.find_one({"name": name})
        if not exists:
            await db.industries.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "description": desc,
                "created_at": datetime.now(timezone.utc),
            })

@app.on_event("startup")
async def on_startup():
    try:
        await client.admin.command("ping")
        logger.info("MongoDB connected")

        # Existing indexes
        await db.users.create_index("email", unique=True)
        await db.industries.create_index("name", unique=True)
        await db.employees.create_index("industry_id")
        await db.employees.create_index("created_at")
        await db.login_attempts.create_index("identifier", unique=True)

        # ✅ ADD THESE
        await db.users.create_index("id", unique=True)
        await db.employees.create_index("id", unique=True)
        await db.industries.create_index("id", unique=True)

        await seed_admin()
        await seed_industries()

        logger.info("Startup seeding complete")

    except Exception as e:
        logger.critical(f"Startup failed: {e}")
        raise e  # force crash → Railway shows proper error

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ---------- CORS & Router ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)