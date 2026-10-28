# Quick Reference: Session Time Limits

## Creating a Session with Auto-Termination

### Basic Request
```bash
POST http://localhost:8000/start-geofence-session
Content-Type: application/json

{
  "lectureId": "lecture_12345",
  "courseCode": "BIO111",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "timeLimit": 30  # Minutes before auto-terminate
}
```

### Response
```json
{
  "sessionId": "session_abc123",
  "status": "success",
  "message": "Geofence attendance session started",
  "courseCode": "BIO111",
  "timeLimit": 30,
  "startTime": "2025-12-07T14:00:00Z"
}
```

## How Auto-Termination Works

1. **Session Created** with `timeLimit: 30` (30 minutes)
2. **Background Scheduler** checks every 30 seconds
3. **After 30 minutes** pass, scheduler auto-ends the session
4. **Session marked as** `status: "completed"`, `autoEnded: true`
5. **Attendance records** finalized with `sessionAutoEnded: true`
6. **Admin gets notified** on next page refresh (session appears completed)

## Example Scenarios

### Scenario 1: 30-Minute Lecture
```json
{
  "lectureId": "lec_001",
  "courseCode": "CSC101",
  "timeLimit": 30
}
```
- Session auto-ends after 30 minutes
- No manual end required
- Useful for fixed-duration classes

### Scenario 2: 1-Minute Quick Check (Testing)
```json
{
  "lectureId": "test_lec",
  "courseCode": "TEST101",
  "timeLimit": 1
}
```
- Session auto-ends after 60 seconds
- Good for testing the feature
- Can verify in scheduler logs

### Scenario 3: No Time Limit (Manual End Only)
```json
{
  "lectureId": "lec_002",
  "courseCode": "PHY201",
  "timeLimit": null
}
```
Or simply omit `timeLimit`:
```json
{
  "lectureId": "lec_002",
  "courseCode": "PHY201"
}
```
- Session never auto-ends
- Admin must manually end the session
- Useful for variable-duration activities

## Checking Session Status

### API Endpoint
```bash
GET http://localhost:8000/get-session-status?sessionId=session_abc123
```

### Response (Active Session)
```json
{
  "isActive": true,
  "status": "active",
  "courseCode": "BIO111",
  "startTime": "2025-12-07T14:00:00Z"
}
```

### Response (Auto-Ended Session)
```json
{
  "isActive": false,
  "status": "completed",
  "courseCode": "BIO111",
  "startTime": "2025-12-07T14:00:00Z",
  "endTime": "2025-12-07T14:30:05Z",
  "autoEnded": true,
  "autoEndReason": "Time limit of 30 minutes exceeded"
}
```

## Frontend: Attendance Records Display

### Before Auto-End (During Session)
```
Session: BIO111
Status: 🟢 Active
Time: 25 minutes elapsed / 30 minutes limit
Students Checked In: 42/45
```

### After Auto-End (Session Expired)
```
Session: BIO111
Status: ⚪ Completed (Auto-ended)
Duration: 30 minutes 5 seconds
Students Checked In: 42/45
```

## Database Queries

### Find Active Sessions with Time Limits
```javascript
db.sessions.find({
  "status": "active",
  "timeLimit": { $exists: true, $ne: null }
})
```

### Find Auto-Ended Sessions
```javascript
db.sessions.find({
  "status": "completed",
  "autoEnded": true
})
```

### Find Sessions by Duration
```javascript
db.sessions.find({
  "status": "completed",
  "autoEnded": true,
  "startTime": { $gte: ISODate("2025-12-07T00:00:00Z") }
})
```

## Common Time Limits

| Duration | Value |
|----------|-------|
| 30 seconds | 0.5 |
| 1 minute | 1 |
| 5 minutes | 5 |
| 15 minutes | 15 |
| 30 minutes | 30 |
| 1 hour | 60 |
| 2 hours | 120 |

*Note: timeLimit is in minutes (can be decimal for sub-minute precision)*

## Monitoring & Logging

### Startup (App starts)
```
INFO: Background session scheduler initialized on startup
```

### During operation (Every 30 seconds, if sessions exist)
```
DEBUG: Checking 2 active session(s) for expiration
INFO: Auto-ended session abc123. Elapsed: 30.5min, Limit: 30min
DEBUG: Marked 42 attendance records as auto-ended for session abc123
```

### Shutdown (App stops)
```
INFO: Session scheduler stopped on shutdown
```

## Troubleshooting

### Session not auto-ending?
1. Verify `timeLimit` is set in session creation
2. Check that scheduler is running: Look for startup message in logs
3. Verify time has actually exceeded the limit
4. Check MongoDB for the session: `db.sessions.findOne({_id: ObjectId(...)})`

### Wrong time being calculated?
1. Verify `startTime` is in ISO 8601 format
2. Check timezone handling (all times in UTC)
3. Verify `timeLimit` is in minutes
4. Test with `timeLimit: 1` (1 minute) to verify quickly

### Want to test quickly?
1. Create session with `timeLimit: 1` (1 minute)
2. Wait 70 seconds (or simulate in test)
3. Check session status - should be `completed`
4. Run test: `python test_auto_session_termination.py`

## API Integration Examples

### Python (Requests)
```python
import requests
import json

response = requests.post(
    "http://localhost:8000/start-geofence-session",
    json={
        "lectureId": "lec_001",
        "courseCode": "CSC101",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "timeLimit": 30
    }
)

session = response.json()
print(f"Session {session['sessionId']} will auto-end in {session['timeLimit']} minutes")
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:8000/start-geofence-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    lectureId: 'lec_001',
    courseCode: 'CSC101',
    latitude: 37.7749,
    longitude: -122.4194,
    timeLimit: 30
  })
});

const session = await response.json();
console.log(`Session will auto-end in ${session.timeLimit} minutes`);
```

### cURL
```bash
curl -X POST http://localhost:8000/start-geofence-session \
  -H "Content-Type: application/json" \
  -d '{
    "lectureId": "lec_001",
    "courseCode": "CSC101",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "timeLimit": 30
  }'
```

## Best Practices

✅ **DO:**
- Set appropriate time limits for your use case
- Test with short limits (1-5 minutes) first
- Monitor logs for auto-termination events
- Handle session completion gracefully in frontend
- Inform students about time limits

❌ **DON'T:**
- Set `timeLimit: 0` (will expire immediately)
- Change time limit on running sessions (not yet supported)
- Assume manual end works differently with auto-termination
- Create sessions without timezone awareness (use UTC)

## Support & Debugging

### Quick Test
```bash
cd backend
python test_auto_session_termination.py
```

### Full Integration Test
```bash
cd backend
python test_integration_auto_termination.py
```

### View Logs
```bash
# Check if scheduler started
grep -i "scheduler" app.log

# Check auto-ended sessions
grep -i "auto-end" app.log

# Count auto-ended sessions
grep -c "Auto-ended session" app.log
```

---

**Feature Status**: ✅ Fully Implemented and Tested  
**Backward Compatible**: ✅ Yes (sessions without timeLimit unaffected)  
**Production Ready**: ✅ Yes (thoroughly tested)
