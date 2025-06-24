import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { useUser } from "@clerk/nextjs";
import { BACKEND_URL } from '@/constants/config';

export default function AttendancePanel({ sessionId }) {
  const webcamRef = useRef(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMarkedAttendance, setHasMarkedAttendance] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [hasReferenceImage, setHasReferenceImage] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { user } = useUser();
  const userId = user?.id;
  useEffect(() => {
    const checkStatus = async () => {
      if (!userId || !sessionId) {
        console.log("[AttendancePanel] Missing user ID or session ID:", { userId, sessionId });
        return;
      }

      if (checkingStatus) {
        console.log("[AttendancePanel] Status check already in progress, skipping");
        return;
      }
      
      console.log("[AttendancePanel] Checking status for:", { sessionId, userId });
      setCheckingStatus(true);
      setMessage("Checking status...");
      
      try {        // Check if reference image exists
        console.log("[AttendancePanel] Checking reference image...");
        try {
          const refImageResponse = await fetch(
            `${BACKEND_URL}/check-reference-image?userId=${userId}`
          );
          const refImageData = await refImageResponse.json();
          console.log("[AttendancePanel] Reference image response:", refImageData);
          
          if (!refImageResponse.ok) {
            throw new Error("Failed to check reference image");
          }
          
          setHasReferenceImage(refImageData.exists);
          if (!refImageData.exists) {
            setMessage("❌ Please upload your reference face image first");
            return;
          }
        } catch (error) {
          console.error("[AttendancePanel] Error checking reference image:", error);
          setHasReferenceImage(false);
          setMessage("❌ Error checking reference image");
          return;
        }

        // Check if session is active
        const sessionResponse = await fetch(
          `${BACKEND_URL}/get-session-status?sessionId=${sessionId}`
        );        const sessionData = await sessionResponse.json();
        console.log("[AttendancePanel] Session status response:", sessionData);
        
        if (!sessionResponse.ok) {
          console.log("[AttendancePanel] Error getting session status:", sessionData);
          throw new Error(sessionData.detail || "Failed to check session status");
        }

        const isActive = sessionData.isActive === true;
        console.log("[AttendancePanel] Is session active?", { isActive, sessionData });
        
        setSessionActive(isActive);
        
        if (!isActive) {
          console.log("[AttendancePanel] Session not active:", sessionData);
          setMessage("❌ Attendance session is not active");
          return;
        }

        // Check if already marked attendance
        const attendanceResponse = await fetch(
          `${BACKEND_URL}/get-attendance-status?userId=${userId}&sessionId=${sessionId}`
        );
        const attendanceData = await attendanceResponse.json();
        console.log("[AttendancePanel] Attendance status response:", attendanceData);
        
        if (attendanceResponse.ok && attendanceData.hasMarked) {
          setHasMarkedAttendance(true);
          setMessage("✅ Attendance already marked for this session");
        } else {
          setMessage("Ready to mark attendance");
        }
      } catch (error) {
        console.error("[AttendancePanel] Error checking status:", error);
        setMessage("❌ Error checking attendance status. Will retry...");
      } finally {
        setCheckingStatus(false);
      }
    };
    
    // Initial check
    checkStatus();
    
    // Poll for status updates every 10 seconds
    const intervalId = setInterval(checkStatus, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [userId, sessionId]);

  useEffect(() => {
    const checkSessionStatus = async () => {
      if (!userId || !sessionId || checkingStatus) return;
      
      try {
        setCheckingStatus(true);
        const sessionResponse = await fetch(
          `${BACKEND_URL}/get-session-status?sessionId=${sessionId}`
        );
        const sessionData = await sessionResponse.json();
        
        if (sessionResponse.ok) {
          setSessionActive(sessionData.isActive);
          if (!sessionData.isActive) {
            setMessage("❌ Attendance session has ended");
            return;
          }
          
          // Check if student has already marked attendance
          const attendanceResponse = await fetch(
            `${BACKEND_URL}/check-attendance-status?userId=${userId}&sessionId=${sessionId}`
          );
          const attendanceData = await attendanceResponse.json();
          
          if (attendanceResponse.ok) {
            setHasMarkedAttendance(attendanceData.hasMarkedAttendance || false);
            if (attendanceData.hasMarkedAttendance) {
              setMessage("✅ Attendance already marked for this session");
            } else {
              setMessage("Ready to mark attendance");
            }
          }
        }
      } catch (error) {
        console.error("[AttendancePanel] Error checking status:", error);
        setMessage("❌ Error checking session status. Will retry...");
      } finally {
        setCheckingStatus(false);
      }
    };

    // Check status immediately and then every 30 seconds
    checkSessionStatus();
    const intervalId = setInterval(checkSessionStatus, 30000);

    return () => clearInterval(intervalId);
  }, [userId, sessionId]);

  const captureImage = () => {
    const imageSrc = webcamRef.current.getScreenshot({
      width: 1280,
      height: 720
    });
    setCapturedImage(imageSrc);
    setMessage("Image captured. Click 'Verify & Mark Attendance' to proceed.");
  };

  const retakeImage = () => {
    setCapturedImage(null);
    setMessage("");
  };

  const verifyAndMarkAttendance = async () => {
    if (!userId) {
      console.error("[AttendancePanel] No user ID available");
      setMessage("❌ User not identified. Please sign in again.");
      return;
    }

    if (!sessionId) {
      console.error("[AttendancePanel] No session ID available");
      setMessage("❌ Invalid session ID");
      return;
    }

    if (!sessionActive) {
      console.error("[AttendancePanel] Session not active");
      setMessage("❌ Attendance session is not active");
      return;
    }

    if (hasMarkedAttendance) {
      console.log("[AttendancePanel] Attendance already marked");
      setMessage("✅ Attendance already marked for this session");
      return;
    }

    if (!capturedImage) {
      console.error("[AttendancePanel] No image captured");
      setMessage("❌ Please capture an image first");
      return;
    }

    setLoading(true);
    setMessage("Processing face verification...");    
    
    try {
      // Double-check session status
      console.log("[AttendancePanel] Checking session status:", sessionId);
      const sessionResponse = await fetch(
        `${BACKEND_URL}/get-session-status?sessionId=${sessionId}`
      );
      const sessionData = await sessionResponse.json();
      console.log("[AttendancePanel] Session status response:", sessionData);
      
      if (!sessionResponse.ok || sessionData.status !== 'active') {
        throw new Error('Attendance session is no longer active');
      }

      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("sessionId", sessionId);
      formData.append("file", blob, "verify.jpg");

      // Send for verification
      console.log("[AttendancePanel] Sending verification request");
      const verifyResponse = await fetch(`${BACKEND_URL}/verify-face`, {
        method: "POST",
        body: formData,
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        console.error("[AttendancePanel] Verification failed:", errorData);
        throw new Error(errorData.detail || "Face verification failed");
      }

      const data = await verifyResponse.json();
      console.log("[AttendancePanel] Verification successful:", data);
      setMessage("✅ Attendance marked successfully!");
      setHasMarkedAttendance(true);
      
      // Clear captured image after successful verification
      setCapturedImage(null);
    } catch (err) {
      console.error("[AttendancePanel] Attendance error:", err);
      setMessage(`❌ ${err.message || "Failed to mark attendance"}`);
      // Only clear the captured image if it was a verification failure
      if (err.message?.includes("verification failed")) {
        setCapturedImage(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const stopAttendance = async () => {
    try {
        setLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/end-attendance-session`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sessionId: activeSessionId,
            }),
        });

        const data = await response.json();
        if (data.status === "success") {
            setMessage("✅ " + data.message);
            setSessionActive(false);
            setActiveSessionId(null);
            // Update UI state
            if (onSessionEnd) {
                onSessionEnd({
                    downloadUrl: data.downloadUrl,
                    recordCount: data.recordCount,
                    sessionEndTime: data.sessionEndTime
                });
            }
        } else {
            setMessage("❌ Failed to end attendance session");
            console.error("Error:", data.detail);
        }
    } catch (error) {
        setMessage("❌ Error ending attendance session");
        console.error("Error:", error);
    } finally {
        setLoading(false);
    }
};

  const renderMessage = () => {
    if (!message) return null;
    
    const getMessageStyle = () => {
      if (message.includes("✅")) return "text-green-400";
      if (message.includes("❌")) return "text-red-400";
      return "text-gray-300";
    };

    return (
      <p className={`text-sm ${getMessageStyle()}`}>
        {message}
      </p>
    );
  };
  const renderContent = () => {
    if (loading && !hasReferenceImage && !sessionActive) {
      return (
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold mb-3 text-white">Attendance Panel</h3>
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            <p className="text-blue-400">Checking status...</p>
          </div>
        </div>
      );
    }
    
    if (!hasReferenceImage) {
      return (
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold mb-3 text-white">Attendance Panel</h3>
          <div className="bg-yellow-500/10 text-yellow-400 p-4 rounded-lg mb-3">
            ⚠️ Reference face image not found
          </div>
          <p className="text-sm text-gray-400">
            Please upload your reference face image in your profile settings before marking attendance.
          </p>
        </div>
      );
    }

    if (!sessionActive) {
      return (
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold mb-3 text-white">Attendance Panel</h3>
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg">
            ❌ Attendance session is not active
          </div>
        </div>
      );
    }

    if (hasMarkedAttendance) {
      return (
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold mb-3 text-white">Attendance Panel</h3>
          <div className="bg-green-500/10 text-green-400 p-4 rounded-lg">
            ✅ Attendance marked for this session
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3 text-white">Attendance Panel</h3>
        <div className="space-y-3">
          {!capturedImage ? (
            <>
              <Webcam 
                audio={false} 
                ref={webcamRef} 
                screenshotFormat="image/jpeg"
                width={280}
                height={210}
                className="rounded-lg border border-gray-700 bg-black"
                mirrored={true}
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user"
                }}
              />
              <button
                onClick={captureImage}
                disabled={loading}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  loading 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? "Processing..." : "Capture Image"}
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="rounded-lg border border-gray-700"
                  width={280}
                  height={210}
                />
                <button
                  onClick={() => {
                    setCapturedImage(null);
                    setMessage("");
                  }}
                  className="absolute top-2 right-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full p-2"
                  title="Retake photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <button
                onClick={verifyAndMarkAttendance}
                disabled={loading}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  loading 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {loading ? "Verifying..." : "Verify & Mark Attendance"}
              </button>
            </>
          )}
          {renderMessage()}
          {loading && (
            <div className="flex items-center justify-center space-x-2 text-blue-400">
              <div className="w-2 h-2 rounded-full animate-pulse bg-current"></div>
              <div className="w-2 h-2 rounded-full animate-pulse bg-current" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-2 h-2 rounded-full animate-pulse bg-current" style={{ animationDelay: "0.4s" }}></div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return renderContent();
}
