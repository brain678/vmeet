# Google OAuth Registration Flow - Verification Report

## Current Flow Analysis

### 1. Sign-up Process (✅ Working)
- User signs up via Clerk's Google OAuth integration
- After sign-up, redirected to `/role-selection`
- Clerk automatically creates user in Clerk system

### 2. Issues Identified 🔴

#### **Issue #1: MongoDB User Record Not Created on Google Sign-up**
- **Problem**: User object exists in Clerk but NO MongoDB record is created after Google sign-up
- **Location**: `set-user-role` endpoint only creates MongoDB record when user explicitly selects a role
- **Impact**: Users who sign up but close the browser before role selection have NO MongoDB entry
- **Current Flow**:
  1. User signs up with Google (Clerk handles)
  2. Redirects to `/role-selection` 
  3. `check-role-selection` looks for user in MongoDB → NOT FOUND
  4. Page asks user to select role
  5. Only when user clicks a role does MongoDB record get created (in `set-user-role`)

#### **Issue #2: No Initial MongoDB Record for Google Users**
- **Problem**: Initial basic user record should be created immediately after Google OAuth success
- **Missing**: Backend doesn't have an endpoint to create initial MongoDB record
- **Consequence**: If user navigates away before role selection, they're lost

#### **Issue #3: Email from Google OAuth Not Always Captured**
- **Problem**: Clerk provides email in `user.emailAddresses[0].emailAddress` but might be:
  - Unverified
  - Missing in some edge cases
  - Not consistently passed to backend

#### **Issue #4: Name Field Handling**
- **Problem**: Google OAuth provides `fullName` or `firstName`/`lastName`
- **Current**: Role selection expects `name` field
- **Risk**: Name might not be properly formatted when stored

### 3. Current Flow Chart

```
┌─────────────────────┐
│ User Signs Up       │
│ with Google OAuth   │
└──────────┬──────────┘
           │ (Clerk creates user)
           ▼
    ┌──────────────┐
    │ No MongoDB   │
    │ record yet   │
    └──────┬───────┘
           │
           ▼
┌─────────────────────────┐
│ Redirect to             │
│ /role-selection         │
└────────────┬────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ check-role-selection API call    │
│ Looks in MongoDB → NOT FOUND      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────┐
│ Show Role Selection Page │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ User clicks Student/Lecturer     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ set-user-role API                │
│ ✅ Creates MongoDB record        │
│ ✅ Sets role                     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────┐
│ Redirect to              │
│ /student-registration    │
│ or lecturer flow         │
└──────────────────────────┘
```

## Required Fixes

### Fix 1: Create MongoDB Record on Clerk Sign-up
**Solution**: Add middleware or post-auth hook to create initial MongoDB record
- Create lightweight initial record with just: userId, email, name, createdAt
- This ensures user exists in MongoDB from the start

### Fix 2: Ensure Consistent Data in set-user-role
**Current Implementation** (lines 1813-1860):
```python
@app.post("/set-user-role")
async def set_user_role(request: Request):
    # ✅ Creates MongoDB record with role
    # ✅ Saves department for lecturers
    # ✅ Saves courses for lecturers
```
**Status**: ✅ This is working correctly

### Fix 3: Verify Email Validation
**Current**: Email comes from Clerk's `emailAddresses[0]`
**Need to Check**: Email verification status

### Fix 4: Student Registration After Role Selection
**Current Flow** (student-registration page.tsx):
```tsx
// ✅ Checks if user is registered
// ✅ Pre-fills with existing data
// ✅ Captures face image
// ✅ Saves to MongoDB via register-student endpoint
```
**Status**: ✅ This is working correctly

### Fix 5: Lecturer Registration After Role Selection
**Current Flow** (role-selection page.tsx lines 300+):
```tsx
// Shows step-by-step form for:
// 1. Name (pre-filled from Clerk)
// 2. Email (pre-filled from Clerk)
// 3. Department selection
// 4. Course selection
// Then calls set-user-role which creates MongoDB record
```
**Status**: ✅ This is working correctly

## Implementation Checklist

- [ ] **Add pre-registration hook** - Create initial MongoDB record when Clerk sign-up completes
- [ ] **Add verification** - Ensure email is verified before user proceeds
- [ ] **Test Google sign-up flow end-to-end**
- [ ] **Test data persistence** - Verify data survives browser refresh
- [ ] **Test role switching** - Verify users can't change roles mid-registration
- [ ] **Test course/department sync** - Verify correct MongoDB entries

## Key Endpoints Involved

1. `/set-user-role` (POST) - Creates/updates user in MongoDB
2. `/check-role-selection` (POST) - Checks if user needs role selection
3. `/register-student` (POST) - Completes student registration
4. `/upload-face-image` (POST) - Stores student face data

## Recommendations

1. ✅ **Current set-user-role implementation is correct** - Properly saves to MongoDB
2. ⚠️ **Need post-signup hook** - Create minimal MongoDB record after Google OAuth
3. ✅ **Student registration flow is correct** - Properly syncs with MongoDB
4. ✅ **Lecturer registration flow is correct** - Properly syncs with MongoDB
5. ⚠️ **Consider adding:** User verification check before allowing role selection
