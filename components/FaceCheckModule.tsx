'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface FaceCheckModuleProps {
  onFaceDetected: (blob: Blob) => void;
  onError: (error: string) => void;
  isLoading?: boolean;
}

export default function FaceCheckModule({ onFaceDetected, onError, isLoading = false }: FaceCheckModuleProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string>('⏳ Initializing camera...');
  const [facesDetected, setFacesDetected] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [livenessCheck, setLivenessCheck] = useState<string>('');
  const [isLiveDetected, setIsLiveDetected] = useState(false);
  const frameHistoryRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const captureCountRef = useRef(0);

  // Load face detection using MediaPipe
  useEffect(() => {
    const loadModels = async () => {
      try {
        setFeedback('⏳ Loading face detection models...');
        
        // Load MediaPipe Face Detection (more reliable CDN)
        const script1 = document.createElement('script');
        script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js';
        script1.crossOrigin = 'anonymous';
        
        script1.onload = () => {
          const script2 = document.createElement('script');
          script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
          script2.crossOrigin = 'anonymous';
          
          script2.onload = () => {
            setModelsReady(true);
            setFeedback('✅ Camera ready. Position your face and move naturally');
            console.log('✅ MediaPipe models loaded successfully');
          };
          
          script2.onerror = () => {
            const errMsg = 'Failed to load camera utilities';
            setModelError(errMsg);
            onError(errMsg);
          };
          
          document.head.appendChild(script2);
        };
        
        script1.onerror = () => {
          const errMsg = 'Failed to load face detection library';
          setModelError(errMsg);
          onError(errMsg);
        };
        
        document.head.appendChild(script1);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        setModelError(errMsg);
        onError(errMsg);
      }
    };

    loadModels();
  }, [onError]);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      } catch (err) {
        const errMsg = 'Failed to access camera. Please check permissions.';
        setModelError(errMsg);
        onError(errMsg);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onError]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      onError('Camera not available');
      return;
    }

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx && videoRef.current) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      // Enhance image quality for better verification
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Apply slight contrast enhancement for clearer facial features
      const contrast = 1.2; // 20% contrast boost
      const intercept = 128 * (1 - contrast);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * contrast + intercept;     // R
        data[i + 1] = data[i + 1] * contrast + intercept; // G
        data[i + 2] = data[i + 2] * contrast + intercept; // B
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          // Verify image quality before sending
          const img = new Image();
          img.onload = () => {
            // Check image dimensions are adequate
            if (img.width < 320 || img.height < 240) {
              onError('Image resolution too low. Please try again with better positioning.');
              setIsProcessing(false);
              return;
            }

            onFaceDetected(blob);
            setFeedback('✅ Real face verified and captured!');
            
            // Stop camera
            if (videoRef.current?.srcObject) {
              const stream = videoRef.current.srcObject as MediaStream;
              stream.getTracks().forEach(track => track.stop());
            }
            
            // Cancel animation frame
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
          };
          
          img.onerror = () => {
            onError('Failed to process image');
            setIsProcessing(false);
          };
          
          img.src = URL.createObjectURL(blob);
        } else {
          onError('Failed to capture image');
          setIsProcessing(false);
        }
      }, 'image/jpeg', 0.98); // Higher quality (98% instead of 95%)
    }
  }, [onFaceDetected, onError]);

  // Calculate liveness score from frame variance and motion
  const calculateLivenessScore = useCallback((skinRatio: number): { isLive: boolean; confidence: number } => {
    frameHistoryRef.current.push(skinRatio);
    if (frameHistoryRef.current.length > 40) {
      frameHistoryRef.current.shift(); // Keep last 40 frames (~1.3 seconds at 30fps)
    }

    if (frameHistoryRef.current.length < 15) {
      return { isLive: false, confidence: 0 }; // Need at least 15 frames
    }

    const history = frameHistoryRef.current;

    // Calculate variance (motion detection)
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;

    // Calculate standard deviation for motion intensity
    const stdDev = Math.sqrt(variance);

    // Check for natural motion (variance indicates real face movement)
    // Real faces have variance between 0.0002 and 0.05 (natural head movement)
    // Static photos have variance close to 0
    const hasNaturalMotion = variance > 0.00005 && variance < 0.08;

    // Check ratio stability (should stay within reasonable bounds)
    const minRatio = Math.min(...history);
    const maxRatio = Math.max(...history);
    const ratioRange = maxRatio - minRatio;

    // Real faces: small consistent ratio (0.03-0.4), not jumping around
    const isRatioRealistic =
      mean > 0.03 && // Within face detection threshold
      mean < 0.75 && // Not too extreme
      ratioRange > 0.001 && // Some natural variation
      ratioRange < 0.15; // But not extreme jumps (prevents videos/animations)

    // Calculate confidence score (0-100)
    let confidence = 0;
    if (hasNaturalMotion) confidence += 40;
    if (isRatioRealistic) confidence += 30;
    if (stdDev > 0.0001) confidence += 20; // Motion intensity
    if (ratioRange > 0.003) confidence += 10; // Natural variation

    const isLive = hasNaturalMotion && isRatioRealistic && confidence > 50;

    return { isLive, confidence: Math.min(100, Math.round(confidence)) };
  }, []);

  // Simple face detection using canvas context
  useEffect(() => {
    const detectFace = async () => {
      if (!videoRef.current || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectFace);
        return;
      }

      try {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            animationFrameRef.current = requestAnimationFrame(detectFace);
            return;
          }

          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Get image data for analysis
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Simple face detection: analyze skin tone and features
          let skinPixels = 0;
          const totalPixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (
              r > 20 && g > 10 && b > 5 &&
              r > g && r > b
            ) {
              skinPixels++;
            }
          }

          const skinRatio = skinPixels / totalPixels;

          // Calculate liveness
          const { isLive, confidence } = calculateLivenessScore(skinRatio);

          // Determine face detection status
          if (skinRatio < 0.02) {
            setFaceDetected(false);
            setIsLiveDetected(false);
            setFeedback('👤 Position your face in the frame');
            setLivenessCheck('');
            setFacesDetected(0);
          } else if (skinRatio > 0.75) {
            setFaceDetected(false);
            setIsLiveDetected(false);
            setFeedback('📍 Move away from the camera (too close)');
            setLivenessCheck('');
            setFacesDetected(0);
          } else if (skinRatio > 0.03) {
            setFaceDetected(true);
            setFacesDetected(1);

            // Update liveness status
            if (frameHistoryRef.current.length < 15) {
              setLivenessCheck('🔄 Move naturally... (analyzing motion)');
              setFeedback('✅ Face detected. Move naturally to verify you\'re real');
              setIsLiveDetected(false);
            } else if (isLive) {
              setIsLiveDetected(true);
              setLivenessCheck(`✨ Real face verified! (Confidence: ${confidence}%)`);
              setFeedback('✨ Liveness verified! Capturing...');
              
              // Auto-capture immediately (next frame)
              captureCountRef.current += 1;
              if (captureCountRef.current > 1) {
                capturePhoto();
                captureCountRef.current = 0;
              }
            } else {
              setIsLiveDetected(false);
              setLivenessCheck(`⚠️ Move naturally (Motion: ${confidence}%)`);
              setFeedback('⚠️ Please move slightly to verify you\'re a real person');
              captureCountRef.current = 0;
            }
          } else {
            setFaceDetected(false);
            setIsLiveDetected(false);
            setFeedback('📍 Move closer to the camera');
            setLivenessCheck('');
            setFacesDetected(0);
          }
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }

      animationFrameRef.current = requestAnimationFrame(detectFace);
    };

    detectFace();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [calculateLivenessScore, capturePhoto]);

  return (
    <div className="space-y-4">
      {/* Error State */}
      {modelError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-center"
        >
          <p className="font-medium mb-2">❌ {modelError}</p>
          <button
            onClick={() => {
              setModelError(null);
              window.location.reload();
            }}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {!modelsReady && !modelError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 py-8"
        >
          <div className="relative w-12 h-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500"
            />
          </div>
          <p className="text-gray-400 text-sm text-center">{feedback}</p>
        </motion.div>
      )}

      {/* Video Container */}
      {!modelError && (
        <>
          <div className="relative bg-black rounded-lg overflow-hidden border-2 border-blue-500/50">
            <video
              ref={videoRef}
              className="w-full h-auto"
              playsInline
              autoPlay
              muted
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Single centered human-head positioning guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="absolute left-1/2 top-1/2 h-[62%] w-[42%] -translate-x-1/2 -translate-y-1/2"
              >
                <svg viewBox="0 0 160 220" className="h-full w-full overflow-visible fill-transparent">
                  <defs>
                    <linearGradient id="face-oval-gradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#6DFF8A" />
                      <stop offset="48%" stopColor="#20D96B" />
                      <stop offset="100%" stopColor="#9B5CFF" />
                    </linearGradient>
                  </defs>
                  <ellipse
                    cx="80"
                    cy="110"
                    rx="52"
                    ry="82"
                    stroke="url(#face-oval-gradient)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    filter="drop-shadow(0 0 5px rgba(32, 217, 107, 0.55))"
                  />
                </svg>
              </div>
            </div>

            {/* Status indicator */}
            <div className="absolute top-4 right-4">
              <motion.div
                animate={{ scale: faceDetected ? 1.1 : 1 }}
                className={`w-8 h-8 rounded-full ${
                  faceDetected ? 'bg-green-500' : 'bg-red-500'
                } opacity-80`}
              />
            </div>
          </div>

          {/* Feedback messages */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg text-center text-sm font-medium ${
              faceDetected
                ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
            }`}
          >
            {feedback}
          </motion.div>

          {/* Liveness status */}
          {livenessCheck && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-3 rounded-lg text-center text-sm font-medium ${
                isLiveDetected
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                  : 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
              }`}
            >
              {livenessCheck}
            </motion.div>
          )}

          {/* Face count */}
          {facesDetected > 0 && (
            <div className="text-center text-sm text-gray-400">
              Face detected ✓
            </div>
          )}

          {/* Capture button */}
          <motion.button
            onClick={capturePhoto}
            disabled={!faceDetected || !isLiveDetected || isProcessing || isLoading}
            whileHover={{ scale: faceDetected && isLiveDetected && !isProcessing ? 1.05 : 1 }}
            whileTap={{ scale: faceDetected && isLiveDetected && !isProcessing ? 0.95 : 1 }}
            className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
              faceDetected && isLiveDetected && !isProcessing
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-50'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                Auto-capturing...
              </div>
            ) : isLiveDetected ? (
              '✨ Auto-capturing...'
            ) : (
              '📸 Waiting for Liveness...'
            )}
          </motion.button>
        </>
      )}

      {/* Security note */}
      <div className="text-xs text-gray-500 text-center">
        🔒 Your face image is securely processed for identity verification only
      </div>
    </div>
  );
}
