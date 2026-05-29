#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Arregla la web para que funcione y para que se puedan crear los usuarios que sea para todo el mundo"

backend:
  - task: "Auth register / login / me / logout (MongoDB)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend auth endpoints already existed (/api/auth/register, /api/auth/login, /api/auth/me, /api/auth/logout, /api/auth/session for Google OAuth). Need to verify all flow end-to-end so that anyone can create an account."
      - working: true
        agent: "testing"
        comment: "✅ ALL 9 AUTH TESTS PASSED. Verified: (1) POST /api/auth/register creates user with session_token + cookie, returns user object with user_id/email/name/codigo_grupo=null; (2) Duplicate email returns 400 'Email ya registrado'; (3) POST /api/auth/login with correct credentials returns new session_token + user; (4) Wrong password returns 401 'Credenciales inválidas'; (5) GET /api/auth/me with Bearer token returns correct user; (6) GET /api/auth/me without auth returns 401; (7) POST /api/groups creates group with 6-char codigo_union, verified with GET /api/groups/me; (8) Second user can register, login, and join group using codigo_union; (9) POST /api/auth/logout returns {ok: true} and invalidates session (subsequent /api/auth/me returns 401). Full auth flow working perfectly for new user registration and group collaboration."

frontend:
  - task: "Frontend auth wired to backend (replaced Supabase)"
    implemented: true
    working: "NA"
    file: "frontend/src/context/AuthContext.js, frontend/src/pages/Login.js, frontend/src/components/AuthCallback.js, frontend/src/lib/supabase.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Removed Supabase dependency. Login.js now calls /api/auth/register and /api/auth/login. AuthContext uses /api/auth/me with session_token in localStorage + cookie. AuthCallback handles Emergent Google OAuth session_id. Frontend compiles successfully."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Please verify the backend auth flow: 1) POST /api/auth/register with email/password/name creates a new user and returns session_token + user object (and sets cookie); 2) duplicate email returns 400; 3) POST /api/auth/login with the same email/password returns 200 + session_token + user; 4) wrong password returns 401; 5) GET /api/auth/me with Authorization: Bearer <token> returns the user (and also via cookie); 6) POST /api/auth/logout deletes the session; 7) After logout, /api/auth/me returns 401. Also smoke test /api/groups creation/join with the new session_token so we know full app works for any newly registered user."
  - agent: "testing"
    message: "✅ Backend auth testing COMPLETE - All 9 tests passed! The auth system is fully functional: users can register, login, access protected endpoints, create/join groups, and logout properly. Session management with bcrypt + MongoDB is working correctly. Spanish error messages are correct. The app is ready for anyone to create an account and use the full inventory system. No issues found."