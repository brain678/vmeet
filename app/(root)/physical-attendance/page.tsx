"use client";

import { useEffect, useState, type ChangeEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AlertCircle, Calendar, Clock, Info, Loader2, MapPin, Play, Trash2, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import dynamic from 'next/dynamic';
// Dynamically import FaceVerificationPanel to avoid SSR issues with webcam
const FaceVerificationPanel = dynamic(() => import('../../../components/FaceVerificationPanel'), { ssr: false });

const PhysicalAttendancePage = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [position, setPosition] = useState<{latitude: number, longitude: number} | null>(null);
  const [activeStudents, setActiveStudents] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  // Time limit state
  const [showTimeLimitDialog, setShowTimeLimitDialog] = useState(false);
  const [timeLimit, setTimeLimit] = useState<string>(''); // in minutes, as string for input
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [sessionTimer, setSessionTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  // Face verification state
  const [faceVerified, setFaceVerified] = useState(false);
  // Course selection state
  const [lecturerCourses, setLecturerCourses] = useState<Array<{code: string; title: string}>>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [activeCourseCode, setActiveCourseCode] = useState('');
  const [showStartAttendanceDialog, setShowStartAttendanceDialog] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [existingSession, setExistingSession] = useState<{sessionId: string; courseCode: string; startTime: string} | null>(null);
  const [showExistingSessionDialog, setShowExistingSessionDialog] = useState(false);
  // Student course state
  const [studentCourses, setStudentCourses] = useState<Array<{code: string; title: string; hasActiveSession: boolean; sessionId?: string; hostId?: string}>>([]);
  const [selectedStudentCourse, setSelectedStudentCourse] = useState('');
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  // Real-time attendance tracking
  const [showAttendanceViewer, setShowAttendanceViewer] = useState(false);
  const [realtimeAttendance, setRealtimeAttendance] = useState<Array<{studentId: string; studentName: string; timestamp: string; distance?: number}>>([]);
  
  // Scheduler state
  const [activeTab, setActiveTab] = useState<'immediate' | 'scheduled'>('immediate');
  const [schedules, setSchedules] = useState({
    upcoming: [],
    started: [],
    completed: [],
    cancelled: [],
  });
  const [showCreateScheduleDialog, setShowCreateScheduleDialog] = useState(false);
  const [scheduleFormData, setScheduleFormData] = useState({
    courseCode: '',
    scheduledDate: '',
    scheduledTime: '',
    timeLimit: '',
    description: '',
  });
  const [showDeleteScheduleConfirm, setShowDeleteScheduleConfirm] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-user-role?userId=${user.id}`);
        const data = await response.json();
        setUserRole(data.role);
        
        // Fetch courses if user is a lecturer
        if (data.role === 'lecturer') {
          setLoadingCourses(true);
          try {
            const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-lecturer-courses?userId=${user.id}`);
            const coursesData = await coursesResponse.json();
            console.log('Courses fetched:', coursesData);
            if (coursesResponse.ok && coursesData.courses) {
              console.log('Setting lecturer courses:', coursesData.courses);
              setLecturerCourses(coursesData.courses);
            } else {
              console.warn('Courses response not ok or no courses in response:', coursesData);
              setLecturerCourses([]);
            }

            // Check for existing active session
            try {
              const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-lecturer-active-session?userId=${user.id}`);
              const sessionData = await sessionResponse.json();
              if (sessionResponse.ok && sessionData.session) {
                console.log('Existing session found:', sessionData.session);
                setExistingSession(sessionData.session);
                setShowExistingSessionDialog(true);
              }
            } catch (error) {
              console.error('Error checking for existing session:', error);
            }
          } catch (error) {
            console.error('Error fetching lecturer courses:', error);
            setLecturerCourses([]);
          } finally {
            setLoadingCourses(false);
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };

    if (user?.id) {
      checkUserRole();
    }
  }, [user?.id]);

  // Fetch student courses (for all students to see available sessions)
  useEffect(() => {
    if (!user?.id) return;
    if (userRole !== 'student') return; // Only fetch for students
    if (attendanceMarked || selectedStudentCourse) {
      setLoadingStudentCourses(false);
      return;
    }

    let isMounted = true;

    const fetchStudentCourses = async () => {
      if (!isMounted || attendanceMarked || selectedStudentCourse) return;
      setLoadingStudentCourses(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-student-courses?userId=${user.id}`);
        const data = await response.json();
        console.log('Student courses fetched:', data);
        if (!isMounted) return;
        if (response.ok && data.courses) {
          console.log('Setting student courses:', data.courses);
          setStudentCourses(data.courses);
        } else {
          console.warn('Failed to fetch student courses:', data);
          setStudentCourses([]);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching student courses:', error);
        setStudentCourses([]);
      } finally {
        if (isMounted && !attendanceMarked && !selectedStudentCourse) {
          setLoadingStudentCourses(false);
        }
      }
    };

    // Fetch immediately on page load only when the user hasn't already chosen a course
    fetchStudentCourses();

    // Refresh student courses every 10 seconds only while the student has not already selected a course
    const interval = setInterval(() => {
      if (!attendanceMarked && !selectedStudentCourse) {
        fetchStudentCourses();
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userRole, user?.id, attendanceMarked, selectedStudentCourse]);

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

  // Add timer effect to check remaining time
  useEffect(() => {
    if (!sessionId || !timeLimit) return;

    const checkTimeLimit = () => {
      const startTime = sessionStartTime ? new Date(sessionStartTime) : new Date();
      const endTime = new Date(startTime.getTime() + parseInt(timeLimit) * 60 * 1000);
      const now = new Date();
      const remaining = endTime.getTime() - now.getTime();

      if (remaining <= 0) {
        // Time's up - end the session
        setRemainingTime(0);
        endAttendance();
        return;
      }

      setRemainingTime(Math.floor(remaining / 1000)); // Convert to seconds
    };

    // Check immediately
    checkTimeLimit();

    // Then check every second
    const interval = setInterval(checkTimeLimit, 1000);

    return () => clearInterval(interval);
  }, [sessionId, timeLimit, sessionStartTime]);

  // Fetch real-time attendance data
  useEffect(() => {
    if (!sessionId || userRole !== 'lecturer' || !showAttendanceViewer) return;

    const fetchRealtimeAttendance = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-session-attendance?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setRealtimeAttendance(data.attendance || []);
        }
      } catch (error) {
        console.error('Error fetching real-time attendance:', error);
      }
    };

    // Fetch immediately and then every 2 seconds
    fetchRealtimeAttendance();
    const interval = setInterval(fetchRealtimeAttendance, 2000);

    return () => clearInterval(interval);
  }, [sessionId, userRole, showAttendanceViewer]);

  // Update startAttendance to show combined dialog
  const startAttendance = async () => {
    if (!user?.id) return;
    setError(null);
    setSuccess(null);
    setSelectedCourse('');
    setTimeLimit('');
    setShowStartAttendanceDialog(true);
  };

  // Handle resuming an existing session
  const resumeExistingSession = () => {
    if (existingSession) {
      setSessionId(existingSession.sessionId);
      setActiveCourseCode(existingSession.courseCode);
      setSessionStartTime(new Date(existingSession.startTime));
      setShowExistingSessionDialog(false);
      setSuccess('Existing session resumed. Students can continue marking attendance.');
    }
  };

  // Handle ending existing session without starting new one
  const endExistingSession = async () => {
    if (!existingSession || !user?.id) return;
    setLoading(true);

    try {
      console.log('Ending existing session:', { sessionId: existingSession.sessionId, userId: user.id });
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/end-attendance-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: existingSession.sessionId,
          userId: user.id,
        }),
      });

      console.log('End existing session response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to end session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('End existing session response data:', data);
      
      if (data.status === 'success') {
        setExistingSession(null);
        setShowExistingSessionDialog(false);
        setSuccess('Existing attendance session ended successfully!');

        // Show toast with download link
        toast({
          title: "Attendance Session Ended",
          description: `${data.recordCount} attendance records saved successfully.`,
          action: (
            <ToastAction 
              altText="Download attendance report" 
              onClick={async () => {
                try {
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/download-attendance?sessionId=${existingSession.sessionId}&userId=${user.id}`,
                    {
                      method: 'GET',
                      headers: {
                        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      },
                    }
                  );

                  if (!response.ok) {
                    throw new Error('Failed to download report');
                  }

                  const blob = await response.blob();
                  if (blob.size === 0) {
                    throw new Error('Received empty file');
                  }

                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.style.display = 'none';
                  a.href = url;
                  a.download = `attendance_${existingSession.sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`;
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
          )
        });

        // Redirect to home after 2 seconds
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      } else {
        throw new Error('Unexpected response: ' + JSON.stringify(data));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error ending existing session:', errorMessage);
      setError(`Failed to end existing attendance session: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Final step to actually start the session with course
  const confirmStartAttendance = async () => {
    if (!selectedCourse) {
      toast({
        title: "Error",
        description: "Please select a course",
        variant: "destructive"
      });
      return;
    }
    
    setShowStartAttendanceDialog(false);
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
          hostId: user?.id,
          latitude: position.latitude,
          longitude: position.longitude,
          timeLimit: timeLimit && !isNaN(Number(timeLimit)) ? Number(timeLimit) : undefined,
          courseCode: selectedCourse
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start attendance session');
      }

      const data = await response.json();
      if (data.status === 'success') {
        setSessionId(data.sessionId);
        setActiveCourseCode(selectedCourse);
        setSessionStartTime(new Date());
        setSuccess('Attendance session started successfully!');
        toast({
          title: "Session Started",
          description: `Students offering ${selectedCourse} can now mark their attendance`,
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

    try {
      console.log('Ending attendance session:', { sessionId, userId: user.id });
      
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

      console.log('End attendance response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to end session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('End attendance response data:', data);
      
      if (data.status === 'success') {
        setSessionId(null);
        setActiveCourseCode('');
        setSuccess('Attendance session ended successfully!');
        setShowStartAttendanceDialog(false);
        setTimeLimit('');
        setSelectedCourse('');

        // Show toast with download link
        toast({
          title: "Attendance Session Ended",
          description: `${data.recordCount} attendance records saved successfully.`,
          action: (
            <ToastAction 
              altText="Download attendance report" 
              onClick={async () => {
                try {
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/download-attendance?sessionId=${sessionId}&userId=${user.id}`,
                    {
                      method: 'GET',
                      headers: {
                        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      },
                    }
                  );

                  if (!response.ok) {
                    throw new Error('Failed to download report');
                  }

                  const contentType = response.headers.get('content-type');
                  if (!contentType?.includes('spreadsheetml') && !contentType?.includes('excel')) {
                    throw new Error('Invalid file format received');
                  }

                  const blob = await response.blob();
                  if (blob.size === 0) {
                    throw new Error('Received empty file');
                  }

                  // Create and trigger download
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
          )
        });

        // Redirect to home after 2 seconds
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      } else {
        throw new Error('Unexpected response: ' + JSON.stringify(data));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error ending session:', errorMessage);
      setError(`Failed to end attendance session: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async () => {
    if (!user?.id || !selectedStudentCourse) {
      setError('Please select a course');
      return;
    }

    // Check if the selected course has an active session
    const selectedCourse = studentCourses.find(c => c.code === selectedStudentCourse);
    if (!selectedCourse || !selectedCourse.hasActiveSession) {
      setError('No active attendance session for this course');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current location
      const position = await getCurrentPosition();
      if (!position) return;

      // Mark attendance by course
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/mark-attendance-by-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          courseCode: selectedStudentCourse,
          latitude: position.latitude,
          longitude: position.longitude
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to mark attendance');
      }

      setSuccess(data.message || 'Attendance marked successfully!');
      if (data.data?.distance) {
        setSuccess(prev => `${prev} You are ${data.data.distance}m from the lecture location.`);
      }
      setAttendanceMarked(true);
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

  // Real-time session status polling (every 1 second)
  useEffect(() => {
    if (!sessionId) return;
    const endedRef = { current: false };
    const checkSession = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-session-status?sessionId=${sessionId}`);
        const data = await response.json();
        if (!response.ok || data.status !== 'active') {
          if (userRole === 'student') {
            setSuccess('Attendance session has ended. Your attendance was recorded.');
            setLoading(true);
            const inputElement = document.getElementById('code') as HTMLInputElement;
            if (inputElement) inputElement.disabled = true;
          } else if (userRole === 'lecturer' && !endedRef.current) {
            endedRef.current = true;
            setLoading(true);
            // Show different message if session ended due to time limit
            const endedDueToTimeLimit = data.endedDueToTimeLimit === true;
            setSessionId(null);
            setActiveCourseCode('');
            setSuccess(endedDueToTimeLimit
              ? 'Attendance session ended automatically due to time limit.'
              : 'Attendance session ended.');
            setShowStartAttendanceDialog(false);
            setTimeLimit('');
            if (sessionTimer) {
              clearTimeout(sessionTimer);
              setSessionTimer(null);
            }
            toast({
              title: 'Session Ended',
              description: endedDueToTimeLimit
                ? 'Session ended automatically due to time limit.'
                : 'Session ended.',
              // Optionally, you can add download link if available in data.downloadUrl
            });
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    };
    const intervalId = setInterval(checkSession, 1000); // Real-time: every 1 second
    checkSession(); // Initial check
    return () => clearInterval(intervalId);
  }, [sessionId, userRole, sessionTimer, toast, user?.id]);

  // Fetch scheduled sessions for lecturer
  const fetchScheduledSessions = async () => {
    if (!user?.id || userRole !== 'lecturer') return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/lecturer-schedules?lecturerId=${user.id}`
      );
      const data = await response.json();
      if (data.status === 'success') {
        setSchedules(data.schedules);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  // Fetch schedules on mount and when user changes
  useEffect(() => {
    if (userRole === 'lecturer') {
      fetchScheduledSessions();
      const interval = setInterval(fetchScheduledSessions, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user?.id, userRole]);

  // Handle create schedule
  const handleCreateSchedule = async () => {
    if (!user?.id || !scheduleFormData.courseCode || !scheduleFormData.scheduledDate || !scheduleFormData.scheduledTime) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Get lecturer's current location
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<{ coords: { latitude: number; longitude: number } }>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true,
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.warn('Could not get geolocation:', geoError);
          // Continue without location - backend will use defaults
        }
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/schedule-attendance`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lecturerId: user.id,
            courseCode: scheduleFormData.courseCode,
            scheduledDate: scheduleFormData.scheduledDate,
            scheduledTime: scheduleFormData.scheduledTime,
            timeLimit: scheduleFormData.timeLimit ? Number(scheduleFormData.timeLimit) : null,
            description: scheduleFormData.description,
            ...(latitude !== null && longitude !== null && { latitude, longitude }),
          }),
        }
      );

      const data = await response.json();
      if (data.status === 'success') {
        setSuccess('Attendance session scheduled successfully!');
        setShowCreateScheduleDialog(false);
        setScheduleFormData({
          courseCode: '',
          scheduledDate: '',
          scheduledTime: '',
          timeLimit: '',
          description: '',
        });
        await fetchScheduledSessions();
      } else {
        setError(data.detail || 'Failed to schedule attendance');
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      setError('Failed to schedule attendance session');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete schedule
  const handleDeleteSchedule = async () => {
    if (!selectedSchedule || !user?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/cancel-schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId: selectedSchedule.scheduleId,
            lecturerId: user.id,
          }),
        }
      );

      const data = await response.json();
      if (data.status === 'success') {
        setSuccess('Schedule cancelled successfully!');
        setShowDeleteScheduleConfirm(false);
        setSelectedSchedule(null);
        await fetchScheduledSessions();
      } else {
        setError(data.detail || 'Failed to cancel schedule');
      }
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      setError('Failed to cancel schedule');
    } finally {
      setLoading(false);
    }
  };

  // Handle start scheduled session
  const handleStartScheduledSession = async (schedule: any) => {
    if (!user?.id) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLoading(true);
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/start-scheduled-session`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scheduleId: schedule.scheduleId,
                lecturerId: user.id,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            }
          );

          const data = await response.json();
          if (data.status === 'success') {
            setSuccess('Attendance session started!');
            setSessionId(data.sessionId);
            setActiveCourseCode(data.courseCode);
            setSessionStartTime(new Date());
            setTimeLimit(schedule.timeLimit ? String(schedule.timeLimit) : '');
            setActiveTab('immediate');
            await fetchScheduledSessions();
          } else {
            setError(data.detail || 'Failed to start session');
          }
        } catch (error) {
          console.error('Error starting session:', error);
          setError('Failed to start attendance session');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setError('Failed to get your location. Please enable location services.');
        console.error('Geolocation error:', error);
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#F5EFFB] px-3 pb-8 pt-20 font-[Trebuchet_MS,sans-serif] text-[#18121F] sm:px-8 sm:pb-10 sm:pt-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1180px] space-y-5 sm:space-y-6">
        {/* Header Section */}
        <div className="mb-6 text-left sm:mb-8">
          <h1 className="mb-2 text-2xl font-bold leading-tight text-[#2D1A3A] sm:text-4xl">
            {userRole === 'lecturer' ? 'Attendance Management' : 'Mark Your Attendance'}
          </h1>
          <p className="max-w-2xl text-sm leading-5 text-[#6B6172] sm:text-base">
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
          <Alert className="animate-fadeIn border-[#92D0AA] bg-[#E5F5EA] text-[#087A3E]">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Reminder for Lecturer with Ongoing Session */}
        {userRole === 'lecturer' && existingSession && !sessionId && (
          <Alert className="animate-pulse border-[#E7C96E] bg-[#FFF7D9] text-[#7A5A00]">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>⚠️ Ongoing Session Reminder</AlertTitle>
            <AlertDescription>
              You have an active attendance session for {existingSession.courseCode} that is still running. 
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2 h-8 rounded-md border-[#D3A900] bg-white px-3 text-xs font-semibold text-[#7A5A00] hover:bg-[#FCEEB3]"
                onClick={() => setShowExistingSessionDialog(true)}
              >
                View Session
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Card className="border-0 bg-white shadow-[0_8px_24px_rgba(71,38,96,0.12)]">
          <CardHeader className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-[#2D1A3A]">
                  {userRole === 'lecturer' ? 'Session Management' : 'Attendance Form'}
                </CardTitle>
                {userRole === 'lecturer' && (
                  <CardDescription className="text-[#6B6172]">
                    Create or manage attendance sessions
                  </CardDescription>
                )}
              </div>
              <Badge
                variant={userRole === 'lecturer' ? 'default' : 'secondary'}
                className="uppercase animate-fadeIn sm:self-center"
              >
                {userRole || 'Loading...'}
              </Badge>
            </div>
            
            {/* Lecturer Tabs */}
            {userRole === 'lecturer' && (
              <div className="mt-5 grid grid-cols-2 gap-1 border-b border-[#E7DDF0] sm:flex sm:gap-4">
                <button
                  onClick={() => setActiveTab('immediate')}
                  className={`min-h-11 px-2 pb-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                    activeTab === 'immediate'
                      ? 'border-b-2 border-[#8437C8] text-[#8437C8]'
                      : 'text-[#8A7D91] hover:text-[#2D1A3A]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Start Now
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('scheduled')}
                  className={`min-h-11 px-2 pb-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                    activeTab === 'scheduled'
                      ? 'border-b-2 border-[#8437C8] text-[#8437C8]'
                      : 'text-[#8A7D91] hover:text-[#2D1A3A]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Scheduled Sessions
                  </span>
                </button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {userRole === 'lecturer' ? (
              <>
                {/* Immediate Sessions Tab */}
                {activeTab === 'immediate' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Existing Session Dialog */}
                <Dialog open={showExistingSessionDialog} onOpenChange={setShowExistingSessionDialog}>
                  <DialogContent className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-2 border-yellow-500/30 max-w-md">
                    <DialogHeader className="space-y-3">
                      <DialogTitle className="text-2xl font-bold text-yellow-400">
                        ⚠️ Existing Session Found
                      </DialogTitle>
                      <DialogDescription className="text-gray-200 text-base">
                        You have an active attendance session that hasn&apos;t been ended yet.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                      <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-400/20">
                        <p className="text-sm text-gray-300">
                          <span className="font-semibold text-white">Course: </span>
                          {existingSession?.courseCode}
                        </p>
                        <p className="text-sm text-gray-300 mt-1">
                          <span className="font-semibold text-white">Started: </span>
                          {existingSession?.startTime ? new Date(existingSession.startTime).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                      <p className="text-sm text-gray-300">
                        Would you like to continue with this session or end it?
                      </p>
                    </div>
                    <DialogFooter className="gap-3">
                      <Button
                        onClick={endExistingSession}
                        disabled={loading}
                        variant="destructive"
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        End Session
                      </Button>
                      <Button 
                        onClick={resumeExistingSession}
                        disabled={loading}
                        className="bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Continue Session
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {/* Step 1: Start Attendance Button */}
                {!sessionId && !showStartAttendanceDialog && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#E7DDF0] border-l-4 border-l-[#8437C8] bg-white p-5 shadow-[0_6px_16px_rgba(71,38,96,0.1)] sm:p-6">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0E5F8] text-[#8437C8]">
                          <MapPin className="h-5 w-5" />
                        </span>
                        <h3 className="text-lg font-semibold text-[#2D1A3A]">Start New Session</h3>
                      </div>
                      <p className="mb-5 text-sm leading-5 text-[#6B6172]">
                        Create a new attendance session for one of your courses.
                        Students enrolled in the selected course will be able to mark their attendance.
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={startAttendance}
                              disabled={loading || loadingCourses || lecturerCourses.length === 0}
                              className="w-full bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
                            >
                              {loading || loadingCourses ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <MapPin className="mr-2 h-4 w-4" />
                              )}
                              Start Taking Attendance
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{lecturerCourses.length === 0 ? 'No courses assigned' : 'Select a course to start'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )}

                {/* Step 2: Time Limit Step (Optional) */}
                {!sessionId && showTimeLimitDialog && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex flex-col items-center rounded-xl border border-[#E7DDF0] bg-[#FBF9FD] p-6 shadow-sm">
                      <h3 className="mb-2 text-lg font-semibold text-[#2D1A3A]">Set Attendance Time Limit <span className="text-xs text-[#8A7D91]">(Optional)</span></h3>
                      <p className="mb-4 text-center text-[#6B6172]">You can set a time limit for this attendance session. The session will automatically end when the time is up. Leave as &quot;No time limit&quot; to allow manual ending.</p>
                      <div className="flex flex-col items-center gap-2 mb-4 w-full">
                        <label htmlFor="timeLimitDropdown" className="mb-1 text-base font-medium text-[#2D1A3A]">Time Limit</label>
                        <div className="relative w-full max-w-xs">
                          <select
                            id="timeLimitDropdown"
                            value={timeLimit}
                            onChange={e => setTimeLimit(e.target.value)}
                            disabled={loading}
                            className="block w-full appearance-none bg-white/20 border border-white/30 text-white text-lg rounded-xl py-3 px-4 pr-10 focus:ring-2 focus:ring-indigo-400 transition-all duration-150 outline-none shadow-lg hover:bg-white/30 cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="" className="text-gray-700 bg-white dark:bg-gray-900 dark:text-gray-200">No time limit (manual end)</option>
                            <option value="1" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">1 minute</option>
                            <option value="2" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">2 minutes</option>
                            <option value="5" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">5 minutes</option>
                            <option value="10" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">10 minutes</option>
                            <option value="15" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">15 minutes</option>
                            <option value="20" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">20 minutes</option>
                            <option value="30" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">30 minutes</option>
                            <option value="45" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">45 minutes</option>
                            <option value="60" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">1 hour</option>
                            <option value="90" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200">1.5 hours</option>
                            
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                            <svg className="h-5 w-5 text-white/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.25 4.65a.75.75 0 01-1.08 0l-4.25-4.65a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                          </span>
                        </div>
                        <span className="text-gray-300 text-xs mt-1">Select a time limit or leave as &quot;No time limit&quot;</span>
                      </div>
                      <div className="flex gap-4 w-full">
                        <Button
                          onClick={confirmStartAttendance}
                          disabled={loading}
                          className="w-full bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
                        >
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                          Start Session
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            setTimeLimit('');
                            setShowTimeLimitDialog(false);
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
                                  hostId: user?.id,
                                  latitude: position.latitude,
                                  longitude: position.longitude
                                  // No timeLimit field at all
                                }),
                              });
                              const data = await response.json();
                              if (data.status === 'success') {
                                setSessionId(data.sessionId);
                                setSessionStartTime(new Date());
                                setSuccess('Attendance session started successfully!');
                                setShowTimeLimitDialog(false);
                                setTimeLimit('');
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
                          }}
                          disabled={loading}
                          className="w-full"
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Session Info and End Button */}
                {sessionId && (
                  <div className="space-y-6">
                    {/* Active Session Display */}
                    <div className="mb-4 rounded-2xl border border-[#E7DDF0] border-l-4 border-l-[#8437C8] bg-white p-4 text-[#2D1A3A] shadow-sm">
                      <div className="mb-1 text-sm font-medium text-[#8A7D91]">Course</div>
                      <div className="text-xl font-semibold">{activeCourseCode || 'Unknown Course'}</div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-[#E7DDF0] bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between text-sm font-medium text-[#8A7D91]">
                          <span>Students Present</span>
                          <Users className="h-5 w-5 text-[#8437C8]" />
                        </div>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-[#2D1A3A]">
                            {activeStudents}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E7DDF0] bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between text-sm font-medium text-[#8A7D91]">
                          <span>Duration</span>
                          <Clock className="h-5 w-5 text-[#8437C8]" />
                        </div>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-[#2D1A3A]">
                            {sessionStartTime 
                              ? Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 60000)
                              : 0}m
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Real-time Attendance Viewer Toggle */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setShowAttendanceViewer(!showAttendanceViewer)}
                        variant="outline"
                        className="w-full border-[#8437C8] bg-white text-[#8437C8] hover:bg-[#F6F0FB] sm:w-auto"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {showAttendanceViewer ? 'Hide' : 'View'} Live Attendance
                      </Button>
                    </div>

                    {/* Real-time Attendance List */}
                    {showAttendanceViewer && (
                      <div className="animate-fadeIn rounded-2xl border border-[#D8C5EA] bg-[#F6F0FB] p-4 sm:p-6">
                        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#2D1A3A]">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                          Live Attendance Feed
                        </h3>
                        
                        {realtimeAttendance.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-[#6B6172]">Waiting for students to mark attendance...</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {realtimeAttendance.map((record, index) => (
                              <div
                                key={`${record.studentId}-${index}`}
                                className="flex items-start justify-between rounded-xl border border-[#E7DDF0] bg-white p-3 transition-all duration-200 hover:shadow-sm"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <p className="font-medium text-[#2D1A3A]">{record.studentName || 'Unknown Student'}</p>
                                  </div>
                                  <div className="mt-1 text-xs text-[#8A7D91]">
                                    {new Date(record.timestamp).toLocaleTimeString()}
                                  </div>
                                </div>
                                {record.distance !== undefined && (
                                  <div className="text-right">
                                    <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded">
                                      {Math.round(record.distance)}m away
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col justify-end gap-3 sm:flex-row">
                      <Button
                        onClick={endAttendance}
                        disabled={loading}
                        variant="destructive"
                        className="w-full bg-red-500 font-semibold text-white hover:bg-red-600 sm:w-auto"
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
                )}

                {/* Scheduled Sessions Tab */}
                {activeTab === 'scheduled' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Create Schedule Button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setScheduleFormData({
                            courseCode: '',
                            scheduledDate: '',
                            scheduledTime: '',
                            timeLimit: '',
                            description: '',
                          });
                          // Request geolocation permission when opening dialog
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              () => {}, // Permission granted, location will be captured during schedule creation
                              () => {}, // Permission denied, proceed anyway
                              { timeout: 5000 }
                            );
                          }
                          setShowCreateScheduleDialog(true);
                        }}
                        className="bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule New Session
                      </Button>
                    </div>

                    {/* Upcoming Schedules */}
                    {schedules.upcoming.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-blue-400" />
                          Upcoming Sessions ({schedules.upcoming.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {schedules.upcoming.map((schedule: any) => (
                            <Card key={schedule.scheduleId} className="border-blue-500/50 bg-blue-500/10">
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-white">{schedule.courseCode}</h4>
                                    <p className="text-gray-400 text-sm">{schedule.description}</p>
                                  </div>
                                  <Badge className="bg-blue-500">Upcoming</Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-sm">{schedule.scheduledDate}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-sm">{schedule.scheduledTime}</span>
                                  </div>
                                </div>

                                {schedule.timeLimit && (
                                  <div className="mb-4 p-2 bg-white/5 rounded text-sm text-gray-300">
                                    <span className="font-medium">Time Limit:</span> {schedule.timeLimit} minutes
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleStartScheduledSession(schedule)}
                                    disabled={loading}
                                    className="flex-1 bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
                                  >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                    Start Now
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setSelectedSchedule(schedule);
                                      setShowDeleteScheduleConfirm(true);
                                    }}
                                    disabled={loading}
                                    variant="outline"
                                    className="border-red-500/50 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Started Schedules */}
                    {schedules.started.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Play className="h-5 w-5 text-green-400" />
                          Active Sessions ({schedules.started.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {schedules.started.map((schedule: any) => (
                            <Card key={schedule.scheduleId} className="border-green-500/50 bg-green-500/10">
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between mb-4">
                                  <h4 className="text-lg font-semibold text-white">{schedule.courseCode}</h4>
                                  <div className="flex items-center gap-2">
                                    {schedule.autoStarted && (
                                      <Badge variant="secondary" className="bg-blue-500/50 text-blue-200 text-xs">
                                        Auto-started
                                      </Badge>
                                    )}
                                    <Badge className="bg-green-500">Active</Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-300">Session ID: {schedule.sessionId}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed Schedules */}
                    {schedules.completed.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-gray-400" />
                          Completed Sessions ({schedules.completed.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {schedules.completed.map((schedule: any) => {
                            const hasSessionId = !!schedule.sessionId;
                            const isExpired = !hasSessionId;
                            
                            return (
                              <Card key={schedule.scheduleId} className={isExpired ? "border-orange-500/50 bg-orange-500/10" : "border-gray-500/50 bg-gray-500/10"}>
                                <CardContent className="pt-6">
                                  <div className="flex items-start justify-between mb-4">
                                    <h4 className="text-lg font-semibold text-white">{schedule.courseCode}</h4>
                                    <div className="flex items-center gap-2">
                                      {hasSessionId && (
                                        <Badge className="bg-green-600">Ended</Badge>
                                      )}
                                      {isExpired && (
                                        <Badge className="bg-orange-600">Expired</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-300 mt-2">{schedule.scheduledDate}</p>
                                  {hasSessionId && (
                                    <p className="text-xs text-gray-400 mt-2">Session ID: {schedule.sessionId}</p>
                                  )}
                                  {isExpired && (
                                    <p className="text-xs text-orange-300 mt-2">Session was not started</p>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {schedules.upcoming.length === 0 &&
                      schedules.started.length === 0 &&
                      schedules.completed.length === 0 &&
                      schedules.cancelled.length === 0 && (
                        <Card className="border-2 border-dashed border-white/20">
                          <CardContent className="pt-12 pb-12 text-center">
                            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <h4 className="text-lg font-semibold text-white mb-2">No Scheduled Sessions</h4>
                            <p className="text-gray-400 mb-6">Create your first scheduled attendance session</p>
                            <Button
                              onClick={() => {
                                setScheduleFormData({
                                  courseCode: '',
                                  scheduledDate: '',
                                  scheduledTime: '',
                                  timeLimit: '',
                                  description: '',
                                });
                                setShowCreateScheduleDialog(true);
                              }}
                              className="bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              Create Schedule
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                )}
              </>
            ) : userRole === 'student' ? (
              <div className="space-y-6">
                {/* Stepper for student: Step 1 - Face Verification, Step 2 - Attendance Code */}
                <div className="mb-6 flex flex-col items-center">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-bold shadow-sm ${!faceVerified ? 'scale-110 border-[#8437C8] bg-[#8437C8] text-white' : 'border-[#92D0AA] bg-[#92D0AA] text-white'}`}>1</div>
                    <div className={`h-1 w-10 ${faceVerified ? 'bg-[#92D0AA]' : 'bg-[#D8C5EA]'} transition-all`}></div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-bold shadow-sm ${faceVerified ? 'scale-110 border-[#8437C8] bg-[#8437C8] text-white' : 'border-[#D8C5EA] bg-[#F6F0FB] text-[#8A7D91]'}`}>2</div>
                  </div>
                  <div className="mt-2 flex w-56 justify-between text-xs font-semibold">
                    <span className={`${!faceVerified ? 'text-[#8437C8]' : 'text-[#0E9F4D]'}`}>Face Verification</span>
                    <span className={`${faceVerified ? 'text-[#8437C8]' : 'text-[#8A7D91]'}`}>Attendance</span>
                  </div>
                </div>

                {/* Step 1: Face Verification */}
                {!faceVerified && (
                  <div className="animate-fadeIn">
                    <FaceVerificationPanel sessionId={sessionId || ''} onVerified={() => setFaceVerified(true)} />
                  </div>
                )}

                {/* Step 2: Active Classes, only after face verification */}
                {faceVerified && (
                  <div className="animate-fadeIn rounded-2xl border border-[#E7DDF0] bg-white p-4 shadow-[0_8px_24px_rgba(71,38,96,0.12)] sm:p-8">
                    <div className="mb-8 flex flex-col items-center">
                      <span className="mb-1 text-2xl font-bold tracking-widest text-[#8437C8]">Step 2</span>
                      <span className="text-lg font-semibold text-[#2D1A3A]">Active Classes</span>
                    </div>

                    {attendanceMarked ? (
                      <div className="w-full rounded-xl border border-[#92D0AA] bg-[#E5F5EA] p-6 text-center">
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0E9F4D]">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-[#087A3E]">Attendance Marked Successfully!</p>
                        <p className="mt-2 text-sm text-[#3D7651]">You have already marked your attendance. You cannot mark attendance again.</p>
                      </div>
                    ) : loadingStudentCourses ? (
                      <div className="flex items-center justify-center w-full py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-[#8437C8]" />
                        <p className="ml-3 text-[#6E27AE]">Loading your courses...</p>
                      </div>
                    ) : (() => {
                      const activeCourses = studentCourses.filter(c => c.hasActiveSession);
                      
                      if (studentCourses.length === 0) {
                        return (
                          <div className="w-full rounded-xl border border-[#E7C96E] bg-[#FFF7D9] p-6 text-center">
                            <p className="flex items-center justify-center gap-2 font-medium text-[#7A5A00]">
                              <Info className="h-5 w-5 text-[#B68700]" />
                              You haven&apos;t registered for any courses
                            </p>
                          </div>
                        );
                      }

                      if (activeCourses.length === 0) {
                        return (
                          <div className="w-full rounded-xl border border-[#D8C5EA] bg-[#F6F0FB] p-6 text-center">
                            <p className="flex items-center justify-center gap-2 font-medium text-[#6E27AE]">
                              <Info className="h-5 w-5" />
                              No active classes right now. Check back soon!
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="w-full space-y-4">
                          {activeCourses.map((course) => (
                            <div
                              key={course.code}
                              className={`cursor-pointer rounded-xl border-2 p-4 transition-all duration-300 sm:p-6 ${
                                selectedStudentCourse === course.code
                                  ? 'border-[#8437C8] bg-[#F6F0FB] shadow-sm'
                                  : 'border-[#E7DDF0] bg-white hover:border-[#B98BDC] hover:bg-[#FBF9FD]'
                              }`}
                              onClick={() => {
                                setSelectedStudentCourse(course.code);
                                setLoadingStudentCourses(false);
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-semibold uppercase tracking-wide text-[#8437C8]">
                                    {course.code}
                                  </div>
                                  <div className="mt-1 text-lg font-bold text-[#2D1A3A]">
                                    {course.title}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 animate-pulse rounded-full bg-[#0E9F4D]"></div>
                                  <span className="text-xs font-semibold uppercase text-[#0E9F4D]">Active</span>
                                </div>
                              </div>
                              {selectedStudentCourse === course.code && (
                                <div className="mt-4 border-t border-[#D8C5EA] pt-4">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAttendance();
                                    }}
                                    disabled={loading}
                                    className="w-full rounded-lg bg-[#8437C8] py-2 font-semibold text-white transition-all duration-200 hover:bg-[#6E27AE]"
                                  >
                                    {loading ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <MapPin className="mr-2 h-4 w-4" />
                                    )}
                                    Mark Attendance
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {position && (
                  <Alert className="border-[#B9D5F0] bg-[#EEF6FF] text-[#2E63C7]">
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
                className="w-full bg-[#8437C8] font-semibold text-white hover:bg-[#6E27AE]"
              >
                <Link href="/admin/sessions">View All Sessions</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Combined Start Attendance Dialog */}
      <Dialog open={showStartAttendanceDialog} onOpenChange={setShowStartAttendanceDialog}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl border border-[#E7DDF0] bg-white p-5 text-[#2D1A3A] shadow-[0_12px_30px_rgba(71,38,96,0.18)] sm:p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-bold text-[#2D1A3A] sm:text-3xl">
              Start Taking Attendance
            </DialogTitle>
            <DialogDescription className="text-sm leading-5 text-[#6B6172] sm:text-base">
              Select a course and optionally set a time limit for this session
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            {/* Course Selection */}
            <div className="flex w-full flex-col gap-3">
              <Label htmlFor="courseSelect" className="flex items-center gap-2 text-base font-semibold text-[#2D1A3A]">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.753 2 16.253s4.5 10 10 10 10-4.5 10-10S17.5 6.253 12 6.253z" />
                </svg>
                Course
              </Label>
              <div className="relative w-full">
                {loadingCourses && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-[#8437C8]" />
                  </div>
                )}
                <select
                  id="courseSelect"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  disabled={loadingCourses || lecturerCourses.length === 0}
                  className="block w-full appearance-none rounded-lg border border-[#CDBDDA] bg-white px-4 py-3 pr-10 text-base text-[#2D1A3A] transition-colors duration-200 focus:border-[#8437C8] focus:ring-2 focus:ring-[#8437C8]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" className="bg-white text-[#8A7D91]">-- Select a course --</option>
                  {Array.isArray(lecturerCourses) && lecturerCourses.map((course) => {
                    const courseCode = course?.code || '';
                    const courseTitle = course?.title || '';
                    return (
                      <option key={courseCode} value={courseCode} className="bg-white text-[#2D1A3A]">
                        {courseCode} {courseTitle ? `- ${courseTitle}` : ''}
                      </option>
                    );
                  })}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-[#8437C8]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.25 4.65a.75.75 0 01-1.08 0l-4.25-4.65a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              {lecturerCourses.length === 0 && !loadingCourses && (
                <div className="rounded-lg border border-[#E7C96E] bg-[#FFF7D9] p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[#7A5A00]">
                    <Info className="h-4 w-4 text-[#B68700]" />
                    No courses assigned to you
                  </p>
                </div>
              )}
              {loadingCourses && (
                <div className="rounded-lg border border-[#D8C5EA] bg-[#F6F0FB] p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[#6E27AE]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your courses...
                  </p>
                </div>
              )}
            </div>

            {/* Time Limit Selection */}
            <div className="flex w-full flex-col gap-3 border-t border-[#E7DDF0] pt-5">
              <Label htmlFor="timeLimitSelect" className="flex items-center gap-2 text-base font-semibold text-[#2D1A3A]">
                <Clock className="h-5 w-5" />
                Session Duration
              </Label>
              <select
                id="timeLimitSelect"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                disabled={loading}
                className="block w-full appearance-none rounded-lg border border-[#CDBDDA] bg-white px-4 py-3 text-base text-[#2D1A3A] transition-colors duration-200 focus:border-[#8437C8] focus:ring-2 focus:ring-[#8437C8]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" className="bg-white text-[#8A7D91]">No time limit (manual end)</option>
                <option value="1" className="bg-white text-[#2D1A3A]">1 minute</option>
                <option value="2" className="bg-white text-[#2D1A3A]">2 minutes</option>
                <option value="5" className="bg-white text-[#2D1A3A]">5 minutes</option>
                <option value="10" className="bg-white text-[#2D1A3A]">10 minutes</option>
                <option value="15" className="bg-white text-[#2D1A3A]">15 minutes</option>
                <option value="20" className="bg-white text-[#2D1A3A]">20 minutes</option>
                <option value="30" className="bg-white text-[#2D1A3A]">30 minutes</option>
                <option value="45" className="bg-white text-[#2D1A3A]">45 minutes</option>
                <option value="60" className="bg-white text-[#2D1A3A]">1 hour</option>
                <option value="90" className="bg-white text-[#2D1A3A]">1.5 hours</option>
              </select>
              {timeLimit && (
                <div className="rounded-lg border border-[#D8C5EA] bg-[#F6F0FB] p-3">
                  <p className="text-sm font-medium text-[#6E27AE]">
                    Session will end after {timeLimit} minute{timeLimit === '1' ? '' : 's'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setShowStartAttendanceDialog(false);
                setSelectedCourse('');
                setTimeLimit('');
              }}
              className="w-full border-[#CDBDDA] bg-white text-[#6E27AE] transition-colors duration-200 hover:bg-[#F6F0FB] sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmStartAttendance} 
              disabled={loading || !selectedCourse}
              className="w-full bg-[#8437C8] font-semibold text-white shadow-lg transition-all duration-200 hover:bg-[#6E27AE] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remaining Time Alert */}
      {sessionId && timeLimit && remainingTime !== null && (
        <div className="fixed right-3 top-[76px] z-40 w-[calc(100%-1.5rem)] max-w-[280px] rounded-2xl border border-[#D8C5EA] bg-white p-4 text-[#2D1A3A] shadow-[0_8px_20px_rgba(71,38,96,0.16)] sm:right-6 sm:top-20 sm:w-auto sm:min-w-[250px]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0E5F8] text-[#8437C8]">
                <Clock className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-[#6E27AE]">Time Remaining</span>
            </div>
            <span className="text-2xl font-bold tracking-wider text-[#2D1A3A]">
              {String(Math.floor(remainingTime / 60)).padStart(2, '0')}:
              {String(remainingTime % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#E9DDF5]">
            <div 
              className="h-1.5 rounded-full bg-[#8437C8] transition-all duration-1000"
              style={{ 
                width: `${(remainingTime / (parseInt(timeLimit) * 60)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Create Schedule Dialog */}
      <Dialog open={showCreateScheduleDialog} onOpenChange={setShowCreateScheduleDialog}>
        <DialogContent className="bg-gray-900 border border-white/20 text-white w-full mx-auto max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-400" />
              Schedule New Session
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-gray-400">
              Create a new scheduled attendance session for your course
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {/* Location Permission Notice */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 sm:p-3 text-xs sm:text-sm text-blue-300">
              <p className="flex items-start gap-2">
                <span className="text-base sm:text-lg leading-none flex-shrink-0">ℹ️</span>
                <span>Your location will be captured for this scheduled session. Please allow location access when prompted.</span>
              </p>
            </div>

            {/* Course Code Selection */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2 block">Course Code</label>
              <select
                value={scheduleFormData.courseCode}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, courseCode: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-md px-2 sm:px-3 py-1 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" className="bg-gray-900 text-gray-400">Select a course</option>
                {lecturerCourses.map((course) => (
                  <option key={course.code} value={course.code} className="bg-gray-900 text-white">
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2 block">Date</label>
              <input
                type="date"
                value={scheduleFormData.scheduledDate}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduledDate: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-md px-2 sm:px-3 py-1 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2 block">Time</label>
              <input
                type="time"
                value={scheduleFormData.scheduledTime}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduledTime: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-md px-2 sm:px-3 py-1 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Time Limit (Optional) */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2 block">Time Limit (minutes) - Optional</label>
              <input
                type="number"
                value={scheduleFormData.timeLimit}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, timeLimit: e.target.value })}
                className="w-full bg-white/5 border border-white/20 rounded-md px-2 sm:px-3 py-1 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Leave empty for no limit"
                min="1"
              />
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2 block">Description - Optional</label>
              <Textarea
                value={scheduleFormData.description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setScheduleFormData({ ...scheduleFormData, description: e.target.value })}
                placeholder="Add any notes or instructions..."
                className="bg-white/5 border border-white/20 text-white rounded-md text-sm"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 sm:pt-4 flex flex-col-reverse sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowCreateScheduleDialog(false)}
              className="border-white/20 hover:bg-white/10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSchedule}
              disabled={loading || !scheduleFormData.courseCode || !scheduleFormData.scheduledDate || !scheduleFormData.scheduledTime}
              className="bg-[#8437C8] text-xs font-semibold text-white hover:bg-[#6E27AE] sm:text-sm"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Schedule Confirmation Dialog */}
      <Dialog open={showDeleteScheduleConfirm} onOpenChange={setShowDeleteScheduleConfirm}>
        <DialogContent className="bg-gray-900 border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-400">Cancel Schedule</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel this scheduled session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/20 space-y-2">
              <p className="text-sm"><span className="font-semibold text-gray-300">Course:</span> {selectedSchedule.courseCode}</p>
              <p className="text-sm"><span className="font-semibold text-gray-300">Date:</span> {selectedSchedule.scheduledDate}</p>
              <p className="text-sm"><span className="font-semibold text-gray-300">Time:</span> {selectedSchedule.scheduledTime}</p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteScheduleConfirm(false);
                setSelectedSchedule(null);
              }}
              className="border-white/20 hover:bg-white/10"
            >
              Keep Schedule
            </Button>
            <Button
              onClick={() => {
                handleDeleteSchedule();
              }}
              disabled={loading}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancel Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhysicalAttendancePage;
