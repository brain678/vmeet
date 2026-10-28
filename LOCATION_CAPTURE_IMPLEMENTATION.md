# Location Capture for Scheduled Sessions

## Overview
Lecturers' GPS coordinates are now automatically captured and stored when creating scheduled attendance sessions. These coordinates are used for geofence validation when the session auto-starts at the scheduled time.

## Implementation Details

### Frontend (app/(root)/physical-attendance/page.tsx)

#### 1. Schedule Creation Button Click Handler (Lines 1307-1317)
```typescript
onClick={() => {
  setScheduleFormData({...});
  // Request geolocation permission when opening dialog
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      () => {}, // Permission granted
      () => {}, // Permission denied, proceed anyway
      { timeout: 5000 }
    );
  }
  setShowCreateScheduleDialog(true);
}}
```
**Purpose**: Pre-request location permission when lecturer clicks "Schedule New Session" button

#### 2. Location Permission Notice (Lines 1826-1830)
```tsx
<div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-sm text-blue-300">
  <p className="flex items-start gap-2">
    <span className="text-lg leading-none">ℹ️</span>
    <span>Your location will be captured for this scheduled session. Please allow location access when prompted.</span>
  </p>
</div>
```
**Purpose**: Inform lecturers that location will be captured and request permission

#### 3. Schedule Creation Handler (Lines 732-768)
```typescript
const handleCreateSchedule = async () => {
  // ... validation ...
  
  try {
    // Get lecturer's current location
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: true,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (geoError) {
        console.warn('Could not get geolocation:', geoError);
        // Continue without location - backend will use defaults
      }
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/schedule-attendance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturerId: user.id,
          courseCode: scheduleFormData.courseCode,
          scheduledDate: scheduleFormData.scheduledDate,
          scheduledTime: scheduleFormData.scheduledTime,
          timeLimit: scheduleFormData.timeLimit ? Number(scheduleFormData.timeLimit) : null,
          description: scheduleFormData.description,
          ...(latitude !== null && longitude !== null && { latitude, longitude }),
        }),
      }
    );
```

**Features**:
- Uses browser's Geolocation API with 10-second timeout
- Requests high-accuracy location data
- Gracefully handles permission denial - continues without location
- Only includes latitude/longitude in request if both are available
- Backend uses defaults (Lagos center: 6.5244, 3.3792) if not provided

### Backend (backend/routes/schedule.py)

#### 1. ScheduleSession Model (Lines 18-25)
```python
class ScheduleSession(BaseModel):
    lecturerId: str
    courseCode: str
    scheduledDate: str  # ISO format: 2025-12-07
    scheduledTime: str  # 24-hour format: 14:30
    timeLimit: Optional[int] = None  # in minutes
    description: Optional[str] = None
    latitude: Optional[float] = None  # Lecturer's location for auto-start
    longitude: Optional[float] = None  # Lecturer's location for auto-start
```

#### 2. Schedule Document Creation (Lines 92-107)
```python
schedule_doc = {
    "scheduleId": schedule_id,
    "lecturerId": schedule_data.lecturerId,
    "courseCode": schedule_data.courseCode,
    "scheduledDateTime": scheduled_datetime.isoformat(),
    "scheduledDate": schedule_data.scheduledDate,
    "scheduledTime": schedule_data.scheduledTime,
    "timeLimit": schedule_data.timeLimit,
    "description": schedule_data.description or "",
    "status": "scheduled",
    "sessionId": None,
    "latitude": schedule_data.latitude,  # Store location for auto-start
    "longitude": schedule_data.longitude,  # Store location for auto-start
    "createdAt": nigeria_time.isoformat(),
    "updatedAt": nigeria_time.isoformat(),
```

### Auto-Scheduler Integration (backend/routes/auto_scheduler.py)

#### Location Usage During Auto-Start (Lines 50-75)
```python
# Get location from schedule (use stored coordinates, fallback to defaults)
latitude = schedule.get("latitude") or 6.5244
longitude = schedule.get("longitude") or 3.3792

logger.info(f"Location for session: latitude={latitude}, longitude={longitude}")
if schedule.get("latitude"):
    logger.info(f"Using stored coordinates from schedule")
else:
    logger.info(f"Using default Lagos center coordinates")

# Create session with location
session_doc = {
    "sessionId": session_id,
    "courseCode": schedule["courseCode"],
    "lecturerId": schedule["lecturerId"],
    "latitude": latitude,
    "longitude": longitude,
    "status": "active",
    "startTime": current_time.isoformat(),
    "endTime": None,
    "autoStarted": True,
    "createdAt": current_time.isoformat(),
}
```

