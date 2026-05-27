# Auth Testing Playbook (Emergent Google OAuth)

## Step 1: Create Test User & Session in MongoDB
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  codigo_grupo: null,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: API smoke tests
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X GET "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser cookie injection
```python
await page.context.add_cookies([{
  "name": "session_token",
  "value": "TOKEN",
  "domain": "<host>",
  "path": "/",
  "httpOnly": True,
  "secure": True,
  "sameSite": "None"
}])
```
