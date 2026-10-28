# Physical Attendance System – Fix & Optimization Guide

## Goal
Make the **physical / geofenced attendance** system fast, reliable, and able to handle 50–150 concurrent students checking in without timeouts or high memory usage.  
Focus on Phase 1 only (biggest impact, lowest risk). Do **not** add video-call features or complex scaling yet.

## Current Problems (must fix)

1. `FaceVerifier()` is created on **every request** → models are reloaded every time (very slow + high memory).
2. Reference face image is re-processed on every verification instead of using a cached embedding.
3. Heavy model (`buffalo_l`) + large `det_size=(640, 640)` is used.
4. Face verification logic is scattered between `main.py` (patches) and `routes/attendance.py`.
5. Fully synchronous processing – request blocks until InsightFace finishes.
6. Temporary files are written and read on every request.

## Phase 1 Requirements (implement these)

### 1. Singleton FaceVerifier
- Load InsightFace **once** when the application starts (or on first use) and reuse the same instance.
- Never create a new `FaceVerifier()` inside request handlers.
- Support CPU by default (`ctx_id=-1`).
- Prefer lighter model: `buffalo_s` or `buffalo_m` (not `buffalo_l`).
- Use smaller detection size: `det_size=(320, 320)` or `(480, 480)`.

### 2. Cached Face Embeddings
- When a student uploads/registers their face (`/upload-face-image`), compute the embedding **once** and store it in MongoDB (as a list of floats).
- During attendance verification (`/verify-face`), only:
  - Run detection + embedding on the **live** uploaded image.
  - Compare against the **stored** embedding from the database.
- Do **not** re-process the reference photo on every check-in.

### 3. Clean Architecture
- Move all face-related logic into `face_verification.py`.
- Keep attendance/geofence routes clean in `routes/attendance.py`.
- Remove scattered face verification patches from `main.py` as much as possible.
- Keep existing API contracts working (same request/response shapes) so the frontend does not break.

### 4. Performance & Reliability Rules
- FaceVerifier must be a singleton (module-level instance or dependency-injected once).
- Return clear, consistent error messages for:
  - No face detected
  - Multiple faces
  - Face too small / too large
  - Poor lighting / quality
  - Identity mismatch
  - Already marked attendance
- Prefer in-memory comparison of embeddings (cosine similarity or L2 distance).
- Avoid unnecessary disk I/O where possible.

## Preferred Technical Details

**Model preference (in order):**
1. `buffalo_s` (fastest, still good enough)
2. `buffalo_m`
3. `buffalo_l` only if accuracy is critically needed

**Detection size:** `(320, 320)` preferred for speed.

**Embedding storage:**
- Store as `List[float]` or binary in the user document in MongoDB.
- Example field: `faceEmbedding: [0.12, -0.05, ...]`

**Comparison:**
- Use cosine similarity (or L2 distance).
- Keep a reasonable threshold (e.g. cosine > 0.4–0.5 or equivalent L2 threshold). Make the threshold configurable.

**Singleton pattern example (preferred style):**
```python
# face_verification.py
_face_verifier = None

def get_face_verifier() -> FaceVerifier:
    global _face_verifier
    if _face_verifier is None:
        _face_verifier = FaceVerifier()
    return _face_verifier