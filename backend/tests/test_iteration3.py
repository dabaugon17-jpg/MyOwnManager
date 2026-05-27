"""Iteration 3 backend tests:
- PUT /api/groups (nombre_negocio + objetivo_mensual) creator/admin_total OK, member 403
- GET /api/groups/me returns objetivo_mensual
- POST /api/products with categoria (default 'Otros')
- PUT /api/products/{id} updates nombre/precio_compra/categoria; 403 for admin_menor/member
- DELETE /api/products/{id} 403 for admin_menor/member; OK for creator/admin_total
- GET /api/sales/export.csv CSV + Content-Disposition
- GET /api/dashboard new fields: stock_value/stock_count/facturacion_mes/ventas_mes/objetivo_mensual/progreso_pct/vendedor_id
- GET /api/dashboard?vendedor_id=... filters facturacion/beneficio/chart
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"
PWD = "password123"


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _register(name="User"):
    email = f"test_it3_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": PWD, "name": name})
    assert r.status_code == 200, r.text
    j = r.json()
    return j["session_token"], j["user"]


@pytest.fixture(scope="module")
def scenario():
    """Creator A + Member B + admin_menor C + admin_total D"""
    tok_a, user_a = _register("Creator A")
    r = requests.post(f"{API}/groups", json={"nombre_negocio": "TEST_IT3_Group"}, headers=_hdr(tok_a))
    assert r.status_code == 200, r.text
    code = r.json()["codigo_union"]

    tok_b, user_b = _register("Member B")
    requests.post(f"{API}/groups/join", json={"codigo_union": code}, headers=_hdr(tok_b))

    tok_c, user_c = _register("AdminMenor C")
    requests.post(f"{API}/groups/join", json={"codigo_union": code}, headers=_hdr(tok_c))
    # promote C to admin_menor
    requests.put(f"{API}/groups/members/{user_c['user_id']}/role",
                 json={"role": "admin_menor"}, headers=_hdr(tok_a))

    tok_d, user_d = _register("AdminTotal D")
    requests.post(f"{API}/groups/join", json={"codigo_union": code}, headers=_hdr(tok_d))
    requests.put(f"{API}/groups/members/{user_d['user_id']}/role",
                 json={"role": "admin_total"}, headers=_hdr(tok_a))

    return {
        "tok_a": tok_a, "user_a": user_a,
        "tok_b": tok_b, "user_b": user_b,
        "tok_c": tok_c, "user_c": user_c,
        "tok_d": tok_d, "user_d": user_d,
        "code": code,
    }


# ---------- PUT /groups ----------
def test_creator_updates_group_name_and_objetivo(scenario):
    r = requests.put(f"{API}/groups",
                     json={"nombre_negocio": "TEST_IT3_Group_v2", "objetivo_mensual": 1000.0},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["nombre_negocio"] == "TEST_IT3_Group_v2"
    assert j["objetivo_mensual"] == 1000.0


def test_groups_me_returns_objetivo(scenario):
    r = requests.get(f"{API}/groups/me", headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 200
    assert r.json().get("objetivo_mensual") == 1000.0


def test_admin_total_updates_group(scenario):
    r = requests.put(f"{API}/groups",
                     json={"objetivo_mensual": 1500.0},
                     headers=_hdr(scenario["tok_d"]))
    assert r.status_code == 200
    assert r.json()["objetivo_mensual"] == 1500.0


def test_admin_menor_cannot_update_group(scenario):
    r = requests.put(f"{API}/groups",
                     json={"objetivo_mensual": 9999.0},
                     headers=_hdr(scenario["tok_c"]))
    assert r.status_code == 403


def test_member_cannot_update_group(scenario):
    r = requests.put(f"{API}/groups",
                     json={"objetivo_mensual": 9999.0},
                     headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


# ---------- POST /products with categoria ----------
def test_create_product_with_categoria(scenario):
    r = requests.post(f"{API}/products",
                      json={"nombre": "TEST_Bag", "precio_compra": 20.0, "cantidad": 2, "categoria": "Bolsos"},
                      headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    products = r.json()["products"]
    assert len(products) == 2
    for p in products:
        assert p["categoria"] == "Bolsos"
    scenario["bag_ids"] = [p["product_id"] for p in products]


def test_create_product_default_categoria(scenario):
    r = requests.post(f"{API}/products",
                      json={"nombre": "TEST_NoCat", "precio_compra": 5.0},
                      headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    p = r.json()["products"][0]
    assert p["categoria"] == "Otros"
    scenario["nocat_id"] = p["product_id"]


# ---------- PUT /products/{id} ----------
def test_admin_total_updates_product(scenario):
    pid = scenario["bag_ids"][0]
    r = requests.put(f"{API}/products/{pid}",
                     json={"nombre": "TEST_Bag_Updated", "precio_compra": 25.0, "categoria": "Moda"},
                     headers=_hdr(scenario["tok_d"]))
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["nombre"] == "TEST_Bag_Updated"
    assert p["precio_compra"] == 25.0
    assert p["categoria"] == "Moda"


def test_creator_updates_product(scenario):
    pid = scenario["bag_ids"][1]
    r = requests.put(f"{API}/products/{pid}",
                     json={"categoria": "Joyería"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    assert r.json()["categoria"] == "Joyería"


def test_admin_menor_cannot_update_product(scenario):
    pid = scenario["bag_ids"][0]
    r = requests.put(f"{API}/products/{pid}",
                     json={"nombre": "Hacked"},
                     headers=_hdr(scenario["tok_c"]))
    assert r.status_code == 403


def test_member_cannot_update_product(scenario):
    pid = scenario["bag_ids"][0]
    r = requests.put(f"{API}/products/{pid}",
                     json={"nombre": "Hacked"},
                     headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


# ---------- DELETE /products/{id} permissions ----------
def test_admin_menor_cannot_delete_product(scenario):
    r = requests.delete(f"{API}/products/{scenario['nocat_id']}",
                        headers=_hdr(scenario["tok_c"]))
    assert r.status_code == 403


def test_member_cannot_delete_product(scenario):
    r = requests.delete(f"{API}/products/{scenario['nocat_id']}",
                        headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


def test_admin_total_can_delete_product(scenario):
    # Create a throwaway to delete
    r = requests.post(f"{API}/products",
                      json={"nombre": "TEST_Del", "precio_compra": 1.0},
                      headers=_hdr(scenario["tok_a"]))
    pid = r.json()["products"][0]["product_id"]
    r = requests.delete(f"{API}/products/{pid}", headers=_hdr(scenario["tok_d"]))
    assert r.status_code == 200


def test_creator_can_delete_product(scenario):
    r = requests.delete(f"{API}/products/{scenario['nocat_id']}",
                        headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200


# ---------- Dashboard new fields ----------
def _create_sold_product(scenario, vendedor_id, precio_venta=50.0, precio_compra=10.0):
    r = requests.post(f"{API}/products",
                      json={"nombre": "TEST_Sold", "precio_compra": precio_compra, "categoria": "Electrónica"},
                      headers=_hdr(scenario["tok_a"]))
    pid = r.json()["products"][0]["product_id"]
    r = requests.put(f"{API}/products/{pid}/sell",
                     json={"precio_venta": precio_venta, "vendedor_id": vendedor_id},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    return pid


def test_dashboard_new_fields_present(scenario):
    # Sell some products: B sells 50, D sells 30
    _create_sold_product(scenario, scenario["user_b"]["user_id"], 50.0, 10.0)
    _create_sold_product(scenario, scenario["user_d"]["user_id"], 30.0, 10.0)

    r = requests.get(f"{API}/dashboard", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    d = r.json()
    # New fields exist
    for k in ("stock_value", "stock_count", "facturacion_mes", "ventas_mes",
              "objetivo_mensual", "progreso_pct", "vendedor_id"):
        assert k in d, f"missing field {k}"
    assert d["objetivo_mensual"] == 1500.0
    assert d["vendedor_id"] is None
    # facturacion_mes should include both sales (50+30=80) — assuming tests run in current month
    assert d["facturacion_mes"] >= 80.0
    assert d["ventas_mes"] >= 2
    # progreso_pct should be facturacion_mes / 1500 * 100
    assert d["progreso_pct"] > 0
    scenario["dashboard_total_facturacion"] = d["facturacion_total"]
    scenario["dashboard_inversion"] = d["inversion"]
    scenario["dashboard_stock_value"] = d["stock_value"]


def test_dashboard_vendor_filter(scenario):
    uid_b = scenario["user_b"]["user_id"]
    r = requests.get(f"{API}/dashboard", params={"vendedor_id": uid_b}, headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    d = r.json()
    assert d["vendedor_id"] == uid_b
    # Filtered facturacion should equal only B's sales (>=50, less than total)
    assert d["facturacion_total"] >= 50.0
    assert d["facturacion_total"] < scenario["dashboard_total_facturacion"]
    # inversion and stock_value should remain group-level (unchanged)
    assert d["inversion"] == scenario["dashboard_inversion"]
    assert d["stock_value"] == scenario["dashboard_stock_value"]


# ---------- CSV export ----------
def test_export_sales_csv(scenario):
    r = requests.get(f"{API}/sales/export.csv", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    cd = r.headers.get("Content-Disposition", "")
    assert "attachment" in cd
    assert "ventas.csv" in cd
    body = r.text
    lines = body.strip().split("\n")
    header = lines[0]
    for col in ("Fecha", "Producto", "Categoría", "Precio compra", "Precio venta", "Beneficio", "Vendedor"):
        assert col in header, f"missing column {col} in header: {header}"
    # at least the rows from the sold products we created above
    assert len(lines) >= 3  # header + 2 sales


# ---------- Cleanup ----------
def test_cleanup_delete_group(scenario):
    r = requests.delete(f"{API}/groups", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
