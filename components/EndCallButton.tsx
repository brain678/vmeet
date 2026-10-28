'use client';

import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { AttendanceData } from '@/types/attendance';

const EndCallButton = () => {
  const call = useCall();
  const router = useRouter();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  if (!call)
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );

  const { useLocalParticipant } = useCallStateHooks();
  const participant = useLocalParticipant();

  const isMeetingOwner =
    participant &&
    call.state.createdBy &&
    participant.userId === call.state.createdBy.id;

  if (!isMeetingOwner) return null;

  const endCall = async () => {
    try {
      const isAttendanceActive = !!call.state.custom?.attendanceActive;
      const currentSessionId = call.state.custom?.currentSessionId;

      if (isAttendanceActive && currentSessionId) {
        console.log('[EndCall] Stopping active attendance session:', currentSessionId);

        // Stop the attendance session first
        const endResponse = await fetch(
          `${backendUrl}/end-attendance-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId }),
          },
        );

        if (!endResponse.ok) {
          const errorData = await endResponse.json();
          console.error('[EndCall] Failed to end attendance session:', errorData);
          toast({
            title: "Warning",
            description: "Failed to save attendance data before ending call.",
            variant: "destructive"
          });
        } else {
          const endData = await endResponse.json() as AttendanceData;
          
          // Show attendance summary
          if (endData.recordCount) {
            toast({
              title: "Attendance Session Ended",
              description: `${endData.recordCount} records saved.`,
              variant: "default",
              action: endData.downloadUrl ? (
                <ToastAction 
                  altText="Download attendance report" 
                  onClick={() => {
                    window.open(`${backendUrl}${endData.downloadUrl}`, "_blank");
                  }}
                >
                  Download Report
                </ToastAction>
              ) : undefined
            });
          }
        }

        // Wait for the call state update to complete
        await call.update({
          custom: {
            ...call.state.custom,
            attendanceActive: false,
            currentSessionId: null,
          },
        });
        
        // Give time for the toast to be visible
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Now end the call
      await call.endCall();
      toast({
        title: "Call Ended",
        description: "The call has been ended for all participants.",
        variant: "default"
      });
      
      // Wait a moment for the toast to be visible
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/');
    } catch (error) {
      console.error('[EndCall] Error:', error);
      // Show error but still try to end the call
      toast({
        title: "Error",
        description: "There was an error ending the call, but we'll try to close it.",
        variant: "destructive"
      });
      try {
        await call.endCall();
      } finally {
        router.push('/');
      }
    }
  };

  return (
    <Button onClick={endCall} className="bg-red-500">
      End call for everyone
    </Button>
  );
};

export default EndCallButton;
