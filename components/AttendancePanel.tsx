'use client';

import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { useUser } from "@clerk/nextjs";
import { Camera, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import Loader from './Loader';

interface AttendancePanelProps {
  sessionId: string;
  isActive: boolean;
}

const AttendancePanel = ({ sessionId, isActive }: AttendancePanelProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [hasMarkedAttendance, setHasMarkedAttendance] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasReferenceImage, setHasReferenceImage] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const { user } = useUser();
  const userId = user?.id;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    let mounted = true;
    let webcamCleanup: (() => void) | undefined;

    const checkStatus = async () => {
      if (!userId || !sessionId || !isActive) return;

      try {
        const response = await fetch(
          `${backendUrl}/get-session-status?sessionId=${sessionId}`
        );
        const data = await response.json();
        
        if (!mounted) return;

        if (!response.ok) {
          throw new Error(data.detail || 'Failed to check session status');
        }

        if (!data.isActive) {
          // Session is no longer active
          if (webcamRef.current) {
            const stream = webcamRef.current.video?.srcObject as MediaStream;
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
          }
          setWebcamReady(false);
          setHasMarkedAttendance(false);
          setCapturedImage(null);
          setStatus('idle');
          return;
        }

        setStatus('ready');

        // Check attendance status only if session is active
        const attendanceResponse = await fetch(
          `${backendUrl}/check-attendance-status?userId=${userId}&sessionId=${sessionId}`
        );
        const attendanceData = await attendanceResponse.json();

        if (!mounted) return;

        if (attendanceResponse.ok) {
          setHasMarkedAttendance(attendanceData.hasMarkedAttendance || false);
          setHasReferenceImage(attendanceData.hasReferenceImage || false);
          
          if (attendanceData.hasMarkedAttendance) {
            // Stop webcam if attendance is already marked
            if (webcamRef.current) {
              const stream = webcamRef.current.video?.srcObject as MediaStream;
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
            }
            setWebcamReady(false);
          }
        }
      } catch (error) {
        console.error('[AttendancePanel] Session check error:', error);
        if (!mounted) return;
        
        setStatus('error');
        toast({
          title: "Error",
          description: "Failed to check session status. Please refresh the page.",
          variant: "destructive"
        });
      }
    };

    // Initialize webcam if needed
    if (isActive && !hasMarkedAttendance) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          setWebcamReady(true);
          setWebcamError(null);
          webcamCleanup = () => {
            stream.getTracks().forEach(track => track.stop());
          };
        })
        .catch(err => {
          if (!mounted) return;
          setWebcamError(err.message || 'Failed to initialize camera');
          setWebcamReady(false);
        });
    }

    // Initial check and start polling
    void checkStatus();
    const intervalId = setInterval(() => void checkStatus(), 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (webcamCleanup) {
        webcamCleanup();
      }
    };
  }, [userId, sessionId, isActive, backendUrl, hasMarkedAttendance]);

  const markAttendance = async () => {
    if (!userId || !sessionId || !capturedImage) {
      toast({
        title: "Error",
        description: "Missing required data. Please try again.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Verify session is still active
      const sessionResponse = await fetch(
        `${backendUrl}/get-session-status?sessionId=${sessionId}`
      );
      const sessionData = await sessionResponse.json();
      
      if (!sessionResponse.ok || !sessionData.isActive) {
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
      const verifyResponse = await fetch(`${backendUrl}/verify-face`, {
        method: "POST",
        body: formData,
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.detail || "Face verification failed");
      }

      setHasMarkedAttendance(true);
      toast({
        title: "Success",
        description: "Attendance marked successfully!",
        variant: "default"
      });

      // Cleanup captured image
      setCapturedImage(null);
    } catch (error) {
      const err = error as Error;
      console.error('[AttendancePanel] Mark attendance error:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to mark attendance",
        variant: "destructive"
      });
      if (err.message?.includes("verification failed")) {
        setCapturedImage(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-[320px]">
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader />
        </div>
      ) : status === 'error' ? (
        <p className="text-red-500">Failed to check attendance status. Please refresh.</p>
      ) : !isActive ? (
        <p className="text-gray-700">Waiting for host to start attendance...</p>
      ) : hasMarkedAttendance ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="text-green-500 w-8 h-8" />
          <p className="font-bold text-green-500">Attendance marked successfully!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {webcamError ? (
            <div>
              <p className="font-bold text-red-500 mb-2">Camera Error</p>
              <p className="text-gray-700">{webcamError}</p>
              <p className="mt-2 text-sm text-gray-500">
                Please ensure your camera is connected and you have granted permission to use it.
              </p>
            </div>
          ) : !webcamReady ? (
            <p className="text-gray-700">Initializing camera...</p>
          ) : (
            <div className="space-y-4">
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                width={1280}
                height={720}
                className="w-full rounded-lg border border-gray-200"
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user"
                }}
              />
              {!capturedImage ? (
                <Button 
                  onClick={() => {
                    const imageSrc = webcamRef.current?.getScreenshot();
                    setCapturedImage(imageSrc || null);
                  }}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Image
                </Button>
              ) : (
                <div className="space-y-4">
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    className="w-full rounded-lg border border-gray-200" 
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => setCapturedImage(null)}
                      variant="outline"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                    <Button
                      onClick={markAttendance}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Verify
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePanel;
