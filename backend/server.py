from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query, UploadFile, File, Form, Cookie, Response, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import random
import string
import secrets
import requests
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "inventario-app"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
storage_key: Optional[str] = None

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------- Storage helpers -----------------
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ----------------- Models -----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CreateGroupIn(BaseModel):
    nombre_negocio: str


class JoinGroupIn(BaseModel):
    codigo_union: str


class ProductCreateIn(BaseModel):
    nombre: str
    precio_compra: float
    foto_url: Optional[str] = None
    file_id: Optional[str] = None
    cantidad: int = 1


class SellIn(BaseModel):
    precio_venta: float
    vendedor_id: Optional[str] = None


class IncidenciaIn(BaseModel):
    motivo: str


class IncidenciaUpdateIn(BaseModel):
    motivo: str


class RoleUpdateIn(BaseModel):
    role: str  # creator | admin_total | admin_menor | member


VALID_ROLES = {"creator", "admin_total", "admin_menor", "member"}


# ----------------- Auth helpers -----------------
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode(), hashed.encode())
    except Exception:
        return False


def gen_token() -> str:
    return secrets.token_urlsafe(32)


def gen_code(n: int = 6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=n))


async def create_session(user_id: str) -> str:
    token = gen_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token", value=token, httponly=True,
        secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )


# ----------------- Auth endpoints -----------------
@api_router.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": payload.email.lower(),
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "picture": None,
        "codigo_grupo": None,
        "auth_provider": "password",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = await create_session(user_id)
    set_session_cookie(response, token)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"session_token": token, "user": user_doc}


@api_router.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"session_token": token, "user": user}


@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id requerido")
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Emergent session-data error: {e}")
        raise HTTPException(status_code=401, detail="OAuth session inválida")

    email = data.get("email", "").lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "codigo_grupo": None,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data.get("session_token") or gen_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    set_session_cookie(response, session_token)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ----------------- Groups -----------------
@api_router.post("/groups")
async def create_group(payload: CreateGroupIn, user: dict = Depends(get_current_user)):
    if user.get("codigo_grupo"):
        raise HTTPException(status_code=400, detail="Ya perteneces a un grupo")
    code = gen_code(6)
    while await db.grupos.find_one({"codigo_union": code}):
        code = gen_code(6)
    group_doc = {
        "group_id": f"grp_{uuid.uuid4().hex[:10]}",
        "nombre_negocio": payload.nombre_negocio,
        "codigo_union": code,
        "admin_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.grupos.insert_one(group_doc)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"codigo_grupo": code, "role": "creator"}},
    )
    group_doc.pop("_id", None)
    return group_doc


@api_router.post("/groups/join")
async def join_group(payload: JoinGroupIn, user: dict = Depends(get_current_user)):
    if user.get("codigo_grupo"):
        raise HTTPException(status_code=400, detail="Ya perteneces a un grupo")
    group = await db.grupos.find_one({"codigo_union": payload.codigo_union.upper().strip()}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Código de grupo no encontrado")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"codigo_grupo": group["codigo_union"], "role": "member"}},
    )
    return group


