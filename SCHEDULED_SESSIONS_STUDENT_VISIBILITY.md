# Scheduled Sessions - Student Visibility Feature

## Overview
Students offering courses with scheduled attendance sessions will see those sessions as active in their attendance interface, providing a seamless experience identical to manually started sessions.

## How It Works

### 1. Lecturer Starts a Scheduled Session
- Lecturer creates a schedule via the "Scheduled Sessions" tab in Physical Attendance page
- Lecturer clicks "Start Now" on the upcoming schedule
- Backend (`/start-scheduled-session` endpoint) creates a new session with:
  - `status: "active"`
  - `courseCode`: the scheduled course code
  - `sessionId` and `sessionCode` for student access
  - Geolocation data (latitude, longitude, radius)

### 2. Session Becomes Visible to Students
- Session is stored in the `sessions` collection in MongoDB
- Students' frontend polls `/get-student-courses` every 5 seconds
- Endpoint queries for all active sessions matching student's registered courses
- Returns courses with `hasActiveSession: true` for scheduled courses that are started

### 3. Student Experience
- Student sees the course marked as "Active" in their course list
- Can click on the course to join the attendance session
- Marks attendance using face verification just like manually started sessions
- No difference in UX between scheduled and immediately started sessions

## Database Flow

### Schedule Collection
```json
{
  "scheduleId": "sched-123",
  "lecturerId": "lecturer-001",
  "courseCode": "CSC101",
  "scheduledDateTime": "2025-12-08T14:00:00+01:00",
  "status": "scheduled",  // Changes to "started" when lecturer starts
  "sessionId": "geo-1234567890"  // Populated when started
}
```

### Sessions Collection
```json
{
  "sessionId": "geo-1234567890",
  "sessionCode": "4567",
  "scheduleId": "sched-123",  // Link back to schedule
  "hostId": "lecturer-001",
  "courseCode": "CSC101",  // Key field for student visibility
  "status": "active",
  "isActive": true,
  "latitude": 6.827402,
  "longitude": 3.940343,
  "radius": 100,
  "startTime": "2025-12-08T14:00:00+01:00",
  "timeLimit": 30  // Optional time limit in minutes
}
```

## API Endpoints

### Start Scheduled Session
```bash
POST /start-scheduled-session
{
  "scheduleId": "sched-123",
  "lecturerId": "lecturer-001",
  "latitude": 6.827402,
  "longitude": 3.940343
}

Response:
{
  "status": "success",
  "sessionId": "geo-1234567890",
  "sessionCode": "4567",
  "courseCode": "CSC101"
}
```

### Get Student Courses (with active session status)
```bash
GET /get-student-courses?userId=student-001

Response:
{
  "status": "success",
  "courses": [
    {
      "code": "CSC101",
      "title": "Introduction to Computer Science",
      "hasActiveSession": true,
      "sessionId": "geo-1234567890",
      "hostId": "lecturer-001"
    },
    {
      "code": "MTH101",
      "title": "Calculus I",
      "hasActiveSession": false
    }
  ]
}
```

## Frontend Implementation

### Student Courses Polling (5-second interval)
Located in `/app/(root)/physical-attendance/page.tsx` lines 140-178:
```javascript
// Fetches student courses every 5 seconds
// Automatically detects new active sessions from scheduled sessions
const interval = setInterval(fetchStudentCourses, 5000);
```

### Display of Active Sessions
Located in `/app/(root)/physical-attendance/page.tsx` lines 1481-1550:
- Filters courses with `hasActiveSession: true`
- Shows "Active Now" badge
- Allows students to click and mark attendance
- Same UX as immediately started sessions

## Testing the Feature

### Test Scenario
1. **Setup**: Student is enrolled in course "CSC101"
2. **Create Schedule**: Lecturer creates a schedule for CSC101 on Physical Attendance page
3. **Start Session**: Lecturer clicks "Start Now" on the upcoming schedule
4. **Verify**: Within 5 seconds, student should see CSC101 showing as "Active" with:
   - "Active Now" indicator
   - Option to click and mark attendance
   - Same session interface as manually started sessions

### Expected Behavior
✅ Scheduled sessions become immediately visible to students
✅ No difference in student experience vs. manually started sessions
✅ Students can mark attendance using the same flow
✅ Session automatically shows active status within 5 seconds of startup
✅ Time limit applies if lecturer set one on the schedule

## Features Supported

| Feature | Manually Started | Scheduled |
|---------|-----------------|-----------|
| Session Creation | ✅ | ✅ |
| Student Visibility | ✅ | ✅ |
| Attendance Marking | ✅ | ✅ |
| Face Verification | ✅ | ✅ |
| Geolocation Check | ✅ | ✅ |
| Time Limit | ✅ | ✅ |
| Session Duration | ✅ | ✅ |
| Auto-termination | ✅ | ✅ |
| Download Report | ✅ | ✅ |

## Conclusion
The scheduler integration ensures that scheduled attendance sessions provide the exact same student experience as immediately started sessions. Students will see scheduled courses as "Active" automatically within 5 seconds of the lecturer starting them, with no UI differences between the two session types.
