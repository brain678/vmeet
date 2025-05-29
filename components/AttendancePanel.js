import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { useUser } from "@clerk/nextjs";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function AttendancePanel({ sessionId }) {  const webcamRef = useRef(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasWebcam, setHasWebcam] = useState(true);
  const { user } = useUser();
  const userId = user?.id;

  useEffect(() => {    // Check webcam availability when component mounts
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setHasWebcam(true))
      .catch(() => {
        setHasWebcam(false);
        setMessage("⚠️ Webcam access is required for attendance");
      });
  }, []);
  const captureAndVerify = async () => {
    if (!userId) {
      setMessage("⚠️ User not identified. Please sign in.");
      return;
    }

    if (!sessionId) {
      setMessage("⚠️ Invalid session ID");
      return;
    }

    if (!hasWebcam) {
      setMessage("⚠️ Webcam access is required for attendance");
      return;
    }

    if (!webcamRef.current) {
      setMessage("⚠️ Webcam not initialized");
      return;
    }

    setLoading(true);
    setMessage("📸 Capturing image...");
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setMessage("❌ Could not capture image from webcam");
        return;
      }

      setMessage("🔍 Verifying your face...");
      const blob = await (await fetch(imageSrc)).blob();
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("sessionId", sessionId);
      formData.append("file", blob, "capture.jpg");
      
      console.log("Sending attendance verification request:", {
        userId,
        sessionId,
        backendUrl: BACKEND_URL
      });
        const res = await fetch(`${BACKEND_URL}/verify-face`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        setMessage(`✅ Attendance marked successfully at ${timestamp}`);
      } else if (res.status === 400 && data.detail?.includes("already marked")) {
        const takenAt = new Date(data.timestamp).toLocaleTimeString();
        setMessage(`⚠️ Attendance already marked at ${takenAt}`);
      } else {
        setMessage(`❌ ${data.detail || "Verification failed"}`);
      }
    } catch (err) {
      console.error("Attendance verification error:", err);
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">      <div>
        <h3 className="text-lg font-semibold mb-4">Attendance Panel</h3>
        {hasWebcam ? (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={280}
            height={210}
            className="rounded-lg border border-[#444] shadow"
            mirrored={true}
          />
        ) : (
          <div className="w-[280px] h-[210px] bg-[#2a2e37] rounded-lg border border-[#444] shadow flex items-center justify-center">
            <p className="text-red-400 text-center px-4">
              Cannot access webcam. Please allow camera access and refresh the page.
            </p>
          </div>
        )}
        <button
          onClick={captureAndVerify}
          disabled={loading || !hasWebcam}
          className={`mt-3 w-full font-medium p-2 rounded-lg transition ${
            loading || !hasWebcam
              ? "bg-gray-600 cursor-not-allowed opacity-60"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {loading ? "Processing..." : "Click to Record Attendance"}
        </button>
        <p className="mt-2 text-sm">{message}</p>
      </div>
    </div>
  );
}