@api_router.get("/groups/me")
async def my_group(user: dict = Depends(get_current_user)):
    if not user.get("codigo_grupo"):
        raise HTTPException(status_code=404, detail="Sin grupo")
    group = await db.grupos.find_one({"codigo_union": user["codigo_grupo"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return group


def require_group(user: dict) -> str:
    if not user.get("codigo_grupo"):
        raise HTTPException(status_code=400, detail="Debes unirte o crear un grupo")
    return user["codigo_grupo"]


def get_role(user: dict) -> str:
    return user.get("role") or "member"


def can_edit_incidencias(role: str) -> bool:
    return role in ("creator", "admin_total", "admin_menor")


def can_manage_members(role: str) -> bool:
    return role in ("creator", "admin_total")


# ----------------- Members management -----------------
@api_router.get("/groups/members")
async def list_members(user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    members = await db.users.find(
        {"codigo_grupo": grupo},
        {"_id": 0, "password_hash": 0},
    ).to_list(500)
    group = await db.grupos.find_one({"codigo_union": grupo}, {"_id": 0})
    creator_id = group.get("admin_id") if group else None
    for m in members:
        m["role"] = m.get("role") or "member"
        m["is_owner"] = (m["user_id"] == creator_id)
    return members


@api_router.put("/groups/members/{user_id}/role")
async def update_member_role(user_id: str, payload: RoleUpdateIn, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rol inválido")
    actor_role = get_role(user)
    if not can_manage_members(actor_role):
        raise HTTPException(status_code=403, detail="Sin permisos para gestionar miembros")
    target = await db.users.find_one({"user_id": user_id, "codigo_grupo": grupo}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    if target["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol")
    # Only creator can promote to creator
    if payload.role == "creator" and actor_role != "creator":
        raise HTTPException(status_code=403, detail="Solo el creador puede nombrar a otro creador")
    # Only creator can demote a creator
    if target.get("role") == "creator" and actor_role != "creator":
        raise HTTPException(status_code=403, detail="Solo otro creador puede cambiar el rol del creador")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": payload.role}})
    return {"ok": True, "user_id": user_id, "role": payload.role}


@api_router.delete("/groups/members/{user_id}")
async def remove_member(user_id: str, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    actor_role = get_role(user)
    if not can_manage_members(actor_role):
        raise HTTPException(status_code=403, detail="Sin permisos")
    target = await db.users.find_one({"user_id": user_id, "codigo_grupo": grupo}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    if target["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    if target.get("role") == "creator" and actor_role != "creator":
        raise HTTPException(status_code=403, detail="Solo otro creador puede expulsar a un creador")
    await db.users.update_one({"user_id": user_id}, {"$set": {"codigo_grupo": None, "role": None}})
    return {"ok": True}


@api_router.delete("/groups")
async def delete_group(user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    group = await db.grupos.find_one({"codigo_union": grupo}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if group.get("admin_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Solo el creador original puede eliminar el grupo")
    # Cascade delete
    await db.productos.delete_many({"codigo_grupo": grupo})
    await db.incidencias.delete_many({"codigo_grupo": grupo})
    await db.users.update_many({"codigo_grupo": grupo}, {"$set": {"codigo_grupo": None, "role": None}})
    await db.grupos.delete_one({"codigo_union": grupo})
    return {"ok": True}


# ----------------- Files -----------------
@api_router.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado")
    file_id = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{user['user_id']}/{file_id}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or f"image/{ext}")
    rec = {
        "file_id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size"),
        "owner_id": user["user_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(rec)
    return {"file_id": file_id, "url": f"/api/files/{file_id}"}


@api_router.get("/files/{file_id}")
async def get_file(file_id: str, auth: Optional[str] = Query(None), request: Request = None):
    # Auth via header or query param
    token = request.cookies.get("session_token") if request else None
    if not token and auth:
        token = auth
    if not token:
        ah = request.headers.get("Authorization") if request else None
        if ah and ah.lower().startswith("bearer "):
            token = ah.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="No auth")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    data, ctype = get_object(rec["storage_path"])
    return StreamingResponse(io.BytesIO(data), media_type=rec.get("content_type") or ctype)


# ----------------- Products -----------------
def clean(doc):
    doc.pop("_id", None)
    return doc


@api_router.get("/products")
async def list_products(estado: Optional[str] = None, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    q = {"codigo_grupo": grupo}
    if estado:
        q["estado"] = estado
    docs = await db.productos.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api_router.post("/products")
async def create_product(payload: ProductCreateIn, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    foto_url = payload.foto_url
    if payload.file_id:
        foto_url = f"/api/files/{payload.file_id}"
    cantidad = max(1, min(int(payload.cantidad or 1), 500))
    now = datetime.now(timezone.utc).isoformat()
    created = []
    for i in range(1, cantidad + 1):
        name = payload.nombre if cantidad == 1 else f"{payload.nombre} #{i}"
        doc = {
            "product_id": f"prod_{uuid.uuid4().hex[:10]}",
            "nombre": name,
            "precio_compra": float(payload.precio_compra),
            "precio_venta": None,
            "estado": "inventario",
            "foto_url": foto_url,
            "file_id": payload.file_id,
            "codigo_grupo": grupo,
            "created_by": user["user_id"],
            "created_at": now,
            "sold_at": None,
            "batch_index": i,
            "batch_total": cantidad,
        }
        await db.productos.insert_one(doc)
        created.append(clean(dict(doc)))
    return {"created": len(created), "products": created}


@api_router.put("/products/{product_id}/sell")
async def sell_product(product_id: str, payload: SellIn, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    prod = await db.productos.find_one({"product_id": product_id, "codigo_grupo": grupo})
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if prod["estado"] != "inventario":
        raise HTTPException(status_code=400, detail="Producto no disponible")
    vendedor_id = payload.vendedor_id or user["user_id"]
    vendedor = await db.users.find_one({"user_id": vendedor_id, "codigo_grupo": grupo}, {"_id": 0})
    if not vendedor:
        raise HTTPException(status_code=400, detail="Vendedor no encontrado en el grupo")
    now = datetime.now(timezone.utc).isoformat()
    await db.productos.update_one(
        {"product_id": product_id},
        {"$set": {
            "estado": "vendido",
            "precio_venta": float(payload.precio_venta),
            "sold_at": now,
            "sold_by": vendedor_id,
            "sold_by_name": vendedor.get("name"),
            "registered_by": user["user_id"],
        }},
    )
    prod = await db.productos.find_one({"product_id": product_id}, {"_id": 0})
    return prod


@api_router.post("/products/{product_id}/incidencia")
async def mark_incidencia(product_id: str, payload: IncidenciaIn, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    prod = await db.productos.find_one({"product_id": product_id, "codigo_grupo": grupo})
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    now = datetime.now(timezone.utc).isoformat()
    incidencia = {
        "incidencia_id": f"inc_{uuid.uuid4().hex[:10]}",
        "product_id": product_id,
        "codigo_grupo": grupo,
        "motivo": payload.motivo,
        "producto_nombre": prod["nombre"],
        "precio_venta": prod.get("precio_venta"),
        "created_by": user["user_id"],
        "created_at": now,
    }
    await db.incidencias.insert_one(incidencia)
    await db.productos.update_one({"product_id": product_id}, {"$set": {"estado": "incidencia"}})
    return clean(incidencia)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    res = await db.productos.delete_one({"product_id": product_id, "codigo_grupo": grupo})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"ok": True}


# ----------------- Sales / Incidents -----------------
@api_router.get("/sales")
async def list_sales(user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    docs = await db.productos.find(
        {"codigo_grupo": grupo, "estado": "vendido"}, {"_id": 0}
    ).sort("sold_at", -1).to_list(2000)
    return docs


@api_router.get("/sales/stats")
async def sales_stats(user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    sold = await db.productos.find(
        {"codigo_grupo": grupo, "estado": "vendido"}, {"_id": 0}
    ).to_list(5000)
    by_member: dict = {}
    for p in sold:
        uid = p.get("sold_by") or "unknown"
        name = p.get("sold_by_name") or "Sin nombre"
        if uid not in by_member:
            by_member[uid] = {
                "user_id": uid, "name": name,
                "ventas": 0, "facturacion": 0.0, "beneficio": 0.0,
            }
        by_member[uid]["ventas"] += 1
        by_member[uid]["facturacion"] += p.get("precio_venta") or 0
        by_member[uid]["beneficio"] += (p.get("precio_venta") or 0) - (p.get("precio_compra") or 0)
    members = list(by_member.values())
    for m in members:
        m["facturacion"] = round(m["facturacion"], 2)
        m["beneficio"] = round(m["beneficio"], 2)
    members.sort(key=lambda x: x["facturacion"], reverse=True)
    return {"members": members}


@api_router.get("/incidents")
async def list_incidents(user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    docs = await db.incidencias.find({"codigo_grupo": grupo}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api_router.put("/incidents/{incidencia_id}")
async def update_incident(incidencia_id: str, payload: IncidenciaUpdateIn, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    if not can_edit_incidencias(get_role(user)):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar incidencias")
    inc = await db.incidencias.find_one({"incidencia_id": incidencia_id, "codigo_grupo": grupo})
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    await db.incidencias.update_one(
        {"incidencia_id": incidencia_id},
        {"$set": {"motivo": payload.motivo, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user["user_id"]}},
    )
    inc = await db.incidencias.find_one({"incidencia_id": incidencia_id}, {"_id": 0})
    return inc


@api_router.delete("/incidents/{incidencia_id}")
async def delete_incident(incidencia_id: str, user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    if not can_edit_incidencias(get_role(user)):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar incidencias")
    res = await db.incidencias.delete_one({"incidencia_id": incidencia_id, "codigo_grupo": grupo})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return {"ok": True}


# ----------------- Dashboard -----------------
@api_router.get("/dashboard")
async def dashboard(filter: str = "month", user: dict = Depends(get_current_user)):
    grupo = require_group(user)
    # totals over all products
    all_products = await db.productos.find({"codigo_grupo": grupo}, {"_id": 0}).to_list(5000)
    facturacion_total = sum((p.get("precio_venta") or 0) for p in all_products if p.get("estado") == "vendido")
    inversion = sum((p.get("precio_compra") or 0) for p in all_products)
    coste_vendidos = sum((p.get("precio_compra") or 0) for p in all_products if p.get("estado") == "vendido")
    beneficio_neto = facturacion_total - coste_vendidos

    # chart series
    now = datetime.now(timezone.utc)
    buckets = []
    if filter == "day":
        # last 7 days
        for i in range(6, -1, -1):
            d = (now - timedelta(days=i)).date()
            label = d.strftime("%d/%m")
            total = 0.0
            for p in all_products:
                if p.get("estado") == "vendido" and p.get("sold_at"):
                    sd = datetime.fromisoformat(p["sold_at"]).date()
                    if sd == d:
                        total += p.get("precio_venta") or 0
            buckets.append({"label": label, "value": round(total, 2)})
    elif filter == "week":
        for i in range(7, -1, -1):
            start = now - timedelta(weeks=i)
            wk_start = start - timedelta(days=start.weekday())
            wk_end = wk_start + timedelta(days=7)
            label = f"S{wk_start.isocalendar()[1]}"
            total = 0.0
            for p in all_products:
                if p.get("estado") == "vendido" and p.get("sold_at"):
                    sd = datetime.fromisoformat(p["sold_at"])
                    if sd.tzinfo is None:
                        sd = sd.replace(tzinfo=timezone.utc)
                    if wk_start.replace(tzinfo=timezone.utc) <= sd < wk_end.replace(tzinfo=timezone.utc):
                        total += p.get("precio_venta") or 0
            buckets.append({"label": label, "value": round(total, 2)})
    elif filter == "year":
        for i in range(4, -1, -1):
            y = now.year - i
            label = str(y)
            total = 0.0
            for p in all_products:
                if p.get("estado") == "vendido" and p.get("sold_at"):
                    sd = datetime.fromisoformat(p["sold_at"])
                    if sd.year == y:
                        total += p.get("precio_venta") or 0
            buckets.append({"label": label, "value": round(total, 2)})
    else:  # month
        labels_es = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
        for i in range(11, -1, -1):
            # compute month i months back
            year = now.year
            month = now.month - i
            while month <= 0:
                month += 12
                year -= 1
            label = labels_es[month - 1]
            total = 0.0
            for p in all_products:
                if p.get("estado") == "vendido" and p.get("sold_at"):
                    sd = datetime.fromisoformat(p["sold_at"])
                    if sd.year == year and sd.month == month:
                        total += p.get("precio_venta") or 0
            buckets.append({"label": label, "value": round(total, 2)})

    return {
        "facturacion_total": round(facturacion_total, 2),
        "beneficio_neto": round(beneficio_neto, 2),
        "inversion": round(inversion, 2),
        "chart": buckets,
        "filter": filter,
    }


# ----------------- Health -----------------
@api_router.get("/")
async def root():
    return {"message": "Inventario API OK"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Startup storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
