'use client';
import { useState, useEffect, useRef } from 'react';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, LayoutList, CheckCircle2, Timer } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

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

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setShowParticipants] = useState(false);
  const [attendanceActive, setAttendanceActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const { useCallCallingState } = useCallStateHooks();
  const { user } = useUser();
  const call = useCall();
  const streamHostId = call?.state.createdBy?.id;
  const isHost = user?.id && streamHostId && user.id === streamHostId;
  // Log any changes to attendance state
  useEffect(() => {
    if (!call) return;

    const handleCallUpdated = () => {
      const active = !!call.state.custom?.attendanceActive;
      const sessionId = call.state.custom?.currentSessionId;
      console.log('[Attendance] Call state updated:', { active, sessionId, custom: call.state.custom });
      
      console.log("Call state updated:", { active, sessionId });
      setAttendanceActive(active);
      
      if (sessionId) {
        setCurrentSessionId(sessionId);
      }
    };

    // Set initial state
    handleCallUpdated();
    
    // Listen for real-time updates
    call.on('call.updated', handleCallUpdated);

    return () => {
      call.off('call.updated', handleCallUpdated);
    };
  }, [call]);
  const handleAttendanceToggle = async () => {
    if (!call || !user?.id) {
      console.log('[Attendance] Missing required data:', { hasCall: !!call, userId: user?.id });
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    console.log('[Attendance] Using backend URL:', backendUrl); // Added debug log
    const newState = !attendanceActive;
    let sessionId = currentSessionId;

    try {
      if (newState) {
        // Starting attendance
        // Generate new session ID
        sessionId = `session-${new Date().toISOString()
          .replace(/[-:]/g, '')
          .replace(/T/, '-')
          .split('.')[0]}-${Math.random().toString(36).substring(2, 7)}`;
        console.log('[Attendance] Starting new session:', sessionId);

        try {
          // First update call state
          console.log('[Attendance] Updating call state...'); // Added debug log
          await Promise.resolve(call.update({
            custom: {
              ...call.state.custom,
              attendanceActive: true,
              currentSessionId: sessionId
            }
          }));

          // Then create session in backend
          const requestUrl = `${backendUrl}/create-attendance-session`;
          console.log('[Attendance] Creating session with URL:', requestUrl); // Added debug log
          const createResponse = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId,
              hostId: user.id
            }),
          });

          if (!createResponse.ok) {
            // If backend fails, revert call state
            await Promise.resolve(call.update({
              custom: {
                ...call.state.custom,
                attendanceActive: false,
                currentSessionId: null
              }
            }));
            const errorData = await createResponse.json();
            throw new Error(errorData.detail || 'Failed to start attendance session');
          }

          setCurrentSessionId(sessionId);
          setAttendanceActive(true);
          console.log('[Attendance] Session started successfully');
        } catch (startError) {
          console.error('[Attendance] Error starting session:', startError);
          throw startError;
        }
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
          }          // Get the response data which includes download URL
          const endData = await endResponse.json();

          // Only update call state if backend succeeds
          await Promise.resolve(call.update({
            custom: {
              ...call.state.custom,
              attendanceActive: false,
              currentSessionId: null
            }
          }));

          setAttendanceActive(false);
          setCurrentSessionId('');
          console.log('[Attendance] Session ended successfully');
          
          // Trigger download of attendance report using the URL from response
          if (endData.downloadUrl) {
            const downloadUrl = `${backendUrl}${endData.downloadUrl}`;
            console.log('[Attendance] Opening download URL:', downloadUrl);
            window.open(downloadUrl, '_blank');
          }
        } catch (endError) {
          console.error('[Attendance] Error ending session:', endError);
          throw endError;
        }
      }
    } catch (error) {
      console.error('[Attendance] Error:', error);
      alert(error instanceof Error ? error.message : "Failed to manage attendance session");
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

  return (
    <section className="relative h-screen w-full overflow-hidden pt-4 text-white">
      {/* Attendance Panel at the top right - only for participants when active */}
      <div className="fixed top-6 right-6 z-50">
        {attendanceActive && !isHost && currentSessionId && (
          <AttendancePanel sessionId={currentSessionId} />
        )}
      </div>
      
      <div className="relative flex size-full items-center justify-center">
        <div className="flex size-full max-w-[1000px] items-center">
          <CallLayout />
        </div>
        <div
          className={cn('h-[calc(100vh-86px)] hidden ml-2', {
            'show-block': showParticipants,
          })}
        >
          <CallParticipantsList onClose={() => setShowParticipants(false)} />
        </div>
      </div>
      
      <div className="fixed bottom-0 flex w-full items-center justify-center gap-5">
        <CallControls onLeave={() => router.push(`/`)} />

        {isHost && (
          <button
            className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition-all duration-200 ${
              attendanceActive 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
            } shadow-lg`}
            onClick={handleAttendanceToggle}
          >
            {attendanceActive ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Stop Taking Attendance</span>
              </>
            ) : (
              <>
                <Timer className="w-5 h-5" />
                <span>Start Taking Attendance</span>
              </>
            )}
          </button>
        )}

        {/* Layout dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
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
          <div className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
            <Users size={20} className="text-white" />
          </div>
        </button>
        
        {!isPersonalRoom && isHost && (
          <EndCallButton  />
        )}
      </div>
    </section>
  );
};

export default MeetingRoom;
