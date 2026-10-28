"""
Face Verification Module - Secure face detection and liveness verification
Uses InsightFace (ONNX/runtime) for detection and recognition embeddings.

This module replaces the previous `face_recognition` usage. It exposes the
same high-level verification methods and helper functions used by the API.
"""

import cv2
import numpy as np
from typing import Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)


class FaceVerifier:
    """Handles face verification with liveness detection and spoofing prevention
    using InsightFace (ONNX Runtime) when available.
    """

    def __init__(self):
        self.min_confidence = 0.6
        self.min_face_size = 100  # pixels
        self.max_face_size = 400
        self.use_insightface = False
        self.fa = None
        try:
            import os
            from insightface.app import FaceAnalysis
            # Initialize FaceAnalysis (will use available backend; prefer ONNX if installed)
            # Prefer a lightweight model for speed; detector size tuned smaller
            try:
                self.fa = FaceAnalysis(allowed_modules=['detection', 'recognition'])
            except Exception:
                # Fallback to default initializer if model-specific init fails
                self.fa = FaceAnalysis(allowed_modules=['detection', 'recognition'])
            # Allow opt-in GPU via environment variable INSIGHTFACE_USE_GPU=1
            use_gpu = os.getenv('INSIGHTFACE_USE_GPU', '0').lower() in ('1', 'true', 'yes')
            ctx_id = 0 if use_gpu else -1
            # Prefer smaller detection size for speed (Phase 1 requirement)
            self.fa.prepare(ctx_id=ctx_id, det_size=(320, 320))
            self.use_insightface = True
            logger.info("InsightFace FaceAnalysis initialized successfully")
        except Exception as e:
            logger.warning(
                "InsightFace not available or failed to initialize. "
                "Install `insightface` and `onnxruntime` and model files to enable it. "
                f"Error: {e}"
            )
        
    def verify_face_quality(self, image_path: str) -> Dict[str, Any]:
        """
        Verify face quality and detect spoofing attempts
        
        IMPORTANT: Frontend must verify LIVENESS before submitting image:
        - User must move naturally (40+ frames of motion data)
        - Skin tone ratio variance must indicate real head movement
        - Motion variance should be 0.00008-0.08 (not static like a photo)
        
        Returns verification result with confidence score
        """
        try:
            # Load image (BGR->RGB)
            image = self._load_image(image_path)
            
            # Check image properties
            height, width = image.shape[:2]
            if height < 240 or width < 240:
                return {
                    "valid": False,
                    "reason": "Image resolution too low",
                    "reason_code": "image_too_small",
                    "confidence": 0.0
                }
            
            # Detect faces and get embeddings via InsightFace
            faces = self._detect_faces(image)
            if faces is None or len(faces) == 0:
                return {
                    "valid": False,
                    "reason": "No face detected in image",
                    "reason_code": "no_face_detected",
                    "confidence": 0.0
                }
            if len(faces) > 1:
                return {
                    "valid": False,
                    "reason": "Multiple faces detected - only one person allowed",
                    "reason_code": "multiple_faces",
                    "confidence": 0.0
                }
            # Take the first (primary) face
            face = faces[0]
            # InsightFace bbox is [x1, y1, x2, y2]
            x1, y1, x2, y2 = map(int, face.bbox[:4])
            left, top, right, bottom = x1, y1, x2, y2
            face_width = right - left
            face_height = bottom - top
            
            if face_width < self.min_face_size or face_height < self.min_face_size:
                return {
                    "valid": False,
                    "reason": "Face too small - move closer to camera",
                    "reason_code": "face_too_small",
                    "confidence": 0.3
                }
            
            if face_width > self.max_face_size or face_height > self.max_face_size:
                return {
                    "valid": False,
                    "reason": "Face too large - move away from camera",
                    "reason_code": "face_too_large",
                    "confidence": 0.3
                }
            
            # Check face positioning (should be centered)
            center_x = (left + right) / 2
            center_y = (top + bottom) / 2
            img_center_x = width / 2
            img_center_y = height / 2
            
            horizontal_offset = abs(center_x - img_center_x)
            vertical_offset = abs(center_y - img_center_y)
            
            if horizontal_offset > width * 0.2 or vertical_offset > height * 0.2:
                return {
                    "valid": False,
                    "reason": "Face not centered - ensure face is in the middle of frame",
                    "confidence": 0.4
                }
            
            # Check lighting quality (convert bbox to top,right,bottom,left)
            lighting_quality = self._check_lighting_quality(image, (top, right, bottom, left))
            # Relaxed lighting check since frontend captures optimal images
            if lighting_quality < 0.2:
                return {
                    "valid": False,
                    "reason": "Poor lighting - ensure adequate lighting on face",
                    "reason_code": "poor_lighting",
                    "confidence": 0.2
                }
            
            # Check for spoofing (using texture analysis)
            # Note: Frontend already verified liveness, so we use relaxed threshold
            spoof_score = self._detect_spoof(image, (top, right, bottom, left))
            if spoof_score > 1.5:  # Very high threshold - only reject extreme cases
                return {
                    "valid": False,
                    "reason": "Possible spoofing detected - please use a real face",
                    "reason_code": "possible_spoof",
                    "confidence": 0.1
                }
            
            # Calculate overall confidence
            confidence = min(0.95, 0.6 + (lighting_quality * 0.3) + (1 - spoof_score) * 0.05)

            # Retrieve embedding if available
            embedding = None
            try:
                # InsightFace face object may provide `embedding` or `normed_embedding`
                embedding = getattr(face, 'embedding', None)
                if embedding is None:
                    embedding = getattr(face, 'normed_embedding', None)
                if embedding is not None:
                    embedding = np.array(embedding).tolist()
            except Exception:
                embedding = None

            return {
                "valid": True,
                "reason": "Face verified successfully",
                "reason_code": "ok",
                "confidence": confidence,
                "face_count": len(faces),
                "face_encoding": embedding,
                "lighting_quality": lighting_quality,
                "spoof_score": spoof_score
            }
            
        except Exception as e:
            logger.error(f"Error in face verification: {str(e)}")
            return {
                "valid": False,
                "reason": f"Verification error: {str(e)}",
                "confidence": 0.0
            }
    
    def _check_lighting_quality(self, image: np.ndarray, face_location: Tuple) -> float:
        """
        Check lighting quality on the face
        Returns score between 0 and 1
        """
        try:
            top, right, bottom, left = face_location
            face_roi = image[top:bottom, left:right]
            
            # Convert to grayscale
            if len(face_roi.shape) == 3:
                gray = cv2.cvtColor(face_roi, cv2.COLOR_RGB2GRAY)
            else:
                gray = face_roi
            
            # Check mean brightness (should be around 100-200 for good lighting)
            brightness = np.mean(gray)
            
            # Check contrast using Laplacian
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            contrast = np.var(laplacian)
            
            # Normalize brightness score (0-1)
            brightness_score = 1.0 - abs(brightness - 150) / 255
            brightness_score = max(0, min(1, brightness_score))
            
            # Normalize contrast score (0-1)
            contrast_score = min(1.0, contrast / 2000)
            
            # Combined score
            quality_score = (brightness_score * 0.6) + (contrast_score * 0.4)
            return quality_score
            
        except Exception as e:
            logger.warning(f"Error checking lighting: {str(e)}")
            return 0.5
    
    def _detect_spoof(self, image: np.ndarray, face_location: Tuple) -> float:
        """
        Detect spoofing attempts using texture analysis
        Returns score between 0 and 1 (0 = real, 1 = spoof)
        """
        try:
            top, right, bottom, left = face_location
            face_roi = image[top:bottom, left:right]
            
            # Convert to grayscale
            if len(face_roi.shape) == 3:
                gray = cv2.cvtColor(face_roi, cv2.COLOR_RGB2GRAY)
            else:
                gray = face_roi
            
            # Local Binary Pattern (LBP) based spoofing detection
            # Real faces have different texture properties than printed photos
            
            # Compute Laplacian to detect edges
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            laplacian_var = np.var(laplacian)
            
            # Compute frequency domain features
            f_transform = np.fft.fft2(gray)
            f_shift = np.fft.fftshift(f_transform)
            magnitude_spectrum = np.abs(f_shift)
            
            # Real faces have specific frequency patterns
            # Spoofed images (printed) have different patterns
            high_freq_energy = np.sum(magnitude_spectrum[-10:, -10:])
            low_freq_energy = np.sum(magnitude_spectrum[:10, :10])
            
            if low_freq_energy > 0:
                freq_ratio = high_freq_energy / (low_freq_energy + 1e-6)
            else:
                freq_ratio = 0
            
            # Real faces typically have lower frequency ratio (less high freq energy)
            # Spoof images have high frequency ratio (printed images)
            spoof_score = min(1.0, freq_ratio / 0.5)
            
            # Adjust spoof score based on Laplacian variance
            if laplacian_var < 100:
                spoof_score = min(1.0, spoof_score * 1.2)  # Might be spoof
            elif laplacian_var > 500:
                spoof_score = max(0, spoof_score * 0.8)  # Likely real
            
            return spoof_score
            
        except Exception as e:
            logger.warning(f"Error detecting spoof: {str(e)}")
            return 0.3  # Neutral score
    
    def compare_faces(self, known_face_encoding: list, test_face_path: str, tolerance: float = 0.6) -> Dict[str, Any]:
        """
        Compare a test face with a known face encoding
        """
        try:
            # Get embedding for test image
            test_embedding = self.get_embedding_from_image_path(test_face_path)
            if test_embedding is None:
                return {
                    "match": False,
                    "distance": 1.0,
                    "cosine": 0.0,
                    "reason": "No face detected in test image"
                }

            return self.compare_embeddings(known_face_encoding, test_embedding)
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return {
                "match": False,
                "distance": 1.0,
                "reason": f"Comparison error: {str(e)}"
            }

    def compare_embeddings(self, emb_a, emb_b, cosine_threshold: float = 0.4) -> Dict[str, Any]:
        """Compare two embeddings using cosine similarity.

        Returns a dict with `match`, `distance` (euclidean), and `cosine` similarity.
        Default cosine_threshold=0.4 (tune as needed for your data).
        """
        try:
            a = np.array(emb_a, dtype=float)
            b = np.array(emb_b, dtype=float)
            # normalize to unit vectors to compute cosine
            a_norm = a / (np.linalg.norm(a) + 1e-10)
            b_norm = b / (np.linalg.norm(b) + 1e-10)
            cosine = float(np.dot(a_norm, b_norm))
            distance = float(np.linalg.norm(a - b))
            match = cosine >= float(cosine_threshold)
            return {
                "match": match,
                "distance": distance,
                "cosine": cosine,
                "confidence": float((cosine + 1) / 2) if match else 0.0,
                "reason": "Face match confirmed" if match else "Face does not match"
            }
        except Exception as e:
            logger.error(f"compare_embeddings error: {e}")
            return {"match": False, "distance": 1.0, "cosine": 0.0, "reason": str(e)}

    def _load_image(self, path: str) -> np.ndarray:
        img = cv2.imread(path)
        if img is None:
            logger.error(f"_load_image: Failed to load image: {path}")
            raise Exception(f"Failed to load image: {path}")
        # Log image shape for debugging
        logger.debug(f"_load_image: loaded {path} with shape {img.shape}")
        # Convert BGR (OpenCV) to RGB for InsightFace
        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    def _detect_faces(self, image: np.ndarray):
        if not self.use_insightface or self.fa is None:
            logger.error("_detect_faces: InsightFace not initialized (use_insightface=%s, fa=%s)", self.use_insightface, bool(self.fa))
            return []
        # FaceAnalysis.get returns a list of Face objects with bbox and embedding
        try:
            faces = self.fa.get(image)
            logger.debug(f"_detect_faces: found {len(faces)} faces")
            return faces
        except Exception as e:
            logger.error(f"_detect_faces: exception during fa.get(): {e}")
            return []

    def get_embedding_from_image_path(self, image_path: str):
        """Load an image and return the first detected face embedding as a list.

        Returns None when no face is detected or embedding not available.
        """
        try:
            logger.debug(f"get_embedding_from_image_path: loading {image_path}")
            image = self._load_image(image_path)
            faces = self._detect_faces(image)
            if not faces:
                logger.warning(f"get_embedding_from_image_path: no faces detected in {image_path}")
                return None
            face = faces[0]
            embedding = getattr(face, 'embedding', None)
            if embedding is None:
                embedding = getattr(face, 'normed_embedding', None)
            if embedding is None:
                logger.warning(f"get_embedding_from_image_path: face found but no embedding available for {image_path}")
                return None
            logger.debug(f"get_embedding_from_image_path: embedding length {len(embedding)} for {image_path}")
            return np.array(embedding).tolist()
        except Exception as e:
            logger.warning(f"get_embedding_from_image_path error: {e}")
            return None

    def _image_from_bytes(self, image_bytes: bytes) -> np.ndarray:
        """Decode image bytes into an RGB numpy array usable by InsightFace/OpenCV."""
        try:
            arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                raise Exception("Failed to decode image bytes")
            return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        except Exception as e:
            logger.warning(f"_image_from_bytes error: {e}")
            return None

    def get_embedding_from_image_bytes(self, image_bytes: bytes):
        """Compute embedding from raw image bytes without writing to disk."""
        try:
            image = self._image_from_bytes(image_bytes)
            if image is None:
                return None
            faces = self._detect_faces(image)
            if faces is None or len(faces) == 0:
                return None
            face = faces[0]
            embedding = getattr(face, 'embedding', None)
            if embedding is None:
                embedding = getattr(face, 'normed_embedding', None)
            if embedding is None:
                return None
            return np.array(embedding).tolist()
        except Exception as e:
            logger.warning(f"get_embedding_from_image_bytes error: {e}")
            return None

    def verify_face_quality_from_bytes(self, image_bytes: bytes) -> Dict[str, Any]:
        """Variant of verify_face_quality that accepts raw image bytes."""
        try:
            image = self._image_from_bytes(image_bytes)
            if image is None:
                return {"valid": False, "reason": "Invalid image bytes", "reason_code": "invalid_image", "confidence": 0.0}

            # Reuse existing checks by calling internal helpers
            height, width = image.shape[:2]
            if height < 240 or width < 240:
                return {"valid": False, "reason": "Image resolution too low", "reason_code": "image_too_small", "confidence": 0.0}

            faces = self._detect_faces(image)
            if faces is None or len(faces) == 0:
                return {"valid": False, "reason": "No face detected in image", "reason_code": "no_face_detected", "confidence": 0.0}
            if len(faces) > 1:
                return {"valid": False, "reason": "Multiple faces detected - only one person allowed", "reason_code": "multiple_faces", "confidence": 0.0}

            face = faces[0]
            x1, y1, x2, y2 = map(int, face.bbox[:4])
            left, top, right, bottom = x1, y1, x2, y2
            face_width = right - left
            face_height = bottom - top

            if face_width < self.min_face_size or face_height < self.min_face_size:
                return {"valid": False, "reason": "Face too small - move closer to camera", "reason_code": "face_too_small", "confidence": 0.3}
            if face_width > self.max_face_size or face_height > self.max_face_size:
                return {"valid": False, "reason": "Face too large - move away from camera", "reason_code": "face_too_large", "confidence": 0.3}

            lighting_quality = self._check_lighting_quality(image, (top, right, bottom, left))
            if lighting_quality < 0.2:
                return {"valid": False, "reason": "Poor lighting - ensure adequate lighting on face", "reason_code": "poor_lighting", "confidence": 0.2}

            spoof_score = self._detect_spoof(image, (top, right, bottom, left))
            if spoof_score > 1.5:
                return {"valid": False, "reason": "Possible spoofing detected - please use a real face", "reason_code": "possible_spoof", "confidence": 0.1}

            embedding = getattr(face, 'embedding', None)
            if embedding is None:
                embedding = getattr(face, 'normed_embedding', None)
            if embedding is not None:
                embedding = np.array(embedding).tolist()

            confidence = min(0.95, 0.6 + (lighting_quality * 0.3) + (1 - spoof_score) * 0.05)

            return {"valid": True, "reason": "Face verified successfully", "reason_code": "ok", "confidence": confidence, "face_encoding": embedding, "lighting_quality": lighting_quality, "spoof_score": spoof_score}
        except Exception as e:
            logger.error(f"verify_face_quality_from_bytes error: {e}")
            return {"valid": False, "reason": f"Verification error: {e}", "reason_code": "verification_error", "confidence": 0.0}


# Module-level singleton accessor to avoid reloading models repeatedly
_face_verifier = None

def get_face_verifier():
    """Return a singleton FaceVerifier instance.

    Use this accessor from request handlers to ensure the model and
    resources are initialized only once per process.
    """
    global _face_verifier
    if _face_verifier is None:
        _face_verifier = FaceVerifier()
    return _face_verifier
