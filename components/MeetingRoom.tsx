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
  const { useCallCallingState } = useCallStateHooks();
  const { user } = useUser();
  const call = useCall();
  const streamHostId = call?.state.createdBy?.id;
  const isHost = user?.id && streamHostId && user.id === streamHostId;

  // Generate a unique sessionId when the component mounts and store in state
  const [sessionId] = useState(() => {
    const now = new Date();
    const id = `session-${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours()
      .toString()
      .padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds()
      .toString()
      .padStart(2, '0')}`;
    console.log("Generated new session ID:", id);
    return id;
  });

  // Attendance activation sync
  useEffect(() => {
    if (!call) return;

    const handleCallUpdated = () => {
      setAttendanceActive(!!call.state.custom?.attendanceActive);
    };

    // Set initial state
    setAttendanceActive(!!call.state.custom?.attendanceActive);
    // Listen for real-time updates
    call.on('call.updated', handleCallUpdated);

    return () => {
      call.off('call.updated', handleCallUpdated);
    };
  }, [call]);

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

  const handleAttendanceToggle = async () => {
    if (call) {
      try {
        const newState = !attendanceActive;
        console.log("Session ID for attendance:", sessionId);
        
        // Store session ID in call state when starting attendance
        if (newState) {
          console.log("Starting new attendance session:", sessionId);
        } else {
          console.log("Ending attendance session:", sessionId);
        }
        
        await call.update({
          custom: {
            attendanceActive: newState,
            currentSessionId: sessionId
          },
        });
        setAttendanceActive(newState);

        // If we're stopping attendance, try to download the report
        if (!newState) { // When turning attendance off
          try {
            // Check if there are any records
            console.log("Checking attendance records for session:", sessionId);
            const response = await fetch(`http://localhost:8000/download-attendance/${sessionId}`);
            
            const data = await response.json();
            if (response.ok) {
              if (data.records && data.records.length > 0) {
                console.log("Found attendance records, initiating download");
                window.open(`http://localhost:8000/download-attendance/${sessionId}`, '_blank');
              } else {
                console.log("No attendance records yet");
              }
            } else {
              console.error("Error downloading attendance:", data.detail || "Unknown error");
            }
          } catch (error) {
            console.error('Error downloading attendance:', error);
            alert("Failed to download attendance records. Please try again.");
          }
        }
      } catch (error) {
        console.error('Error updating attendance state:', error);
        alert("Failed to update attendance state. Please try again.");
      }
    }
  };

  return (
    <section className="relative h-screen w-full overflow-hidden pt-4 text-white">
      {/* Attendance Panel at the top right - only for participants when active */}
      <div className="fixed top-6 right-6 z-50">
        {attendanceActive && !isHost && <AttendancePanel sessionId={sessionId} />}
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
