"""Iteration 2 backend tests:
- Product cantidad batch creation
- Sell with vendedor_id (sold_by / sold_by_name)
- /api/sales/stats per-member aggregation
- Group roles: creator vs admin_total vs admin_menor vs member
- Members list, role updates, member removal, group deletion
- Incidents PUT/DELETE permissions
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
    email = f"test_it2_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": PWD, "name": name})
    assert r.status_code == 200, r.text
    j = r.json()
    return j["session_token"], j["user"]


@pytest.fixture(scope="module")
def scenario():
    """Build a scenario:
    - creator (UserA) creates group
    - member (UserB) joins
    - member2 (UserC) joins
    """
    tok_a, user_a = _register("Creator A")
    r = requests.post(f"{API}/groups", json={"nombre_negocio": "TEST_IT2_Group"}, headers=_hdr(tok_a))
    assert r.status_code == 200, r.text
    code = r.json()["codigo_union"]

    tok_b, user_b = _register("Member B")
    r = requests.post(f"{API}/groups/join", json={"codigo_union": code}, headers=_hdr(tok_b))
    assert r.status_code == 200

    tok_c, user_c = _register("Member C")
    r = requests.post(f"{API}/groups/join", json={"codigo_union": code}, headers=_hdr(tok_c))
    assert r.status_code == 200

    return {
        "tok_a": tok_a, "user_a": user_a,
        "tok_b": tok_b, "user_b": user_b,
        "tok_c": tok_c, "user_c": user_c,
        "code": code,
    }


# ---- Roles assignment on create/join ----
def test_creator_role_assigned_on_create(scenario):
    r = requests.get(f"{API}/groups/members", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    members = r.json()
    me = next(m for m in members if m["user_id"] == scenario["user_a"]["user_id"])
    assert me["role"] == "creator"
    assert me["is_owner"] is True


def test_member_role_assigned_on_join(scenario):
    r = requests.get(f"{API}/groups/members", headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 200
    members = r.json()
    b = next(m for m in members if m["user_id"] == scenario["user_b"]["user_id"])
    assert b["role"] == "member"
    assert b["is_owner"] is False


# ---- Product cantidad ----
def test_create_products_batch(scenario):
    payload = {"nombre": "TEST_Batch", "precio_compra": 10.0, "cantidad": 3}
    r = requests.post(f"{API}/products", json=payload, headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["created"] == 3
    assert isinstance(j["products"], list) and len(j["products"]) == 3
    names = sorted([p["nombre"] for p in j["products"]])
    assert names == ["TEST_Batch #1", "TEST_Batch #2", "TEST_Batch #3"]
    for p in j["products"]:
        assert p["estado"] == "inventario"
        assert p["batch_total"] == 3
    scenario["batch_ids"] = [p["product_id"] for p in j["products"]]


def test_create_product_single_cantidad_one(scenario):
    r = requests.post(f"{API}/products", json={"nombre": "TEST_Single", "precio_compra": 5.0, "cantidad": 1},
                      headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    j = r.json()
    assert j["created"] == 1
    # When cantidad=1, name should not have suffix
    assert j["products"][0]["nombre"] == "TEST_Single"
    scenario["single_id"] = j["products"][0]["product_id"]


# ---- Sell with vendedor_id ----
def test_sell_with_vendedor_id(scenario):
    pid = scenario["batch_ids"][0]
    # User A (creator) sells, but assigns to UserB
    r = requests.put(f"{API}/products/{pid}/sell",
                     json={"precio_venta": 25.0, "vendedor_id": scenario["user_b"]["user_id"]},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["sold_by"] == scenario["user_b"]["user_id"]
    assert p["sold_by_name"] == scenario["user_b"]["name"]
    assert p["precio_venta"] == 25.0


def test_sell_without_vendedor_defaults_to_actor(scenario):
    pid = scenario["batch_ids"][1]
    r = requests.put(f"{API}/products/{pid}/sell",
                     json={"precio_venta": 30.0},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    p = r.json()
    assert p["sold_by"] == scenario["user_a"]["user_id"]


def test_sell_invalid_vendedor(scenario):
    pid = scenario["batch_ids"][2]
    r = requests.put(f"{API}/products/{pid}/sell",
                     json={"precio_venta": 20.0, "vendedor_id": "user_doesnotexist"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 400


# ---- Sales stats ----
def test_sales_stats_aggregation(scenario):
    # sell remaining single to UserC
    r = requests.put(f"{API}/products/{scenario['single_id']}/sell",
                     json={"precio_venta": 12.0, "vendedor_id": scenario["user_c"]["user_id"]},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200

    r = requests.get(f"{API}/sales/stats", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    members = r.json()["members"]
    # Three members should have sales: B(25), A(30), C(12)
    by_uid = {m["user_id"]: m for m in members}
    assert by_uid[scenario["user_a"]["user_id"]]["facturacion"] == 30.0
    assert by_uid[scenario["user_b"]["user_id"]]["facturacion"] == 25.0
    assert by_uid[scenario["user_c"]["user_id"]]["facturacion"] == 12.0
    # Sorted by facturacion desc
    facts = [m["facturacion"] for m in members]
    assert facts == sorted(facts, reverse=True)
    # Beneficio (precio_venta - precio_compra)
    assert by_uid[scenario["user_a"]["user_id"]]["beneficio"] == 20.0  # 30-10
    assert by_uid[scenario["user_b"]["user_id"]]["beneficio"] == 15.0  # 25-10
    assert by_uid[scenario["user_c"]["user_id"]]["beneficio"] == 7.0   # 12-5


# ---- Role management ----
def test_member_cannot_change_role(scenario):
    # User B (member) tries to change role
    r = requests.put(f"{API}/groups/members/{scenario['user_c']['user_id']}/role",
                     json={"role": "admin_total"},
                     headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


def test_creator_promotes_b_to_admin_total(scenario):
    r = requests.put(f"{API}/groups/members/{scenario['user_b']['user_id']}/role",
                     json={"role": "admin_total"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "admin_total"


def test_creator_promotes_c_to_admin_menor(scenario):
    r = requests.put(f"{API}/groups/members/{scenario['user_c']['user_id']}/role",
                     json={"role": "admin_menor"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200


def test_admin_total_cannot_promote_to_creator(scenario):
    # B is now admin_total, tries to promote C to creator
    r = requests.put(f"{API}/groups/members/{scenario['user_c']['user_id']}/role",
                     json={"role": "creator"},
                     headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


def test_admin_total_can_change_member_roles(scenario):
    # B (admin_total) changes C from admin_menor to member
    r = requests.put(f"{API}/groups/members/{scenario['user_c']['user_id']}/role",
                     json={"role": "member"},
                     headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 200
    # change back to admin_menor for later tests
    r = requests.put(f"{API}/groups/members/{scenario['user_c']['user_id']}/role",
                     json={"role": "admin_menor"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200


def test_cannot_change_own_role(scenario):
    r = requests.put(f"{API}/groups/members/{scenario['user_a']['user_id']}/role",
                     json={"role": "admin_total"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 400


def test_admin_total_cannot_change_creator_role(scenario):
    # B (admin_total) tries to demote creator A
    r = requests.put(f"{API}/groups/members/{scenario['user_a']['user_id']}/role",
                     json={"role": "member"},
                     headers=_hdr(scenario["tok_b"]))
    # actor cannot change own role would return 400, but A != B so it should be 403 (target is creator)
    assert r.status_code == 403


def test_invalid_role_value(scenario):
    r = requests.put(f"{API}/groups/members/{scenario['user_c']['user_id']}/role",
                     json={"role": "superuser"},
                     headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 400


# ---- Incidents permissions ----
def test_create_incidencia_for_perms(scenario):
    # create + sell + incidencia
    r = requests.post(f"{API}/products", json={"nombre": "TEST_IncProd", "precio_compra": 5.0},
                      headers=_hdr(scenario["tok_a"]))
    pid = r.json()["products"][0]["product_id"]
    requests.put(f"{API}/products/{pid}/sell",
                 json={"precio_venta": 15.0}, headers=_hdr(scenario["tok_a"]))
    r = requests.post(f"{API}/products/{pid}/incidencia",
                     json={"motivo": "Original"}, headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200
    scenario["inc_id"] = r.json()["incidencia_id"]


def test_admin_menor_can_edit_incidencia(scenario):
    # C is admin_menor
    r = requests.put(f"{API}/incidents/{scenario['inc_id']}",
                     json={"motivo": "Edited by admin_menor"},
                     headers=_hdr(scenario["tok_c"]))
    assert r.status_code == 200
    assert r.json()["motivo"] == "Edited by admin_menor"


def test_member_cannot_edit_incidencia(scenario):
    # promote a fresh member to test - register new
    tok_d, user_d = _register("Member D")
    requests.post(f"{API}/groups/join", json={"codigo_union": scenario["code"]}, headers=_hdr(tok_d))
    scenario["tok_d"] = tok_d
    scenario["user_d"] = user_d
    r = requests.put(f"{API}/incidents/{scenario['inc_id']}",
                     json={"motivo": "Hack"}, headers=_hdr(tok_d))
    assert r.status_code == 403


def test_member_cannot_delete_incidencia(scenario):
    r = requests.delete(f"{API}/incidents/{scenario['inc_id']}", headers=_hdr(scenario["tok_d"]))
    assert r.status_code == 403


def test_admin_total_can_delete_incidencia(scenario):
    # create another to delete
    r = requests.post(f"{API}/products", json={"nombre": "TEST_IncDel", "precio_compra": 1.0},
                      headers=_hdr(scenario["tok_a"]))
    pid = r.json()["products"][0]["product_id"]
    requests.put(f"{API}/products/{pid}/sell", json={"precio_venta": 5.0}, headers=_hdr(scenario["tok_a"]))
    r = requests.post(f"{API}/products/{pid}/incidencia", json={"motivo": "DelMe"},
                     headers=_hdr(scenario["tok_a"]))
    inc_id = r.json()["incidencia_id"]
    # B is admin_total
    r = requests.delete(f"{API}/incidents/{inc_id}", headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 200


# ---- Member removal ----
def test_member_cannot_remove_others(scenario):
    r = requests.delete(f"{API}/groups/members/{scenario['user_c']['user_id']}",
                        headers=_hdr(scenario["tok_d"]))
    assert r.status_code == 403


def test_cannot_remove_self(scenario):
    r = requests.delete(f"{API}/groups/members/{scenario['user_a']['user_id']}",
                        headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 400


def test_admin_total_cannot_remove_creator(scenario):
    r = requests.delete(f"{API}/groups/members/{scenario['user_a']['user_id']}",
                        headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


def test_admin_total_removes_member(scenario):
    # B removes D
    r = requests.delete(f"{API}/groups/members/{scenario['user_d']['user_id']}",
                        headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 200
    # D no longer in members
    r = requests.get(f"{API}/groups/members", headers=_hdr(scenario["tok_a"]))
    ids = [m["user_id"] for m in r.json()]
    assert scenario["user_d"]["user_id"] not in ids


# ---- Delete group ----
def test_admin_total_cannot_delete_group(scenario):
    r = requests.delete(f"{API}/groups", headers=_hdr(scenario["tok_b"]))
    assert r.status_code == 403


def test_creator_deletes_group_cascades(scenario):
    code = scenario["code"]
    r = requests.delete(f"{API}/groups", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 200, r.text
    # group gone -> /groups/me => 404
    r = requests.get(f"{API}/groups/me", headers=_hdr(scenario["tok_a"]))
    assert r.status_code == 404
    # users codigo_grupo cleared -> joining same code returns 404
    tok_e, _ = _register("E")
    r = requests.post(f"{API}/groups/join", json={"codigo_union": code}, headers=_hdr(tok_e))
    assert r.status_code == 404
