# Google OAuth Registration Flow - API Reference

## Core Endpoints Overview

### 1. **POST `/initialize-user-from-google`** ✅ NEW
**Purpose**: Create initial MongoDB record after Google OAuth signup  
**Called From**: `/role-selection` page (useEffect after Clerk auth)  
**Called When**: User just signed up with Google, before role selection

**Request**:
```typescript
POST /initialize-user-from-google
Content-Type: application/json

{
  "userId": "user_clerk_id",        // From Clerk
  "email": "user@gmail.com",        // From Clerk - should be verified
  "name": "John Doe",               // Optional - from Clerk
  "firstName": "John",              // Optional - from Clerk
  "lastName": "Doe"                 // Optional - from Clerk
}
```

**Response (Success - 201)**:
```json
{
  "status": "success",
  "message": "User initialized successfully",
  "user": {
    "userId": "user_clerk_id",
    "email": "user@gmail.com",
    "name": "John Doe",
    "createdAt": "2025-01-14T10:30:45.123456",
    "signupMethod": "google"
  }
}
```

**Response (User Already Exists - 200)**:
```json
{
  "status": "success",
  "message": "User already initialized",
  "user": {
    "userId": "user_clerk_id",
    "email": "user@gmail.com",
    "name": "John Doe",
    "role": "student"  // May have role if already selected
  }
}
```

**MongoDB Document Created**:
```javascript
{
  _id: ObjectId("..."),
  userId: "user_clerk_id",
  email: "user@gmail.com",
  name: "John Doe",
  createdAt: ISODate("2025-01-14T10:30:45.123Z"),
  registeredAt: ISODate("2025-01-14T10:30:45.123Z"),
  lastUpdated: ISODate("2025-01-14T10:30:45.123Z"),
  signupMethod: "google-oauth",
  status: "active",
  isRegistered: false,  // ← Will be set to true after role selection
  registrationSource: "google-oauth"
}
```

**Error Responses**:
- 400: Missing userId or email
- 500: MongoDB insert failed

---

### 2. **POST `/check-role-selection`**
**Purpose**: Check if user needs role selection or already has one  
**Called From**: `/role-selection` page (useEffect after initialization)  
**Called When**: Every time user loads role selection page

**Request**:
```json
POST /check-role-selection
Content-Type: application/json

{
  "userId": "user_clerk_id"
}
```

**Response (User needs role selection)**:
```json
{
  "status": "success",
  "needsRoleSelection": true,
  "roleData": {
    "isRegistered": false,
    "hasReferenceImage": false,
    "registrationComplete": false,
    "nextStep": "role-selection"
  }
}
```

**Response (User already has role - Student)**:
```json
{
  "status": "success",
  "needsRoleSelection": false,
  "role": "student",
  "roleData": {
    "isRegistered": true,
    "hasReferenceImage": true,
    "registrationComplete": true,
    "attendanceCount": 5,
    "matricNumber": "2024/001",
    "department": "Computer Science",
    "level": "200",
    "nextStep": "home"
  }
}
```

**Response (User already has role - Lecturer)**:
```json
{
  "status": "success",
  "needsRoleSelection": false,
  "role": "lecturer",
  "roleData": {
    "isRegistered": true,
    "sessionsCount": 3,
    "department": "Computer Science",
    "nextStep": "home"
  }
}
```

---

### 3. **POST `/set-user-role`**
**Purpose**: Set user's role (Student/Lecturer) and initial profile data  
**Called From**: `/role-selection` page when user selects role  
**Called When**: User clicks "Continue as Student" or "Continue as Lecturer"

**For Student Selection**:
```json
POST /set-user-role
Content-Type: application/json

{
  "userId": "user_clerk_id",
  "email": "user@gmail.com",
  "name": "John Doe",
  "role": "student"
}
```

**MongoDB Update**:
```javascript
{
  userId: "user_clerk_id",
  email: "user@gmail.com",
  name: "John Doe",
  role: "student",
  registeredAt: ISODate("2025-01-14T10:31:00.000Z"),
  lastUpdated: ISODate("2025-01-14T10:31:00.000Z"),
  // isRegistered remains false until student-registration completes
}
```

