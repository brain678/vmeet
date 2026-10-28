from database import db

print("=== Checking Active Sessions ===\n")

# Check all active sessions
active_sessions = list(db.sessions.find({"status": "active"}))

print(f"Total active sessions: {len(active_sessions)}\n")

if active_sessions:
    for session in active_sessions:
        print(f"Session ID: {session.get('sessionId')}")
        print(f"Course Code: {session.get('courseCode')}")
        print(f"Status: {session.get('status')}")
        print(f"Started: {session.get('startTime')}")
        print(f"Attendees: {session.get('attendeeCount', 0)}")
        print()
else:
    print("❌ No active sessions found!")
    print("\nTo test the system, you need to:")
    print("1. Login as a lecturer")
    print("2. Go to Physical Attendance page")
    print("3. Click 'Start Taking Attendance'")
    print("4. Select course 'CSC111'")
    print("5. Click 'Start Session'")
    print("\nThen the student will see the active session in their dropdown!")

# Also check all sessions
print("\n=== All Sessions (including completed) ===")
all_sessions = list(db.sessions.find())
print(f"Total sessions in database: {len(all_sessions)}")

if all_sessions:
    for session in all_sessions:
        print(f"  {session.get('courseCode')}: {session.get('status')}")
