#!/usr/bin/env python3
"""
Backend Auth API Tests for Spanish Inventory App
Tests all auth endpoints with MongoDB + bcrypt + sessions
"""
import requests
import random
import string
import sys

# Get base URL from frontend .env
BASE_URL = "https://web-funcional-4.preview.emergentagent.com/api"

def random_email():
    """Generate random email for testing"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{rand}@test.com"

def print_test(num, desc):
    """Print test header"""
    print(f"\n{'='*70}")
    print(f"TEST {num}: {desc}")
    print('='*70)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

# Track test results
results = []

# Test 1: Register new user
print_test(1, "POST /auth/register - Create new user")
email1 = random_email()
password1 = "secret123"
name1 = "Test User"

try:
    resp = requests.post(
        f"{BASE_URL}/auth/register",
        json={"email": email1, "password": password1, "name": name1},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    
    if resp.status_code == 200:
        data = resp.json()
        session_token1 = data.get("session_token")
        user1 = data.get("user")
        
        checks = []
        checks.append(("session_token exists", session_token1 is not None and len(session_token1) > 0))
        checks.append(("user object exists", user1 is not None))
        checks.append(("user_id exists", user1.get("user_id") is not None if user1 else False))
        checks.append(("email matches", user1.get("email") == email1.lower() if user1 else False))
        checks.append(("name matches", user1.get("name") == name1 if user1 else False))
        checks.append(("codigo_grupo is null", user1.get("codigo_grupo") is None if user1 else False))
        checks.append(("Set-Cookie header present", "set-cookie" in resp.headers or "Set-Cookie" in resp.headers))
        
        all_pass = all(check[1] for check in checks)
        for check_name, check_result in checks:
            print(f"  - {check_name}: {'✓' if check_result else '✗'}")
        
        results.append(print_result(all_pass, "Register creates user with session_token and sets cookie"))
    else:
        results.append(print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}"))
        session_token1 = None
        user1 = None
except Exception as e:
    results.append(print_result(False, f"Exception: {e}"))
    session_token1 = None
    user1 = None

# Test 2: Duplicate email registration
print_test(2, "POST /auth/register - Duplicate email should return 400")
try:
    resp = requests.post(
        f"{BASE_URL}/auth/register",
        json={"email": email1, "password": password1, "name": name1},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    
    if resp.status_code == 400:
        data = resp.json()
        detail = data.get("detail", "")
        if "ya registrado" in detail.lower():
            results.append(print_result(True, "Duplicate email returns 400 with 'Email ya registrado'"))
        else:
            results.append(print_result(False, f"Got 400 but wrong message: {detail}"))
    else:
        results.append(print_result(False, f"Expected 400, got {resp.status_code}"))
except Exception as e:
    results.append(print_result(False, f"Exception: {e}"))

# Test 3: Login with correct credentials
print_test(3, "POST /auth/login - Login with correct credentials")
try:
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email1, "password": password1},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    
    if resp.status_code == 200:
        data = resp.json()
        session_token_login = data.get("session_token")
        user_login = data.get("user")
        
        checks = []
        checks.append(("session_token exists", session_token_login is not None and len(session_token_login) > 0))
        checks.append(("user object exists", user_login is not None))
        checks.append(("email matches", user_login.get("email") == email1.lower() if user_login else False))
        
        all_pass = all(check[1] for check in checks)
        for check_name, check_result in checks:
            print(f"  - {check_name}: {'✓' if check_result else '✗'}")
        
        # Use this token for subsequent tests
        session_token1 = session_token_login
        results.append(print_result(all_pass, "Login returns new session_token and user"))
    else:
        results.append(print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}"))
except Exception as e:
    results.append(print_result(False, f"Exception: {e}"))

# Test 4: Login with wrong password
print_test(4, "POST /auth/login - Wrong password should return 401")
try:
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email1, "password": "wrongpassword123"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    
    if resp.status_code == 401:
        data = resp.json()
        detail = data.get("detail", "")
        if "inválidas" in detail.lower() or "invalidas" in detail.lower():
            results.append(print_result(True, "Wrong password returns 401 with 'Credenciales inválidas'"))
        else:
            results.append(print_result(False, f"Got 401 but wrong message: {detail}"))
    else:
        results.append(print_result(False, f"Expected 401, got {resp.status_code}"))
except Exception as e:
    results.append(print_result(False, f"Exception: {e}"))

# Test 5: GET /auth/me with valid token
print_test(5, "GET /auth/me - With valid Bearer token")
if session_token1:
    try:
        resp = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {session_token1}"},
            timeout=15
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        if resp.status_code == 200:
            user_me = resp.json()
            checks = []
            checks.append(("user_id exists", user_me.get("user_id") is not None))
            checks.append(("email matches", user_me.get("email") == email1.lower()))
            checks.append(("name matches", user_me.get("name") == name1))
            
            all_pass = all(check[1] for check in checks)
            for check_name, check_result in checks:
                print(f"  - {check_name}: {'✓' if check_result else '✗'}")
            
            results.append(print_result(all_pass, "GET /auth/me returns correct user"))
        else:
            results.append(print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}"))
    except Exception as e:
        results.append(print_result(False, f"Exception: {e}"))
else:
    results.append(print_result(False, "Skipped - no session_token from previous tests"))

# Test 6: GET /auth/me without auth
print_test(6, "GET /auth/me - Without authentication")
try:
    resp = requests.get(f"{BASE_URL}/auth/me", timeout=15)
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Response: {resp.json()}")
    
    if resp.status_code == 401:
        results.append(print_result(True, "GET /auth/me without auth returns 401"))
    else:
        results.append(print_result(False, f"Expected 401, got {resp.status_code}"))
except Exception as e:
    results.append(print_result(False, f"Exception: {e}"))

# Test 7: Create group and verify
print_test(7, "POST /groups - Create group and verify with GET /groups/me")
codigo_union = None
if session_token1:
    try:
        resp = requests.post(
            f"{BASE_URL}/groups",
            headers={"Authorization": f"Bearer {session_token1}"},
            json={"nombre_negocio": "Mi Negocio"},
            timeout=15
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        if resp.status_code == 200:
            group_data = resp.json()
            codigo_union = group_data.get("codigo_union")
            
            checks = []
            checks.append(("codigo_union exists", codigo_union is not None))
            checks.append(("codigo_union is 6 chars", len(codigo_union) == 6 if codigo_union else False))
            checks.append(("nombre_negocio matches", group_data.get("nombre_negocio") == "Mi Negocio"))
            
            all_pass = all(check[1] for check in checks)
            for check_name, check_result in checks:
                print(f"  - {check_name}: {'✓' if check_result else '✗'}")
            
            if all_pass:
                # Verify with GET /groups/me
                print("\nVerifying with GET /groups/me...")
                resp2 = requests.get(
                    f"{BASE_URL}/groups/me",
                    headers={"Authorization": f"Bearer {session_token1}"},
                    timeout=15
                )
                print(f"Status: {resp2.status_code}")
                print(f"Response: {resp2.json()}")
                
                if resp2.status_code == 200:
                    group_me = resp2.json()
                    if group_me.get("codigo_union") == codigo_union:
                        results.append(print_result(True, "Group created and verified with GET /groups/me"))
                    else:
                        results.append(print_result(False, f"Group mismatch: {group_me.get('codigo_union')} != {codigo_union}"))
                else:
                    results.append(print_result(False, f"GET /groups/me failed with {resp2.status_code}"))
            else:
                results.append(print_result(False, "Group creation response incomplete"))
        else:
            results.append(print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}"))
    except Exception as e:
        results.append(print_result(False, f"Exception: {e}"))
else:
    results.append(print_result(False, "Skipped - no session_token from previous tests"))

# Test 8: Second user joins group
print_test(8, "Second user registers, logs in, and joins group")
email2 = random_email()
password2 = "secret456"
name2 = "Second User"
session_token2 = None

if codigo_union:
    try:
        # Register second user
        print("Registering second user...")
        resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={"email": email2, "password": password2, "name": name2},
            timeout=15
        )
        print(f"Register Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            session_token2 = data.get("session_token")
            print(f"Second user registered with token: {session_token2[:20]}...")
            
            # Join group
            print(f"\nJoining group with codigo_union: {codigo_union}")
            resp2 = requests.post(
                f"{BASE_URL}/groups/join",
                headers={"Authorization": f"Bearer {session_token2}"},
                json={"codigo_union": codigo_union},
                timeout=15
            )
            print(f"Join Status: {resp2.status_code}")
            print(f"Response: {resp2.json()}")
            
            if resp2.status_code == 200:
                # Verify second user is in the group
                print("\nVerifying second user's group membership...")
                resp3 = requests.get(
                    f"{BASE_URL}/groups/me",
                    headers={"Authorization": f"Bearer {session_token2}"},
                    timeout=15
                )
                print(f"GET /groups/me Status: {resp3.status_code}")
                print(f"Response: {resp3.json()}")
                
                if resp3.status_code == 200:
                    group_me2 = resp3.json()
                    if group_me2.get("codigo_union") == codigo_union:
                        results.append(print_result(True, "Second user joined group successfully"))
                    else:
                        results.append(print_result(False, f"Group mismatch for second user"))
                else:
                    results.append(print_result(False, f"GET /groups/me failed for second user"))
            else:
                results.append(print_result(False, f"Join group failed with {resp2.status_code}: {resp2.text}"))
        else:
            results.append(print_result(False, f"Second user registration failed with {resp.status_code}"))
    except Exception as e:
        results.append(print_result(False, f"Exception: {e}"))
else:
    results.append(print_result(False, "Skipped - no codigo_union from previous test"))

# Test 9: Logout and verify session invalidation
print_test(9, "POST /auth/logout - Logout and verify session is invalid")
if session_token2:
    try:
        # Logout
        resp = requests.post(
            f"{BASE_URL}/auth/logout",
            headers={"Authorization": f"Bearer {session_token2}"},
            timeout=15
        )
        print(f"Logout Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") is True:
                print("Logout successful, verifying session is invalid...")
                
                # Try to access /auth/me with the logged-out token
                resp2 = requests.get(
                    f"{BASE_URL}/auth/me",
                    headers={"Authorization": f"Bearer {session_token2}"},
                    timeout=15
                )
                print(f"GET /auth/me after logout Status: {resp2.status_code}")
                if resp2.status_code != 200:
                    print(f"Response: {resp2.json()}")
                
                if resp2.status_code == 401:
                    results.append(print_result(True, "Logout invalidates session correctly"))
                else:
                    results.append(print_result(False, f"Expected 401 after logout, got {resp2.status_code}"))
            else:
                results.append(print_result(False, f"Logout response missing 'ok: true'"))
        else:
            results.append(print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}"))
    except Exception as e:
        results.append(print_result(False, f"Exception: {e}"))
else:
    results.append(print_result(False, "Skipped - no session_token2 from previous tests"))

# Summary
print("\n" + "="*70)
print("TEST SUMMARY")
print("="*70)
passed = sum(1 for r in results if r)
total = len(results)
print(f"Passed: {passed}/{total}")
print(f"Failed: {total - passed}/{total}")

if passed == total:
    print("\n✅ ALL TESTS PASSED")
    sys.exit(0)
else:
    print("\n❌ SOME TESTS FAILED")
    sys.exit(1)