**For Lecturer Selection** (with department and courses):
```json
POST /set-user-role
Content-Type: application/json

{
  "userId": "user_clerk_id",
  "email": "user@gmail.com",
  "name": "John Doe",
  "role": "lecturer",
  "department": "Computer Science",
  "courses": ["course_id_1", "course_id_2"]
}
```

**MongoDB Update**:
```javascript
{
  userId: "user_clerk_id",
  email: "user@gmail.com",
  name: "John Doe",
  role: "lecturer",
  department: "Computer Science",
  courses: ["course_id_1", "course_id_2"],
  registeredAt: ISODate("2025-01-14T10:31:00.000Z"),
  lastUpdated: ISODate("2025-01-14T10:31:00.000Z"),
  lastCoursesUpdate: ISODate("2025-01-14T10:31:00.000Z"),
  isRegistered: true  // ← Lecturers are immediately registered
}
```

**Response (Success)**:
```json
{
  "status": "success",
  "message": "User role updated successfully",
  "user": {
    "userId": "user_clerk_id",
    "role": "student",
    "name": "John Doe",
    "email": "user@gmail.com",
    "department": null,
    "courses": [],
    "registeredAt": "2025-01-14T10:31:00.000000",
    "lastUpdated": "2025-01-14T10:31:00.000000",
    "lastCoursesUpdate": null
  }
}
```

---

### 4. **POST `/upload-face-image`**
**Purpose**: Upload student's face image and store in GridFS  
**Called From**: `/student-registration` page (step 6)  
**Called When**: Student submits registration form

**Request** (Form Data):
```
POST /upload-face-image
Content-Type: multipart/form-data

userId: "user_clerk_id"
name: "John Doe"
matric: "2024/001234567"
department: "Computer Science"
file: <image file>
```

**Face Detection**:
- Uses `face_recognition` library to detect face in image
- Rejects if no face found: `400 Bad Request: No face detected in the image`

**Storage**:
- Temporary copy: `uploads/ref_{userId}.jpg`
- Permanent copy: GridFS `fs.files` with filename `ref_{userId}.jpg`
- Temporary file deleted after storage

**MongoDB Update**:
```javascript
{
  userId: "user_clerk_id",
  name: "John Doe",
  matric: "2024/001234567",
  department: "Computer Science",
  role: "student",
  registeredAt: ISODate("2025-01-14T10:30:45.000Z"),
  lastUpdated: ISODate("2025-01-14T10:35:00.000Z"),
  hasReferenceImage: true
}
```

**Response (Success)**:
```json
{
  "status": "success",
  "message": "Face image and user info uploaded successfully",
  "userId": "user_clerk_id",
  "name": "John Doe"
}
```

---

### 5. **POST `/register-student`**
**Purpose**: Complete student registration with all profile details  
**Called From**: `/student-registration` page (form submission)  
**Called When**: Student completes all registration steps

**Request**:
```json
POST /register-student
Content-Type: application/json

{
  "userId": "user_clerk_id",
  "matricNumber": "2024/001234567",
  "department": "Computer Science",
  "level": "200",
  "name": "John Doe",
  "courses": ["course_id_1", "course_id_2", "course_id_3"],
  "isUpdate": false
}
```

**MongoDB Update**:
```javascript
{
  userId: "user_clerk_id",
  name: "John Doe",
  matricNumber: "2024/001234567",
  department: "Computer Science",
  level: "200",
  courses: ["course_id_1", "course_id_2", "course_id_3"],
  role: "student",
  isRegistered: true,  // ← Set to true after registration complete
  registeredAt: ISODate("2025-01-14T10:30:45.000Z"),
  lastUpdated: ISODate("2025-01-14T10:40:00.000Z"),
  lastCoursesUpdate: ISODate("2025-01-14T10:40:00.000Z"),
  registrationSource: "web",
  status: "active",
  hasReferenceImage: true  // ← From previous upload-face-image call
}
```

