"""Backend API tests for Inventario app - covers auth, groups, products, sales, incidents, dashboard."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sales-dashboard-532.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

EMAIL_A = f"test_a_{uuid.uuid4().hex[:8]}@test.com"
EMAIL_B = f"test_b_{uuid.uuid4().hex[:8]}@test.com"
PWD = "password123"

state = {}


# ---- Health ----
def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# ---- Auth ----
def test_register_user_a():
    r = requests.post(f"{API}/auth/register", json={"email": EMAIL_A, "password": PWD, "name": "User A"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "session_token" in j and j["user"]["email"] == EMAIL_A
    state["token_a"] = j["session_token"]
    state["user_a"] = j["user"]


def test_register_duplicate_email():
    r = requests.post(f"{API}/auth/register", json={"email": EMAIL_A, "password": PWD, "name": "Dup"})
    assert r.status_code == 400


def test_login_user_a():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL_A, "password": PWD})
    assert r.status_code == 200
    assert "session_token" in r.json()


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL_A, "password": "wrong"})
    assert r.status_code == 401


def test_auth_me():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.get(f"{API}/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL_A


def test_auth_me_unauth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---- Groups ----
def test_create_group():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.post(f"{API}/groups", json={"nombre_negocio": "TEST_Negocio"}, headers=h)
    assert r.status_code == 200, r.text
    g = r.json()
    assert len(g["codigo_union"]) == 6
    state["codigo_union"] = g["codigo_union"]


def test_groups_me():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.get(f"{API}/groups/me", headers=h)
    assert r.status_code == 200
    assert r.json()["codigo_union"] == state["codigo_union"]


def test_create_group_already_in():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.post(f"{API}/groups", json={"nombre_negocio": "X"}, headers=h)
    assert r.status_code == 400


def test_join_group_user_b():
    r = requests.post(f"{API}/auth/register", json={"email": EMAIL_B, "password": PWD, "name": "User B"})
    assert r.status_code == 200
    state["token_b"] = r.json()["session_token"]
    h = {"Authorization": f"Bearer {state['token_b']}"}
    r = requests.post(f"{API}/groups/join", json={"codigo_union": state["codigo_union"]}, headers=h)
    assert r.status_code == 200


def test_join_group_invalid():
    h = {"Authorization": f"Bearer {state['token_b']}"}
    # already in group -> 400; need fresh user for true 404 test
    email_c = f"test_c_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register", json={"email": email_c, "password": PWD, "name": "C"})
    tok = r.json()["session_token"]
    h2 = {"Authorization": f"Bearer {tok}"}
    r = requests.post(f"{API}/groups/join", json={"codigo_union": "ZZZZZZ"}, headers=h2)
    assert r.status_code == 404


# ---- Files ----
def test_file_upload():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    # 1x1 PNG
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000000500010d0a2db40000000049454e44ae426082")
    files = {"file": ("t.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{API}/files/upload", files=files, headers=h)
    if r.status_code != 200:
        pytest.skip(f"Object storage unavailable: {r.status_code} {r.text}")
    j = r.json()
    assert "file_id" in j and j["url"].startswith("/api/files/")
    state["file_id"] = j["file_id"]


def test_file_get():
    if "file_id" not in state:
        pytest.skip("no file uploaded")
    r = requests.get(f"{API}/files/{state['file_id']}?auth={state['token_a']}")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")


# ---- Products ----
def test_create_product():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    payload = {"nombre": "TEST_Prod1", "precio_compra": 10.0}
    if "file_id" in state:
        payload["file_id"] = state["file_id"]
    r = requests.post(f"{API}/products", json=payload, headers=h)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["created"] == 1
    p = j["products"][0]
    assert p["estado"] == "inventario"
    assert p["precio_compra"] == 10.0
    state["product_id"] = p["product_id"]


def test_list_products_inventario():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.get(f"{API}/products?estado=inventario", headers=h)
    assert r.status_code == 200
    ids = [p["product_id"] for p in r.json()]
    assert state["product_id"] in ids


def test_sell_product():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.put(f"{API}/products/{state['product_id']}/sell", json={"precio_venta": 25.0}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "vendido"
    assert r.json()["precio_venta"] == 25.0


def test_sales_list():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.get(f"{API}/sales", headers=h)
    assert r.status_code == 200
    assert any(p["product_id"] == state["product_id"] for p in r.json())


def test_sell_again_fails():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.put(f"{API}/products/{state['product_id']}/sell", json={"precio_venta": 30.0}, headers=h)
    assert r.status_code == 400


def test_incidencia_create():
    # create a 2nd product, sell, then mark incidencia
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.post(f"{API}/products", json={"nombre": "TEST_Prod2", "precio_compra": 5.0}, headers=h)
    pid = r.json()["products"][0]["product_id"]
    requests.put(f"{API}/products/{pid}/sell", json={"precio_venta": 12.0}, headers=h)
    r = requests.post(f"{API}/products/{pid}/incidencia", json={"motivo": "Defecto"}, headers=h)
    assert r.status_code == 200
    assert r.json()["motivo"] == "Defecto"


def test_incidents_list():
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.get(f"{API}/incidents", headers=h)
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ---- Dashboard ----
@pytest.mark.parametrize("flt,expected_count", [("day", 7), ("week", 8), ("month", 12), ("year", 5)])
def test_dashboard_filters(flt, expected_count):
    h = {"Authorization": f"Bearer {state['token_a']}"}
    r = requests.get(f"{API}/dashboard?filter={flt}", headers=h)
    assert r.status_code == 200
    d = r.json()
    assert "facturacion_total" in d and "beneficio_neto" in d and "inversion" in d
    assert len(d["chart"]) == expected_count
    assert d["facturacion_total"] >= 25.0  # at least one sale


# ---- Logout ----
def test_logout():
    h = {"Authorization": f"Bearer {state['token_b']}"}
    r = requests.post(f"{API}/auth/logout", headers=h)
    assert r.status_code == 200
    r = requests.get(f"{API}/auth/me", headers=h)
    assert r.status_code == 401
