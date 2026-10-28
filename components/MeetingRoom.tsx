'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  CallControls,
  CallParticipantsList,
  CallStatsButton,
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';
import { Box, Text, Button } from '@chakra-ui/react';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { AttendanceData } from '@/types/attendance';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, LayoutList, CheckCircle2, Timer, Eye, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Loader from './Loader';
import EndCallButton from './EndCallButton';
import AttendancePanel from './AttendancePanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Dynamically import StreamChatComponent to avoid SSR issues
const StreamChatComponent = dynamic(() => import('./StreamChatComponent'), { ssr: false });

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';

interface MeetingRoomProps {
  onSessionEnd?: (data: AttendanceData) => void;
}

const MeetingRoom = ({ onSessionEnd }: MeetingRoomProps) => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams?.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('grid');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [attendanceActive, setAttendanceActive] = useState(false);  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const { useCallCallingState, useHasOngoingScreenShare } = useCallStateHooks();
  const hasOngoingScreenShare = useHasOngoingScreenShare();
  const { user } = useUser();
  const call = useCall();
  const streamHostId = call?.state.createdBy?.id;
  const isHost = user?.id && streamHostId && user.id === streamHostId;

  // Stream Chat state
  const [showChat, setShowChat] = useState(false);

  // Class title dialog state
  const [showClassTitleDialog, setShowClassTitleDialog] = useState(false);
  const [classTitle, setClassTitle] = useState('');

  // Log any changes to attendance state
  useEffect(() => {
    if (!call) return;

    const handleCallUpdated = async () => {
      const sessionId = call.state.custom?.currentSessionId;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      if (sessionId) {
        try {
          const response = await fetch(`${backendUrl}/get-session-status?sessionId=${sessionId}`);
          const data = await response.json();
          if (response.ok) {
            setCurrentSessionId(sessionId);
            setAttendanceActive(!!data.isActive);
            // If backend says inactive but Stream state is still active, force sync
            if (!data.isActive && call.state.custom?.attendanceActive) {
              try {
                await call.update({
                  custom: {
                    ...call.state.custom,
                    attendanceActive: false,
                    currentSessionId: null
                  }
                });
                setAttendanceActive(false);
                setCurrentSessionId('');
              } catch (error) {
                console.error('[Attendance] Forced Stream state sync failed:', error);
              }
            }
          } else {
            // Backend error or session not found, force Stream state to inactive
            try {
              await call.update({
                custom: {
                  ...call.state.custom,
                  attendanceActive: false,
                  currentSessionId: null
                }
              });
              setAttendanceActive(false);
              setCurrentSessionId('');
            } catch (error) {
              console.error('[Attendance] Forced Stream state sync on backend error failed:', error);
            }
          }
        } catch (error) {
          console.error('[Attendance] Error verifying session status:', error);
          toast({
            title: "Warning",
            description: "Having trouble syncing attendance status. Please check your connection.",
            variant: "destructive",
            duration: 5000
          });
        }
      } else {
        setAttendanceActive(false);
        setCurrentSessionId('');
      }
    };

    // Set initial state and handle updates
    handleCallUpdated();
    call.on('call.updated', handleCallUpdated);
    
    return () => {
      call.off('call.updated', handleCallUpdated);
      
      // Clean up any active session if component unmounts
      const cleanup = async () => {
        if (!currentSessionId) return;

        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
          await fetch(`${backendUrl}/end-attendance-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId }),
          });
        } catch (error) {
          console.error('[Attendance] Cleanup on unmount failed:', error);
        }
      };

      cleanup().catch((error) => {
        console.error('[Attendance] Cleanup on unmount failed:', error);
      });
    };
  }, [call, currentSessionId]);

  const handleAttendanceToggle = async () => {
    if (!call || !user?.id) {
      console.log('[Attendance] Missing required data:', { hasCall: !!call, userId: user?.id });
      toast({
        title: "Error",
        description: "Unable to manage attendance at this time.",
        variant: "destructive"
      });
      return;
    }

    const newState = !attendanceActive;
    if (newState) {
      setShowClassTitleDialog(true);
    } else {
      // Stop attendance logic remains the same
      handleStopAttendance();
    }
  };

  const handleStartAttendance = async (classTitle: string) => {
    if (!call || !user?.id) {
      console.error('[Attendance] Missing required data:', { hasCall: !!call, userId: user?.id });
      toast({
        title: "Error",
        description: "Unable to start attendance at this time.",
        variant: "destructive"
      });
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    try {
      const sessionId = `session-${new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace(/T/, '-')
        .split('.')[0]}-${Math.random().toString(36).substring(2, 7)}`;
      
      console.log('[Attendance] Starting new session:', { 
        sessionId, 
        classTitle,
        timestamp: new Date().toISOString() 
      });

      // First create session in backend
      const createResponse = await fetch(`${backendUrl}/create-attendance-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          hostId: user.id,
          classTitle: classTitle
        }),
      });

      const responseData = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(responseData.detail || 'Failed to start attendance session');
      }

      // Update call state only if backend succeeds
      await call.update({
        custom: {
          ...call.state.custom,
          attendanceActive: true,
          currentSessionId: sessionId,
          classTitle: classTitle
        }
      });

      // After stream is updated, verify with backend again
      const verifyResponse = await fetch(`${backendUrl}/get-session-status?sessionId=${sessionId}`);
      const verifyData = await verifyResponse.json();
      setAttendanceActive(!!verifyData.isActive);
      setCurrentSessionId(sessionId);
      setShowClassTitleDialog(false);
      setClassTitle('');

    } catch (error) {
      console.error('[Attendance] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start attendance session",
        variant: "destructive"
      });
    }
  };

  const handleStopAttendance = async () => {
    if (!currentSessionId || !call) {
      console.error('[Attendance] Missing required data:', { hasCurrentSessionId: !!currentSessionId, hasCall: !!call });
      toast({
        title: "Error",
        description: "Unable to stop attendance at this time.",
        variant: "destructive"
      });
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    
    try {
      // First end session in backend
      const endResponse = await fetch(`${backendUrl}/end-attendance-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: currentSessionId 
        })
      });

      if (!endResponse.ok) {
        const errorData = await endResponse.json();
        throw new Error(errorData.detail || 'Failed to end attendance session');
      }

      const endData = await endResponse.json();

      // Only update call state if backend succeeds
      await call.update({
        custom: {
          ...call.state.custom,
          attendanceActive: false,
          currentSessionId: null,
          classTitle: null
        }
      });

      setAttendanceActive(false);
      setCurrentSessionId('');
      
      // Show success toast with download option
      if (endData.recordCount) {
        handleSessionEnd(endData);
      }

      // After ending, verify with backend again
      const verifyResponse = await fetch(`${backendUrl}/get-session-status?sessionId=${currentSessionId}`);
      const verifyData = await verifyResponse.json();
      setAttendanceActive(!!verifyData.isActive);
      if (!verifyData.isActive) setCurrentSessionId('');
    } catch (error) {
      console.error('[Attendance] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to end attendance session",
        variant: "destructive"
      });
    }
  };

  const callingState = useCallCallingState();
  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout = () => {
    switch (layout) {
      case 'grid':
        return hasOngoingScreenShare
          ? <SpeakerLayout participantsBarPosition="bottom" />
          : <PaginatedGridLayout />;
      case 'speaker-right':
        return <SpeakerLayout participantsBarPosition="left" />;
      default:
        return <SpeakerLayout participantsBarPosition="right" />;
    }
  };
  const handleSessionEnd = async (data: AttendanceData) => {
    setAttendanceData(data);
    onSessionEnd?.(data);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    toast({
      title: "Attendance Stopped Successfully",
      description: `${data.recordCount} records saved. Click here to download the report.`,
      variant: "default",
      action: data.downloadUrl ? (
        <ToastAction 
          altText="Download report" 
          onClick={() => {
            if (typeof window !== 'undefined' && user?.id) {
              // Use the download endpoint with query parameters
              const downloadUrl = `${backendUrl}/download-attendance?sessionId=${data.downloadUrl.split('/').pop()}&userId=${user.id}`;
              window.location.href = downloadUrl;
            }
          }}
        >
          Download
        </ToastAction>
      ) : undefined
    });
  };


  return (
    <div className="relative min-h-screen bg-[#F7F4F8]">
      <section className={`relative min-h-screen w-full overflow-hidden text-[#2D1A3A] ${showControls ? 'pb-24 pt-3 sm:pt-5' : 'pb-0 pt-0'}`}>
        {/* Attendance Panel - responsive positioning */}
        <div className="fixed right-2 top-2 z-50 sm:right-6 sm:top-6">
          {!isHost && currentSessionId && (
            <AttendancePanel 
              sessionId={currentSessionId}
            />
          )}
        </div>

        <div className={`relative flex w-full items-center justify-center ${showControls ? 'min-h-[calc(100vh-7rem)] px-2 pb-3 sm:px-4' : 'min-h-[100svh] px-0 pb-0'}`}>
          <div className={`meeting-room-stage flex w-full items-center justify-center bg-[#24152F] ${showControls ? 'min-h-[calc(100vh-7rem)] max-w-[1180px] rounded-[22px] border border-[#E8E0ED] p-1 shadow-[0_12px_28px_rgba(71,38,96,0.14)] sm:rounded-[28px] sm:p-2' : 'min-h-[100svh] max-w-none rounded-none border-0 p-0 shadow-none'}`}>
            <CallLayout />
            {/* Chat panel rendered as a floating modal, but toggle is in controls below */}
            {showChat && user && call && (
              <div className="fixed bottom-[5.25rem] left-2 right-2 z-50 flex h-[min(70vh,500px)] flex-col overflow-hidden rounded-2xl border border-[#E8E0ED] bg-white shadow-[0_14px_35px_rgba(45,27,74,0.2)] sm:bottom-24 sm:left-auto sm:right-4 sm:w-[min(100%-2rem,420px)]">
                <StreamChatComponent
                  userId={user.id}
                  userName={user.fullName || user.username || user.emailAddresses?.[0]?.emailAddress || 'User'}
                  callId={call.id}
                  onClose={() => setShowChat(false)}
                />
              </div>
            )}
          </div>
          
          {/* Participants List - responsive width */}
          <div
            className={`${showParticipants ? 'flex' : 'hidden'} fixed bottom-[5.25rem] left-2 right-2 z-50 h-[65vh] max-h-[520px] min-h-[280px] flex-col overflow-hidden rounded-2xl border border-[#E8E0ED] bg-white shadow-[0_14px_35px_rgba(45,27,74,0.2)] sm:static sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto sm:ml-2 sm:h-[calc(100vh-7rem)] sm:min-h-0 sm:w-[300px] sm:max-w-[350px] sm:shadow-[0_12px_28px_rgba(71,38,96,0.14)]`}
          >
            <CallParticipantsList onClose={() => setShowParticipants(false)} />
          </div>
        </div>
        
        {showControls && (
        <div className={`meeting-room-controls ${isHost ? '' : 'meeting-room-controls--member'} fixed bottom-3 left-1/2 z-40 flex min-h-16 w-[calc(100%-1rem)] max-w-[1180px] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#2D1A3A]/95 px-2 py-2 shadow-[0_10px_28px_rgba(45,26,58,0.3)] backdrop-blur sm:bottom-5 sm:min-h-0 sm:gap-4 sm:px-4 sm:py-3`}>
          <CallControls onLeave={() => router.push(`/`)} />

          {/* Attendance and Chat toggles side by side */}
          <div className="flex gap-2 items-center">
            {isHost && (
              <button
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 ${
                  attendanceActive 
                    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                    : 'bg-[#0E9F4D] hover:bg-[#087B3A] shadow-[#0E9F4D]/20'
                } shadow-lg`}
                onClick={handleAttendanceToggle}
              >
                {attendanceActive ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Stop Taking Attendance</span>
                    <span className="sm:hidden">Stop</span>
                  </>
                ) : (
                  <>
                    <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Start Taking Attendance</span>
                    <span className="sm:hidden">Start</span>
                  </>
                )}
              </button>
            )}
            {/* Chat toggle button */}
            <button
              className={`flex items-center gap-2 rounded-xl bg-[#2D1A3A] px-3 py-2 text-sm text-white shadow-md transition-all duration-200 hover:bg-[#45245A] sm:px-4 sm:py-2.5 sm:text-base ${showChat ? 'ring-2 ring-[#B98BDC]' : ''}`}
              onClick={() => setShowChat((prev) => !prev)}
              style={{ minWidth: 40 }}
              aria-label={showChat ? 'Hide Chat' : 'Show Chat'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75v-12A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25H6.25L2.25 21v-2.25z" />
              </svg>
              <span className="hidden sm:inline">{showChat ? 'Hide Chat' : 'Show Chat'}</span>
            </button>
          </div>

          {/* Layout dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer rounded-xl bg-[#F0E5F8] px-3 py-2 hover:bg-[#E4D2F0] sm:px-4">
              <LayoutList size={20} className="text-[#6E27AE]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="border-[#E8E0ED] bg-white text-[#2D1A3A]">
              {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
                <div key={index}>
                  <DropdownMenuItem
                    onClick={() =>
                      setLayout(item.toLowerCase() as CallLayoutType)
                    }
                  >
                    {item}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="border-[#F0EAF2]" />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <CallStatsButton />
          
          <button onClick={() => setShowParticipants((prev) => !prev)}>
              <div className="cursor-pointer rounded-xl bg-[#F0E5F8] px-3 py-2 hover:bg-[#E4D2F0] sm:px-4">
              <Users size={20} className="text-[#6E27AE]" />
            </div>
          </button>
          
          {!isPersonalRoom && isHost && (
            <EndCallButton />
          )}
          <button
            type="button"
            onClick={() => setShowControls(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0E5F8] text-[#6E27AE] transition-colors hover:bg-[#E4D2F0]"
            aria-label="Hide meeting controls"
            title="Hide meeting controls"
          >
            <EyeOff className="h-5 w-5" />
          </button>
        </div>
        )}

        {!showControls && (
          <button
            type="button"
            onClick={() => setShowControls(true)}
            className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#8437C8] text-white shadow-[0_8px_18px_rgba(71,38,96,0.25)] transition-colors hover:bg-[#6E27AE] sm:bottom-6 sm:right-6"
            aria-label="Show meeting controls"
            title="Show meeting controls"
          >
            <Eye className="h-5 w-5" />
          </button>
        )}

        {/* Session Summary - responsive positioning and sizing */}
        {attendanceData && (
          <Box 
            position="fixed"
            top={["2", "6"]}
            right={["2", "6"]}
            zIndex={50}
            bg="white"
            color="black"
            p={[2, 4]}
            borderRadius="lg"
            boxShadow="lg"
            maxW={["calc(100% - 1rem)", "auto"]}
            fontSize={["sm", "md"]}
          >
            <Text fontWeight="bold" mb={2}>Last Session Summary</Text>
            <Text>Records: {attendanceData.recordCount}</Text>
            <Text>Ended: {new Date(attendanceData.sessionEndTime).toLocaleString()}</Text>
            <Button
              mt={2}
              colorScheme="blue"
              size={["xs", "sm"]}
              onClick={() => {
                if (typeof window !== 'undefined' && user?.id && attendanceData.downloadUrl) {
                  const sessionId = attendanceData.downloadUrl.split('/').pop();
                  if (sessionId) {
                    const downloadUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/download-attendance?sessionId=${sessionId}&userId=${user.id}`;
                    window.location.href = downloadUrl;
                  }
                }
              }}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <Timer size={16} />
              Download Report
            </Button>
          </Box>
        )}
      </section>

      {/* Class Title Dialog - controlled by showClassTitleDialog state */}
      <Dialog open={showClassTitleDialog} onOpenChange={setShowClassTitleDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[520px] rounded-[24px] border border-[#E8E0ED] bg-white p-5 text-[#2D1A3A] shadow-[0_20px_55px_rgba(45,27,74,0.2)] sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-[#2D1A3A]">
              Start Taking Attendance
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#6B6172] sm:text-base">
              Enter a descriptive title for this class session
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="relative w-full">
                <Label htmlFor="classTitle" className="mb-2 block text-sm font-semibold text-[#3B3045]">
                  Class Title
                </Label>
                <div className="relative">
                  <Input
                    id="classTitle"
                    placeholder="e.g. CSC 401 Lecture 1"
                    value={classTitle}
                    onChange={(e) => setClassTitle(e.target.value)}
                    className="block w-full rounded-lg border border-[#DCCCE7] bg-[#F7F4F8] px-4 py-3 text-base text-[#2D1A3A] transition-colors duration-200 placeholder:text-[#9A8FA2] hover:border-[#B98BDC] focus:border-[#8437C8] focus:ring-2 focus:ring-[#E4D2F0]"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="h-6 w-6 text-[#B98BDC]"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs font-medium leading-5 text-[#6B6172] sm:text-sm">
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  This title will be visible to all students joining the session
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowClassTitleDialog(false);
                setClassTitle('');
              }}
              className="border-[#DCCCE7] text-[#6B6172] hover:bg-[#F7F4F8] hover:text-[#2D1A3A]"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!classTitle.trim()) {
                  toast({
                    title: "Error",
                    description: "Please enter a class title",
                    variant: "destructive"
                  });
                  return;
                }
                handleStartAttendance(classTitle.trim());
              }}
              disabled={!classTitle.trim()}
              className="bg-[#8437C8] text-white shadow-[0_6px_12px_rgba(132,55,200,0.2)] transition-all duration-200 hover:bg-[#6E27AE] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingRoom;