**Response (Success)**:
```json
{
  "status": "success",
  "message": "Student registration completed successfully",
  "user": {
    "userId": "user_clerk_id",
    "name": "John Doe",
    "matricNumber": "2024/001234567",
    "department": "Computer Science",
    "level": "200",
    "courses": ["course_id_1", "course_id_2", "course_id_3"],
    "registeredAt": "2025-01-14T10:30:45.000000",
    "lastUpdated": "2025-01-14T10:40:00.000000"
  }
}
```

**Note**: Can also be called for updates with `isUpdate: true`

---

### 6. **GET `/get-user-role`**
**Purpose**: Fetch complete user profile and role information  
**Called From**: `/profile` page, `/student-registration` page  
**Called When**: App needs to display/verify user information

**Request**:
```
GET /get-user-role?userId=user_clerk_id
```

**Response (Student)**:
```json
{
  "status": "success",
  "role": "student",
  "name": "John Doe",
  "email": "user@gmail.com",
  "matricNumber": "2024/001234567",
  "department": "Computer Science",
  "level": "200",
  "courses": [
    {
      "_id": "course_id_1",
      "code": "CSC101",
      "title": "Introduction to Programming"
    },
    {
      "_id": "course_id_2",
      "code": "CSC102",
      "title": "Data Structures"
    }
  ],
  "registeredAt": "2025-01-14T10:30:45.000000",
  "lastUpdated": "2025-01-14T10:40:00.000000",
  "lastCoursesUpdate": "2025-01-14T10:40:00.000000",
  "roleData": {
    "attendanceCount": 5,
    "matricNumber": "2024/001234567",
    "department": "Computer Science",
    "level": "200",
    "isRegistered": true,
    "registrationComplete": true,
    "hasReferenceImage": true
  },
  "isRegistered": true,
  "_id": "mongodb_object_id",
  "userId": "user_clerk_id",
  "isRestricted": false
}
```

**Response (Lecturer)**:
```json
{
  "status": "success",
  "role": "lecturer",
  "name": "Jane Smith",
  "email": "jane@gmail.com",
  "department": "Computer Science",
  "courses": [
    {
      "_id": "course_id_1",
      "code": "CSC101",
      "title": "Introduction to Programming"
    }
  ],
  "registeredAt": "2025-01-14T10:31:00.000000",
  "lastUpdated": "2025-01-14T10:31:00.000000",
  "lastCoursesUpdate": "2025-01-14T10:31:00.000000",
  "roleData": {
    "activeSessions": 0,
    "totalSessions": 0,
    "department": "Computer Science",
    "isRegistered": true
  },
  "isRegistered": true,
  "_id": "mongodb_object_id",
  "userId": "user_clerk_id",
  "isRestricted": false
}
```

---

### 7. **POST `/update-lecturer-courses`**
**Purpose**: Update lecturer's assigned courses  
**Called From**: Lecturer profile/settings pages  
**Called When**: Lecturer updates their course assignments

**Request**:
```json
POST /update-lecturer-courses
Content-Type: application/json

{
  "userId": "user_clerk_id",
  "courses": ["course_id_1", "course_id_2", "course_id_3"]
}
```

**MongoDB Update**:
```javascript
{
  courses: ["course_id_1", "course_id_2", "course_id_3"],
  lastCoursesUpdate: ISODate("2025-01-14T11:00:00.000Z")
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Lecturer courses updated successfully",
  "courses": [
    {
      "code": "CSC101",
      "name": "Introduction to Programming",
      "id": "course_id_1",
      "credits": 3
    }
  ],
  "count": 1
}
```

---

## Complete Registration Flow Summary

