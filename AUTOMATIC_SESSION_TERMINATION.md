# Automatic Session Termination Implementation

## Overview

Implemented automatic session termination based on time limits. Sessions with a `timeLimit` field will automatically end when the time limit is exceeded, regardless of whether the admin is still connected to the page or not.

## Architecture

### Components

1. **APScheduler** (`APScheduler==3.10.4`)
   - Background scheduler running every 30 seconds
   - Checks all active sessions with time limits
   - Updates expired sessions to "completed" status

2. **scheduler.py** - New background task module
   - `SessionScheduler` class: Manages the background scheduler
   - `check_and_end_expired_sessions()`: Main checking function
   - `_auto_end_session()`: Helper to end individual sessions
   - Runs independently of client connections

3. **main.py** - FastAPI app integration
   - Startup event: Initializes scheduler on app startup
   - Shutdown event: Gracefully stops scheduler on app shutdown
   - Ensures background tasks survive page refreshes/closures

## How It Works

### Session Lifecycle with Time Limit

```
1. Session Created with timeLimit (e.g., 30 minutes)
   └─ startTime: 2025-12-07T14:01:38Z
   └─ timeLimit: 30 (minutes)
   └─ status: "active"

2. Background Scheduler Checks Every 30 Seconds
   └─ Queries: status="active" AND timeLimit IS SET
   └─ Calculates: elapsed_time = now - startTime
   └─ Compares: elapsed_time >= timeLimit?

3. Session Expires
   └─ Updates status: "active" → "completed"
   └─ Sets: autoEnded=true, endTime, autoEndReason
   └─ Marks attendance records as finalized
   └─ Logs the expiration event

4. Session Ends Regardless of Client State
   ✓ Admin can close page/browser
   ✓ Network disconnect won't affect auto-end
   ✓ Session expires autonomously in background
```

### Database Updates

When a session expires, the following updates occur:

**Session Collection:**
```javascript
{
  _id: ObjectId(...),
  status: "completed",           // Changed from "active"
  autoEnded: true,               // Marks as auto-terminated
  endTime: "2025-12-07T14:02:51Z",
  autoEndReason: "Time limit of 30 minutes exceeded"
}
```

**Attendance Collection:**
```javascript
{
  sessionId: "...",
  status: "present" | "late",    // Unchanged
  sessionAutoEnded: true,        // Marks session auto-ended
  sessionEndTime: "2025-12-07T14:02:51Z"
}
```

## Implementation Details

### 1. Scheduler Initialization (`main.py`)

```python
@app.on_event("startup")
async def startup_event():
    """Initialize background scheduler for automatic session termination"""
    scheduler = initialize_scheduler()
    if scheduler:
        logger.info("Background session scheduler initialized on startup")
```

- Runs once when FastAPI app starts
- Initializes APScheduler with 30-second interval check
- Logs initialization status

### 2. Background Job (`scheduler.py`)

```python
def check_and_end_expired_sessions():
    """
    Check all active sessions and end those that have exceeded their time limit.
    This function runs in the background and is not dependent on client connections.
    """
```

**Process:**
1. Query MongoDB for active sessions with timeLimit set
2. For each session:
   - Parse startTime (handle ISO format with Z suffix)
   - Calculate elapsed minutes since session start
   - Compare against timeLimit (in minutes)
   - If expired, call `_auto_end_session()`
3. Log results (count of expired sessions)

### 3. Session Expiration Logic (`scheduler.py`)

```python
def _auto_end_session(session_id, session_data, elapsed_minutes, time_limit_minutes):
    """Auto-end a single expired session"""
```

**Steps:**
1. Safely update session status to "completed" (only if still active)
2. Set endTime, autoEnded=true, autoEndReason
3. Update associated attendance records
4. Return success/failure status
5. Log the operation with timing details

### 4. Error Handling

- Try-except blocks at each level
- Continues processing other sessions if one fails
- Logs errors with context (session ID, elapsed time, etc.)
- Graceful scheduler shutdown on app exit

## Configuration

### Check Interval

Default: **30 seconds**

To change, modify in `scheduler.py`:
```python
trigger=IntervalTrigger(seconds=30),  # Change to desired interval
```

