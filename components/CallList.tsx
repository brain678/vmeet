'use client';

import { Call, CallRecording } from '@stream-io/video-react-sdk';

import Loader from './Loader';
import { useGetCalls } from '@/hooks/useGetCalls';
import MeetingCard from './MeetingCard';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CallList = ({ type }: { type: 'ended' | 'upcoming' | 'recordings' }) => {
  const router = useRouter();
  const { endedCalls, upcomingCalls, callRecordings, isLoading } =
    useGetCalls();
  const [recordings, setRecordings] = useState<CallRecording[]>([]);

  const getCalls = () => {
    switch (type) {
      case 'ended':
        return endedCalls;
      case 'recordings':
        return recordings;
      case 'upcoming':
        return upcomingCalls;
      default:
        return [];
    }
  };

  const getNoCallsMessage = () => {
    switch (type) {
      case 'ended':
        return 'No Previous Calls';
      case 'upcoming':
        return 'No Upcoming Calls';
      case 'recordings':
        return 'No Recordings';
      default:
        return '';
    }
  };

  useEffect(() => {
    const fetchRecordings = async () => {
      const callData = await Promise.all(
        callRecordings?.map((meeting) => meeting.queryRecordings()) ?? [],
      );

      const recordings = callData
        .filter((call) => call.recordings.length > 0)
        .flatMap((call) => call.recordings);

      setRecordings(recordings);
    };

    if (type === 'recordings') {
      fetchRecordings();
    }
  }, [type, callRecordings]);

  if (isLoading) return <Loader />;

  const calls = getCalls();
  const noCallsMessage = getNoCallsMessage();

  return (
    <div className="w-full">
      {calls && calls.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {calls.map((meeting: Call | CallRecording) => {
            // For Call type (upcoming/ended):
            const isCall = (meeting as Call).state !== undefined;
            const custom = isCall ? (meeting as Call).state?.custom || {} : {};
            const title = custom.title || 'Untitled Meeting';
            const description = custom.description || '';
            // Fix: Stream stores startsAt as a custom field if set via 'custom', fallback if needed
            let date = '';
            if (isCall) {
              const state = (meeting as Call).state;
              // Prefer state.startsAt, fallback to state.custom.startsAt
              const startsAt = state?.startsAt || state?.custom?.startsAt;
              if (startsAt) {
                date = new Date(startsAt).toLocaleString();
              }
            } else if ((meeting as CallRecording).start_time) {
              date = new Date((meeting as CallRecording).start_time).toLocaleString();
            }
            return (
              <MeetingCard
                key={(meeting as Call).id}
                icon={
                  type === 'ended'
                    ? '/icons/previous.svg'
                    : type === 'upcoming'
                      ? '/icons/upcoming.svg'
                      : '/icons/recordings.svg'
                }
                title={title}
                date={date || ''}
                isPreviousMeeting={type === 'ended'}
                link={
                  type === 'recordings'
                    ? (meeting as CallRecording).url
                    : `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${(meeting as Call).id}`
                }
                buttonIcon1={type === 'recordings' ? '/icons/play.svg' : undefined}
                buttonText={type === 'recordings' ? 'Play' : 'Start'}
                handleClick={
                  type === 'recordings'
                    ? () => router.push(`${(meeting as CallRecording).url}`)
                    : () => router.push(`/meeting/${(meeting as Call).id}`)
                }
                description={description}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-[24px] border border-[#E6D8F4] bg-white px-6 py-8 text-center shadow-[0_5px_15px_rgba(71,38,96,0.08)] sm:px-8">
          <h1 className="text-xl font-semibold text-[#2D1A3A] sm:text-2xl">{noCallsMessage}</h1>
          <p className="mt-2 text-sm text-[#6B6171]">New sessions will appear here when they are scheduled.</p>
        </div>
      )}
    </div>
  );
};

export default CallList;