```
┌────────────────────────────────────┐
│ 1. POST /initialize-user-from-     │
│    google                          │
│ Creates: userId, email, name       │
│ Sets: isRegistered=false           │
└────────────────────┬───────────────┘
                     │ (user in MongoDB)
                     ▼
┌────────────────────────────────────┐
│ 2. POST /check-role-selection      │
│ Checks: Does user need to pick     │
│ role?                              │
└────────────────────┬───────────────┘
                     │ (yes → show UI)
                     ▼
┌────────────────────────────────────┐
│ 3a. POST /set-user-role            │
│     (for student)                  │
│ Updates: role="student"            │
│ Sets: registeredAt                 │
└────────────────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────┐
         │ Redirect to       │
         │ /student-         │
         │ registration      │
         └─────────┬─────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    ┌─────────────┐    ┌──────────────┐
    │ 4. POST     │    │ 5. POST      │
    │ /upload-    │    │ /register-   │
    │ face-image  │    │ student      │
    │             │    │              │
    │ Stores      │    │ Final        │
    │ face in     │    │ profile      │
    │ GridFS      │    │ complete     │
    │ Updates:    │    │              │
    │ - matric    │    │ Sets:        │
    │ - dept      │    │ - courses    │
    │ - hasRef    │    │ - level      │
    │   Image     │    │ - isReg=true │
    └─────────────┘    └──────────────┘
         │                    │
         └────────┬───────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Student fully      │
         │ registered and     │
         │ ready for          │
         │ attendance         │
         └────────────────────┘


    OR

         ┌─────────────────────┐
         │ 3b. POST /set-user- │
         │     role            │
         │     (for lecturer)  │
         │                     │
         │ Includes:           │
         │ - department        │
         │ - courses[]         │
         │ Sets:               │
         │ - isRegistered=true │
         │ - registeredAt      │
         └──────────┬──────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Lecturer ready to    │
         │ create sessions      │
         └──────────────────────┘
```

---

## Error Handling

### Common Error Scenarios

#### 1. User Not Found (404)
```json
{
  "status": "error",
  "detail": "User not found"
}
```
**When**: `/get-user-role` called for non-existent user  
**Solution**: Ensure `/initialize-user-from-google` was called

#### 2. Missing Required Fields (400)
```json
{
  "status": "error",
  "detail": "Missing required fields: matricNumber, level"
}
```
**When**: `/register-student` called without all fields  
**Solution**: Validate form before submission

#### 3. No Face Detected (400)
```json
{
  "status": "error",
  "detail": "No face detected in the image"
}
```
**When**: Face image upload fails face detection  
**Solution**: Ensure face is clear, centered, well-lit

#### 4. MongoDB Connection Error (500)
```json
{
  "status": "error",
  "detail": "Error setting user role: [MongoDB error details]"
}
```
**When**: Database unavailable or connection drops  
**Solution**: Check MongoDB connection, retry operation

#### 5. Already Registered (400)
```json
{
  "status": "error",
  "detail": "User is already registered",
  "user": {
    "matricNumber": "2024/001",
    "department": "CS",
    "level": "200",
    "name": "John Doe"
  }
}
```
**When**: Student tries to register twice  
**Solution**: Redirect to profile/update page instead

---

## Data Validation

### Email Validation
- Comes from Clerk (already verified)
- Format: `user@provider.com`
- Must not be empty

### Matric Number Validation
- Format: `4 digits / 7-11 digits` (e.g., `2024/001234567`)
- Length: 11-15 characters total
- Must be unique per user

### Department Validation
- Must exist in `departments` collection
- Used to fetch available courses

### Level Validation
- Must exist in `levels` collection
- Must be valid for selected department

### Courses Validation
- Course IDs must exist in `courses` collection
- Courses must belong to selected department
- Can select multiple courses

### Face Image Validation
- File type: JPG, PNG, WebP
- Size: < 10MB (recommended)
- Must contain exactly one face
- Face must be clear and visible

---

## Field Mapping

| Form Field | MongoDB Field | Clerk Field | Required |
|-----------|--------------|------------|----------|
| Email | email | emailAddresses[0] | ✅ |
| Name | name | fullName or firstName + lastName | ✅ |
| Matric | matricNumber | - | ✅ (student only) |
| Department | department | - | ✅ |
| Level | level | - | ✅ (student only) |
| Courses | courses | - | ✅ |
| Face Image | GridFS `ref_{userId}.jpg` | - | ✅ (student only) |
| Role | role | - | ✅ |

---

## Timestamps

All timestamps use **UTC** in ISO 8601 format:
- `createdAt`: When user first created (sign-up)
- `registeredAt`: When user selected role + confirmed
- `lastUpdated`: Latest profile change
- `lastCoursesUpdate`: Latest courses change

Example:
```
2025-01-14T10:30:45.123456Z
```