**Features**:
- Retrieves stored latitude/longitude from schedule document
- Falls back to Lagos center (6.5244, 3.3792) if not provided
- Logs which coordinates are being used
- Creates session with exact coordinates for geofence validation

## Data Flow

```
1. Lecturer clicks "Schedule New Session"
   ↓
2. Browser requests geolocation permission (pre-request)
   ↓
3. Dialog opens with location permission notice
   ↓
4. Lecturer fills in form and clicks "Create Schedule"
   ↓
5. Browser captures current GPS coordinates (timeout: 10s)
   ↓
6. Frontend sends coordinates with schedule creation request
   ↓
7. Backend stores latitude/longitude in schedule document
   ↓
8. Auto-scheduler checks every 30 seconds
   ↓
9. When scheduled time arrives, auto-scheduler retrieves stored coordinates
   ↓
10. Auto-scheduler creates session with those coordinates
   ↓
11. Students within 100m radius can mark attendance via geofence
```

## Geofence Validation

Once a session is created with coordinates, the attendance marking system validates:
- Student's current location
- Distance from session location (must be ≤ 100 meters)
- Student marked attendance only if within geofence

## Error Handling & Fallbacks

| Scenario | Handling |
|----------|----------|
| Browser doesn't support Geolocation API | Schedule created without location; backend uses defaults |
| User denies location permission | Schedule created without location; backend uses defaults |
| Geolocation timeout (10 seconds) | Schedule created without location; backend uses defaults |
| Network error during location request | Caught and logged; schedule created without location |
| Backend doesn't receive coordinates | Uses default Lagos center (6.5244, 3.3792) |

## Browser Compatibility

- **Chrome/Edge/Firefox/Safari**: Supports Geolocation API
- **Location Requirements**: HTTPS connection (or localhost)
- **Permission**: User must allow location access
- **Accuracy**: High accuracy enabled for precise location capture

## User Experience

1. **Permission Prompt**: Browser displays "Allow location access?" when lecturer creates schedule
2. **Location Notice**: Blue info box tells lecturer location will be captured
3. **Graceful Degradation**: If location not available, system still works with defaults
4. **No Manual Entry**: Location captured automatically - no manual lat/lon input needed
5. **Privacy**: Location only used for geofence validation during session

## Configuration

### Geofence Radius
- Currently: **100 meters**
- Location: `backend/routes/attendance.py` - geofence validation
- Can be adjusted per course/lecturer if needed

### Default Location (if not provided)
- **Latitude**: 6.5244 (Lagos, Nigeria)
- **Longitude**: 3.3792 (Lagos, Nigeria)
- Location: `backend/routes/auto_scheduler.py` line 50-51
- Can be changed to institution's coordinates

### Location Request Timeout
- **Frontend**: 10 seconds (during schedule creation)
- **Pre-request**: 5 seconds (when opening dialog)
- Can be adjusted in `handleCreateSchedule` function

## Testing the Feature

### Test Case 1: Successful Location Capture
```
1. Open physical-attendance page
2. Click "Schedule New Session"
3. Allow location access when prompted
4. Fill in schedule form
5. Submit
Expected: Schedule created with lecturer's coordinates stored
```

### Test Case 2: Location Permission Denied
```
1. Open physical-attendance page
2. Click "Schedule New Session"
3. Deny location access when prompted
4. Fill in schedule form
5. Submit
Expected: Schedule created with default Lagos coordinates
```

### Test Case 3: Auto-Start Uses Captured Location
```
1. Create schedule with location capture
2. Wait for scheduled time to arrive
3. Check backend logs
Expected: Log shows "Using stored coordinates from schedule"
```

## Logs to Monitor

In backend console, look for:
```
Location for session: latitude=6.5244, longitude=3.3792
Using stored coordinates from schedule
OR
Using default Lagos center coordinates
```

## Security Considerations

- Location is only captured from authenticated lecturers
- Location data stored in database (encrypted in transit via HTTPS)
- Location only visible to system (not shared with other users)
- Used only for geofence validation during attendance
- Can be cleared from schedule if needed (via future update endpoint)

## Future Enhancements

1. **Batch Location Update**: Allow lecturers to update session location before auto-start
2. **Location Accuracy**: Show confidence radius in UI
3. **Venue Presets**: Save favorite locations for quick selection
4. **Multi-Location Sessions**: Support sessions across multiple locations
5. **Location History**: Track location trends for analytics
