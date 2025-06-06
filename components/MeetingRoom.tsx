'use client';
import { useState, useEffect } from 'react';
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
import { Users, LayoutList, CheckCircle2, Timer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Loader from './Loader';
import EndCallButton from './EndCallButton';
import { cn } from '@/lib/utils';
import AttendancePanel from './AttendancePanel';

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';

interface MeetingRoomProps {
  onSessionEnd?: (data: AttendanceData) => void;
}

const MeetingRoom = ({ onSessionEnd }: MeetingRoomProps) => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams?.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setShowParticipants] = useState(false);
  const [attendanceActive, setAttendanceActive] = useState(false);  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const { useCallCallingState } = useCallStateHooks();
  const { user } = useUser();
  const call = useCall();
  const streamHostId = call?.state.createdBy?.id;
  const isHost = user?.id && streamHostId && user.id === streamHostId;

  // Log any changes to attendance state
  useEffect(() => {
    if (!call) return;

    const handleCallUpdated = async () => {
      const active = !!call.state.custom?.attendanceActive;
      const sessionId = call.state.custom?.currentSessionId;
      console.log('[Attendance] Call state updated:', { 
        active, 
        sessionId, 
        custom: call.state.custom,
        timestamp: new Date().toISOString()
      });
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      if (sessionId) {
        try {
          const response = await fetch(`${backendUrl}/get-session-status?sessionId=${sessionId}`);
          const data = await response.json();
          
          if (response.ok) {
            setCurrentSessionId(sessionId);
            setAttendanceActive(!!data.isActive);
            
            console.log('[Attendance] State synced with backend:', {
              sessionId,
              isActive: data.isActive,
              backendStatus: data.status,
              timestamp: new Date().toISOString()
            });
          } else {
            console.error('[Attendance] Failed to verify session status:', data);
            // If backend reports session as inactive/non-existent, sync the Stream call state
            if (data.status === 'inactive' || response.status === 404) {
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
                console.error('[Attendance] Failed to sync call state:', error);
              }
            }
          }
        } catch (error) {
          console.error('[Attendance] Error verifying session status:', error);
          // On network errors, maintain current state but log warning
          toast({
                title: "Warning",
                description: "Having trouble syncing attendance status. Please check your connection.",
                variant: "destructive",
                duration: 5000
              });
        }
      } else {
        // No active session in Stream state
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

      void cleanup();
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

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    console.log('[Attendance] Using backend URL:', backendUrl);
    const newState = !attendanceActive;
    console.log('[Attendance] Toggling attendance state:', { 
      current: attendanceActive, 
      new: newState,
      timestamp: new Date().toISOString() 
    });

    try {
      if (newState) {
        // Starting attendance
        const sessionId = `session-${new Date().toISOString()
          .replace(/[-:]/g, '')
          .replace(/T/, '-')
          .split('.')[0]}-${Math.random().toString(36).substring(2, 7)}`;
        
        console.log('[Attendance] Starting new session:', { 
          sessionId, 
          timestamp: new Date().toISOString() 
        });

        // First create session in backend
        console.log('[Attendance] Creating session on backend:', { 
          sessionId, 
          hostId: user.id,
          timestamp: new Date().toISOString()
        });

        const createResponse = await fetch(`${backendUrl}/create-attendance-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            hostId: user.id
          }),
        });

        const responseData = await createResponse.json();
        console.log('[Attendance] Backend response:', { 
          status: createResponse.status, 
          data: responseData,
          timestamp: new Date().toISOString()
        });

        if (!createResponse.ok) {
          throw new Error(responseData.detail || 'Failed to start attendance session');
        }

        // Update call state only if backend succeeds
        console.log('[Attendance] Updating Stream call state');
        await call.update({
          custom: {
            ...call.state.custom,
            attendanceActive: true,
            currentSessionId: sessionId
          }
        });

        // After stream is updated, verify the update succeeded
        const updatedCallState = call.state.custom;
        if (!updatedCallState?.attendanceActive || updatedCallState?.currentSessionId !== sessionId) {
          throw new Error('Failed to update call state');
        }

        toast({
          title: "Attendance Started",
          description: "Students can now mark their attendance.",
          variant: "default"
        });

        console.log('[Attendance] Session started successfully, state updated:', { 
          sessionId, 
          callState: call.state.custom,
          timestamp: new Date().toISOString()
        });
      } else if (currentSessionId) {
        // Ending attendance
        console.log('[Attendance] Ending session:', currentSessionId);

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

          // Get the response data which includes download URL
          const endData = await endResponse.json();

          // Only update call state if backend succeeds
          await call.update({
            custom: {
              ...call.state.custom,
              attendanceActive: false,
              currentSessionId: null
            }
          });

          setAttendanceActive(false);
          setCurrentSessionId('');
          
          // Show success toast with download option
          if (endData.recordCount) {
            handleSessionEnd(endData);
          }

          console.log('[Attendance] Session ended successfully');
        } catch (endError) {
          console.error('[Attendance] Error ending session:', endError);
          toast({
            title: "Error",
            description: "Failed to end attendance session. Please try again.",
            variant: "destructive"
          });
          throw endError;
        }
      }
    } catch (error) {
      console.error('[Attendance] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to manage attendance session",
        variant: "destructive"
      });
    }
  };

  const callingState = useCallCallingState();
  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout = () => {
    switch (layout) {
      case 'grid':
        return <PaginatedGridLayout />;
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
    <div className="relative">
      <section className="relative min-h-screen w-full overflow-hidden pt-4 text-white">
        {/* Attendance Panel - responsive positioning */}
        <div className="fixed top-2 sm:top-6 right-2 sm:right-6 z-50">
          {!isHost && currentSessionId && (
            <AttendancePanel 
              sessionId={currentSessionId} 
              isActive={attendanceActive}
            />
          )}
        </div>

        <div className="relative flex size-full items-center justify-center px-2 sm:px-4">
          <div className="flex size-full max-w-[1000px] items-center">
            <CallLayout />
          </div>
          
          {/* Participants List - responsive width */}
          <div
            className={cn('h-[calc(100vh-86px)] hidden ml-2 w-full max-w-[300px] sm:max-w-[350px]', {
              'show-block': showParticipants,
            })}
          >
            <CallParticipantsList onClose={() => setShowParticipants(false)} />
          </div>
        </div>
        
        {/* Controls - responsive positioning and layout */}
        <div className="fixed bottom-0 flex w-full flex-wrap items-center justify-center gap-2 sm:gap-5 p-2 sm:p-4 bg-black/50">
          <CallControls onLeave={() => router.push(`/`)} />

          {isHost && (
            <button
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 ${
                attendanceActive 
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
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

          {/* Layout dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer rounded-2xl bg-[#19232d] px-3 sm:px-4 py-2 hover:bg-[#4c535b]">
              <LayoutList size={20} className="text-white" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="border-dark-1 bg-dark-1 text-white">
              {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
                <div key={index}>
                  <DropdownMenuItem
                    onClick={() =>
                      setLayout(item.toLowerCase() as CallLayoutType)
                    }
                  >
                    {item}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="border-dark-1" />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <CallStatsButton />
          
          <button onClick={() => setShowParticipants((prev) => !prev)}>
            <div className="cursor-pointer rounded-2xl bg-[#19232d] px-3 sm:px-4 py-2 hover:bg-[#4c535b]">
              <Users size={20} className="text-white" />
            </div>
          </button>
          
          {!isPersonalRoom && isHost && (
            <EndCallButton />
          )}
        </div>

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
    </div>
  );
};

export default MeetingRoom;

