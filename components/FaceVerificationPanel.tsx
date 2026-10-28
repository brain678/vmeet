"use client";
import React, { useState, useRef } from "react";
import Webcam from "react-webcam";
import { useUser } from "@clerk/nextjs";
import { BACKEND_URL } from '@/constants/config';
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface FaceVerificationPanelProps {
  onVerified: () => void;
  sessionId: string;
}

const FaceVerificationPanel: React.FC<FaceVerificationPanelProps> = ({ onVerified, sessionId }) => {
  const webcamRef = useRef<any>(null);
  const { user } = useUser();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasReferenceImage, setHasReferenceImage] = useState<boolean | null>(null);
  const [verified, setVerified] = useState(false);
  // Check for reference image on mount
  React.useEffect(() => {
    const checkReference = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`${BACKEND_URL}/check-reference-image?userId=${user.id}`);
        const data = await res.json();
        setHasReferenceImage(data.exists);
        if (!data.exists) {
          setMessage("❌ Please upload your reference face image in your profile first.");
        }
      } catch (e) {
        setHasReferenceImage(false);
        setMessage("❌ Error checking reference image");
      }
    };
    checkReference();
  }, [user?.id]);

  const captureImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setMessage("Image captured. Click 'Verify Face' to continue.");
    }
  };

  const retakeImage = () => {
    setCapturedImage(null);
    setMessage("");
  };

  const verifyFace = async () => {
    if (!user?.id || !capturedImage) return;
    setLoading(true);
    setMessage("Processing face verification...");
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      if (!blob || blob.size === 0) throw new Error('Captured image is empty');
      const formData = new FormData();
      formData.append("userId", user.id);
      formData.append("file", blob, "verify.jpg");
      let endpoint = `${BACKEND_URL}/verify-face`;
      if (!sessionId || sessionId.trim() === "") {
        endpoint = `${BACKEND_URL}/verify-face-no-session`;
      } else {
        formData.append("sessionId", sessionId);
      }
      const verifyResponse = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (!verifyResponse.ok) {
        let errorMsg = "Face verification failed";
        try {
          const contentType = verifyResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await verifyResponse.json();
            // Check for specific backend error messages
            if (typeof errorData.detail === 'string') {
              if (errorData.detail.toLowerCase().includes('no face match') || errorData.detail.toLowerCase().includes('not match')) {
                errorMsg = "Face does not match. Please try again.";
              } else {
                errorMsg = errorData.detail;
              }
            } else {
              errorMsg = JSON.stringify(errorData.detail);
            }
          } else {
            const text = await verifyResponse.text();
            if (text.toLowerCase().includes('no face match') || text.toLowerCase().includes('not match')) {
              errorMsg = "Face does not match. Please try again.";
            } else {
              errorMsg = text;
            }
          }
        } catch (e) {
          // fallback
        }
        throw new Error(errorMsg);
      }
      setVerified(true);
      setMessage("✅ Face verified successfully!");
      onVerified();
    } catch (err: any) {
      // If error message is our custom face not match, show it clearly
      if (err.message && err.message.toLowerCase().includes('face does not match')) {
        setMessage('❌ Face does not match. Please try again.');
      } else {
        setMessage(`❌ ${err.message || "Face verification failed"}`);
      }
      setCapturedImage(null);
    } finally {
      setLoading(false);
    }
  };

  if (hasReferenceImage === false) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Reference Image Required</AlertTitle>
        <AlertDescription>
          Please upload your reference face image in your profile before you can mark attendance.
        </AlertDescription>
      </Alert>
    );
  }

  if (verified) {
    return (
      <Alert className="mb-4 border-[#92D0AA] bg-[#E5F5EA] text-[#087A3E]">
        <AlertTitle>Face Verified</AlertTitle>
        <AlertDescription>You may now mark your attendance.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto mb-4 flex w-full max-w-md flex-col items-center rounded-2xl border border-[#E7DDF0] bg-white p-4 shadow-[0_8px_24px_rgba(71,38,96,0.12)] animate-fadeIn sm:p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F0E5F8] text-[#8437C8]">
        <span className="text-xl font-bold">1</span>
      </div>
      <h3 className="mb-1 text-center text-2xl font-bold tracking-tight text-[#2D1A3A]">Face Verification</h3>
      <p className="mb-4 text-center text-sm leading-5 text-[#6B6172] sm:text-base">Please verify your face before marking attendance.</p>
      <div className="w-full flex flex-col items-center">
        {!capturedImage ? (
          <>
            <div className="w-full flex justify-center">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="mb-4 aspect-video w-full max-w-xs rounded-xl border-2 border-[#B98BDC] bg-[#2D1A3A] object-cover shadow-md"
                mirrored={true}
                videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
              />
            </div>
            <button
              onClick={captureImage}
              disabled={loading}
              className="mb-2 w-full rounded-lg bg-[#8437C8] px-4 py-3 text-base font-semibold text-white shadow-md transition-all duration-150 hover:bg-[#6E27AE]"
            >
              {loading ? "Processing..." : "Capture Image"}
            </button>
          </>
        ) : (
          <>
            <div className="relative mb-4 w-full flex justify-center">
              <img src={capturedImage} alt="Captured" className="aspect-video w-full max-w-xs rounded-xl border-2 border-[#B98BDC] object-cover shadow-md" />
              <button
                onClick={retakeImage}
                className="absolute right-2 top-2 rounded-full bg-[#8437C8] p-2 text-white shadow-md hover:bg-[#6E27AE]"
                title="Retake photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <button
              onClick={verifyFace}
              disabled={loading}
              className="mb-2 w-full rounded-lg bg-[#8437C8] px-4 py-3 text-base font-semibold text-white shadow-md transition-all duration-150 hover:bg-[#6E27AE]"
            >
              {loading ? "Verifying..." : "Verify Face"}
            </button>
          </>
        )}
      </div>
      {message && <p className={`mt-3 text-center text-sm ${message.startsWith('✅') ? 'text-[#087A3E]' : message.startsWith('❌') ? 'text-red-600' : 'text-[#6B6172]'}`}>{message}</p>}
    </div>
  );
};

export default FaceVerificationPanel;
