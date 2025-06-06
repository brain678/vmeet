"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Users, Clock, Info } from 'lucide-react';

const PhysicalAttendancePage = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [studentCode, setStudentCode] = useState('');
  const [position, setPosition] = useState<{latitude: number, longitude: number} | null>(null);
  const [activeStudents, setActiveStudents] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-user-role?userId=${user.id}`);
        const data = await response.json();
        setUserRole(data.role);
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };

    if (user?.id) {
      checkUserRole();
    }
  }, [user?.id]);

  // Add periodic stats update
  useEffect(() => {
    if (!sessionId) return;

    const updateSessionStats = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/session-stats?sessionId=${sessionId}`);
        const data = await response.json();
        setActiveStudents(data.activeStudents || 0);
      } catch (error) {
        console.error('Error fetching session stats:', error);
      }
    };

    // Update stats every 10 seconds
    const interval = setInterval(updateSessionStats, 10000);
    updateSessionStats(); // Initial update
    return () => clearInterval(interval);
  }, [sessionId]);

  // Update session duration
  useEffect(() => {
    if (!sessionId || !sessionStartTime) return;

    const interval = setInterval(() => {
      setSessionStartTime(prev => prev); // Force re-render to update duration
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [sessionId, sessionStartTime]);

  // Enhanced start attendance function
  const startAttendance = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const position = await getCurrentPosition();
      if (!position) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/start-geofence-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostId: user.id,
          latitude: position.latitude,
          longitude: position.longitude,
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setSessionId(data.sessionId);
        setSessionCode(data.sessionCode);
        setSessionStartTime(new Date());
        setSuccess('Attendance session started successfully!');
        
        toast({
          title: "Session Started",
          description: "Students can now mark their attendance using the code",
          action: (
            <ToastAction altText="View Session">View Session</ToastAction>
          ),
        });
      }
    } catch (error) {
      setError('Failed to start attendance session');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const endAttendance = async () => {
    if (!sessionId || !user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/end-attendance-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          userId: user.id,
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setSessionId(null);
        setSessionCode(null);
        setSuccess('Attendance session ended successfully!');
        
        // Show toast with download link
        toast({
          title: "Attendance Session Ended",
          description: `${data.recordCount} attendance records saved successfully.`,
          action: data.downloadUrl ? (
            <ToastAction 
              altText="Download attendance report" 
              onClick={async () => {
                try {
                  // Extract session ID from the download URL or use current session ID
                  const sessionIdForDownload = data.downloadUrl.split('/').pop()?.split('?')[0] || sessionId;
                  
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/download-attendance?sessionId=${sessionIdForDownload}&userId=${user.id}&t=${Date.now()}`,
                    {
                      method: 'GET',
                      headers: {
                        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      },
                      cache: 'no-store'
                    }
                  );
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Download failed: ${response.statusText}`);
                  }
                  
                  // Verify content type
                  const contentType = response.headers.get('content-type');
                  if (!contentType?.includes('spreadsheetml') && !contentType?.includes('excel')) {
                    throw new Error('Invalid file format received');
                  }
                  
                  const blob = await response.blob();
                  if (blob.size === 0) throw new Error('Received empty file');
                  
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.style.display = 'none';
                  a.href = url;
                  a.download = `attendance_${sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);

                  toast({
                    title: "Success",
                    description: "Attendance report downloaded successfully",
                    variant: "default"
                  });
                } catch (error) {
                  console.error('Download error:', error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to download attendance report",
                    variant: "destructive"
                  });
                }
              }}
            >
              Download Report
            </ToastAction>
          ) : undefined
        });
      }
    } catch (error) {
      setError('Failed to end attendance session');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async () => {
    if (!user?.id || !studentCode || studentCode.length !== 4) {
      setError('Please enter a valid 4-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current location
      const position = await getCurrentPosition();
      if (!position) return;

      // Get student details from database
      const studentResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-student-details?userId=${user.id}`);
      const studentData = await studentResponse.json();
      
      if (!studentResponse.ok) {
        throw new Error(studentData.detail?.message || 'Failed to get student details');
      }

      if (!studentData.data.matricNumber || !studentData.data.department || !studentData.data.level) {
        throw new Error('Please complete your student profile with matric number, department, and level');
      }

      // Find active session by code
      const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-active-session?code=${studentCode}`);
      const sessionData = await sessionResponse.json();
      
      if (!sessionResponse.ok) {
        throw new Error(sessionData.message || sessionData.detail || 'Failed to find active session');
      }

      // Mark attendance with the found session
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/mark-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          userId: user.id,
          code: studentCode,
          latitude: position.latitude,
          longitude: position.longitude,
          studentName: studentData.data.name,
          matric: studentData.data.matricNumber,
          department: studentData.data.department,
          level: studentData.data.level
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail?.message || data.detail || 'Failed to mark attendance');
      }

      setSuccess(data.message || 'Attendance marked successfully!');
      if (data.data?.distance) {
        setSuccess(prev => `${prev} You are ${data.data.distance}m from the lecture location.`);
      }
      setStudentCode('');
      
      // Disable the input field and button after successful attendance
      const inputElement = document.getElementById('code') as HTMLInputElement;
      if (inputElement) {
        inputElement.disabled = true;
      }
      setLoading(true); // Keep the button disabled
    } catch (error: any) {
      console.error('Attendance Error:', error);
      setError(error.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPosition = (): Promise<{latitude: number, longitude: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('Current position:', coords);
          setPosition(coords);
          resolve(coords);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Failed to get your location. Please enable location services.');
          reject(error);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!sessionId || userRole !== 'student') return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-session-status?sessionId=${sessionId}`);
        const data = await response.json();
        
        if (!response.ok || data.status !== 'active') {
          setSuccess('Attendance session has ended. Your attendance was recorded.');
          setLoading(true); // Keep UI disabled
          const inputElement = document.getElementById('code') as HTMLInputElement;
          if (inputElement) {
            inputElement.disabled = true;
          }
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    };

    // Check session status every 30 seconds
    const intervalId = setInterval(checkSession, 30000);
    return () => clearInterval(intervalId);
  }, [sessionId, userRole]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F1828] to-[#1F2937] p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {userRole === 'lecturer' ? 'Attendance Management' : 'Mark Your Attendance'}
          </h1>
          <p className="text-gray-400">
            {userRole === 'lecturer' 
              ? 'Create and manage attendance sessions for your classes' 
              : 'Record your presence in the ongoing class session'}
          </p>
        </div>

        {/* Alert Messages */}
        {error && (
          <Alert variant="destructive" className="animate-shake">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-500/20 text-emerald-500 border-emerald-500/50 animate-fadeIn">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Card className="glassmorphism">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-white">
                  {userRole === 'lecturer' ? 'Session Control' : 'Attendance Form'}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {userRole === 'lecturer' 
                    ? 'Manage your current attendance session' 
                    : 'Enter the session code to mark your attendance'}
                </CardDescription>
              </div>
              <Badge 
                variant={userRole === 'lecturer' ? 'default' : 'secondary'}
                className="uppercase animate-fadeIn"
              >
                {userRole || 'Loading...'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {userRole === 'lecturer' ? (
              <div className="space-y-6">
                {!sessionId ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-white/5 p-6 border border-white/10">
                      <h3 className="text-lg font-medium text-white mb-2">Start New Session</h3>
                      <p className="text-gray-400 mb-4">
                        Create a new attendance session using your current location.
                        Students within the specified radius will be able to mark their attendance.
                      </p>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={startAttendance}
                              disabled={loading}
                              className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
                            >
                              {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <MapPin className="mr-2 h-4 w-4" />
                              )}
                              Start Taking Attendance
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Uses your current location as the center point</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Session Code</span>
                          <HelpCircle className="h-4 w-4" />
                        </div>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-white tracking-wider">
                            {sessionCode}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Students Present</span>
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-white">
                            {activeStudents}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Duration</span>
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-white">
                            {sessionStartTime 
                              ? Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 60000)
                              : 0}m
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={endAttendance}
                        disabled={loading}
                        variant="destructive"
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        End Session & Download Report
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : userRole === 'student' ? (
              <div className="space-y-6">
                <div className="rounded-lg bg-white/5 p-6 border border-white/10">
                  <Label htmlFor="code" className="text-gray-300 block mb-2">
                    Session Code
                  </Label>
                  <div className="relative">
                    <Input
                      id="code"
                      type="text"
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                      placeholder="Enter 4-digit code"
                      maxLength={4}
                      className="text-center text-2xl tracking-[0.5em] bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                      disabled={loading || success !== null}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-2 flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Enter the code displayed by your lecturer
                  </p>

                  <Button
                    onClick={markAttendance}
                    disabled={loading || !studentCode || studentCode.length !== 4 || success !== null}
                    className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    Mark My Attendance
                  </Button>
                </div>

                {position && (
                  <Alert className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                    <MapPin className="h-4 w-4" />
                    <AlertTitle>Location Active</AlertTitle>
                    <AlertDescription>
                      Your location is being used to verify your presence
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Controls */}
        {userRole === 'admin' && (
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle className="text-white">Admin Controls</CardTitle>
              <CardDescription className="text-gray-400">
                Manage attendance sessions and view reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                asChild 
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              >
                <Link href="/admin/sessions">View All Sessions</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PhysicalAttendancePage;