**Recommended values:**
- `10` - Very frequent (higher CPU, better real-time)
- `30` - Balanced (default, good for most use cases)
- `60` - Less frequent (lower CPU, slight delay in expiration)

### Time Limit Units

- **timeLimit** stored as **minutes** (integer)
- Internally converted to seconds for calculation
- Example: `timeLimit: 30` = 30 minutes

## Session Creation with Time Limit

### API Endpoint: `/start-geofence-session`

```bash
POST /start-geofence-session
Content-Type: application/json

{
  "lectureId": "lecture_001",
  "courseCode": "CSC101",
  "timeLimit": 30  // Optional: auto-end after 30 minutes
}
```

**Response:**
```json
{
  "sessionId": "session_001",
  "status": "success",
  "message": "Geofence attendance session started",
  "courseCode": "CSC101",
  "timeLimit": 30
}
```

## Testing

### Test Script: `test_auto_session_termination.py`

Run the test:
```bash
cd backend
python test_auto_session_termination.py
```

**Test Scenario:**
1. Creates a session with 1-minute time limit
2. Simulates 70 seconds elapsed
3. Runs the auto-expiration logic
4. Verifies session status changed to "completed"
5. Checks autoEnded flag is set
6. Cleans up test data

**Expected Output:**
```
✓ Created test session
⏳ Simulating scheduler check...
✓ Session auto-ended successfully
✅ TEST PASSED: Session was automatically terminated!
```

## Frontend Integration

### Records Page (`app/(root)/records/page.tsx`)

The attendance records page automatically reflects session auto-termination:

1. **Initial Load**: Displays active sessions
2. **Auto-Termination**: Backend ends session automatically
3. **Next Refresh/Poll**: Frontend sees session as "completed"
4. **Status Badge**: Changes from "Active" (green) to "Completed" (gray)

Optional enhancement - Implement polling to detect auto-termination in real-time:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // Fetch session status
    // Update UI if status changed to "completed"
  }, 10000); // Check every 10 seconds
  
  return () => clearInterval(interval);
}, [sessionId]);
```

## Troubleshooting

### Scheduler Not Starting

**Check logs:**
```bash
# Look for startup messages
grep -i "scheduler" backend.log
```

**Verify APScheduler installed:**
```bash
pip list | grep APScheduler
# Should show: APScheduler 3.10.4
```

### Sessions Not Auto-Ending

**Debug steps:**
1. Verify session has `timeLimit` field set
2. Check MongoDB for active sessions:
   ```bash
   db.sessions.find({"status": "active", "timeLimit": {$ne: null}})
   ```
3. Review logs for check_and_end_expired_sessions calls
4. Verify startTime is in correct ISO format

### Performance Impact

- Minimal: One DB query every 30 seconds
- Only checks active sessions with timeLimit set
- No impact if no sessions with timeLimit exist

## Files Modified/Created

1. **requirements.txt**
   - Added: `APScheduler==3.10.4`

2. **backend/scheduler.py** (NEW)
   - SessionScheduler class
   - Background job functions
   - Error handling and logging

3. **backend/main.py**
   - Added import: `from scheduler import initialize_scheduler`
   - Added startup event: Initialize scheduler
   - Added shutdown event: Clean up scheduler

4. **backend/test_auto_session_termination.py** (NEW)
   - Test script for verification
   - Can be run independently

## Future Enhancements

1. **Configurable Check Interval**: Make interval configurable via environment variable
2. **Webhook Notifications**: Notify clients when session auto-ends
3. **Extend Time Limit**: Allow extending session time limit before expiration
4. **Analytics**: Track auto-ended sessions for reporting
5. **Grace Period**: Add delay before hard-ending session (e.g., warn at 90%, end at 100%)

## Deployment Considerations

1. **Environment**: Scheduler requires MongoDB access
2. **Logging**: Monitor logs for scheduler initialization/errors
3. **Timezone**: Handles UTC times properly with timezone awareness
4. **Graceful Shutdown**: Scheduler stops cleanly on app shutdown
5. **Scaling**: If using multiple app instances, scheduler runs independently on each (no conflicts)

## Status

✅ **IMPLEMENTED AND TESTED**

- Session expiration checker: Working
- APScheduler integration: Working
- Database updates: Working
- Error handling: Working
- Test verification: Passing
