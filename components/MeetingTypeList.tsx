/* eslint-disable camelcase */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import HomeCard from './HomeCard';
import MeetingModal from './MeetingModal';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';
import Loader from './Loader';
import { Textarea } from './ui/textarea';
import ReactDatePicker from 'react-datepicker';
import { useToast } from './ui/use-toast';
import { Input } from './ui/input';

const initialValues = {
  dateTime: new Date(),
  description: '',
  link: '',
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const MeetingTypeList = () => {
  const router = useRouter();
  const [meetingState, setMeetingState] = useState<
    'isScheduleMeeting' | 'isJoiningMeeting' | 'isInstantMeeting' | undefined
  >(undefined);
  const [values, setValues] = useState(initialValues);
  const [callDetail, setCallDetail] = useState<Call>();
  const [userRole, setUserRole] = useState<string | null>(null);
  const client = useStreamVideoClient();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user role');
        }
        const userData = await response.json();
        if (!userData.role) {
          throw new Error('No role found for user');
        }
        setUserRole(userData.role);
      } catch (error) {
        console.error('Error checking user role:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user role. Please try refreshing the page.',
          variant: 'destructive'
        });
      }
    };

    checkUserRole();
  }, [user?.id, toast]); // Added toast to dependency array

  const createMeeting = async () => {
    if (!client || !user) return;
    try {
      if (!values.dateTime) {
        toast({ title: 'Please select a date and time' });
        return;
      }
      const id = crypto.randomUUID();
      const call = client.call('default', id);
      if (!call) throw new Error('Failed to create class/meeting');
      const startsAt =
        values.dateTime.toISOString() || new Date(Date.now()).toISOString();
      const description = values.description || 'Instant Meeting';
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          custom: {
            description,
          },
        },
      });
      setCallDetail(call);
      if (!values.description) {
        router.push(`/meeting/${call.id}`);
      }
      toast({
        title: 'Class Created',
      });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to create a class/meeting' });
    }
  };

  if (!client || !user) return <Loader />;

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${callDetail?.id}`;

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {userRole === 'lecturer' && (
        <>
          <HomeCard
            img="/icons/add-meeting.svg"
            title="New Class"
            description="Start an instant class"
            handleClick={() => setMeetingState('isInstantMeeting')}
          />
          <HomeCard
            img="/icons/schedule.svg"
            title="Schedule Class"
            description="Plan your class"
            className="bg-purple-1"
            handleClick={() => setMeetingState('isScheduleMeeting')}
          />
          <HomeCard
            img="/icons/location.svg"
            title="Mark Physical Attendance"
            description="Record attendance for physical classes"
            className="bg-gradient-to-br from-teal-500 to-emerald-700 hover:from-teal-600 hover:to-emerald-800 transition-colors"
            handleClick={() => router.push('/physical-attendance')}
          />
        </>
      )}
      {userRole === 'student' && (
        <>
          <HomeCard
            img="/icons/join-meeting.svg"
            title="Join Class"
            description="via invitation link"
            className="bg-blue-1"
            handleClick={() => setMeetingState('isJoiningMeeting')}
          />
          <HomeCard
            img="/icons/student.svg"
            title="Update Profile"
            description="Edit your details"
            className="bg-purple-1"
            handleClick={() => router.push('/student-registration')}
          />
          <HomeCard
            img="/icons/check-in.svg"
            title="Check In"
            description="Mark your physical presence"
            className="bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-colors"
            handleClick={() => router.push('/physical-attendance')}
          />  
        </>
      )}
      <HomeCard
        img="/icons/recordings.svg"
        title="View Recordings"
        description="Class Recordings"
        className="bg-yellow-1"
        handleClick={() => router.push('/recordings')}
      />

      {!callDetail ? (
        <MeetingModal
          isOpen={meetingState === 'isScheduleMeeting'}
          onClose={() => setMeetingState(undefined)}
          title="Schedule a Class"
          handleClick={createMeeting}
        >
          <div className="flex flex-col gap-2.5">
            <label className="text-base font-normal leading-[22.4px] text-sky-2">
              Add a description or note
            </label>
            <Textarea
              className="border-none bg-dark-3 focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(e) =>
                setValues({ ...values, description: e.target.value })
              }
            />
          </div>
          <div className="flex w-full flex-col gap-2.5">
            <label className="text-base font-normal leading-[22.4px] text-sky-2">
              Select Date and Time
            </label>
            <ReactDatePicker
              selected={values.dateTime}
              onChange={(date) => setValues({ ...values, dateTime: date! })}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="time"
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full rounded bg-dark-3 p-2 focus:outline-none"
            />
          </div>
        </MeetingModal>
      ) : (
        <MeetingModal
          isOpen={meetingState === 'isScheduleMeeting'}
          onClose={() => setMeetingState(undefined)}
          title="Class Created"
          handleClick={() => {
            navigator.clipboard.writeText(meetingLink);
            toast({ title: 'Link Copied' });
          }}
          image={'/icons/checked.svg'}
          buttonIcon="/icons/copy.svg"
          className="text-center"
          buttonText="Copy Class Link"
        />
      )}

      <MeetingModal
        isOpen={meetingState === 'isJoiningMeeting'}
        onClose={() => setMeetingState(undefined)}
        title="Enter Meeting Link"
        className="text-center"
        buttonText="Join Class"
        handleClick={() => router.push(values.link)}
      >
        <Input
          placeholder="Enter Meeting link"
          onChange={(e) => setValues({ ...values, link: e.target.value })}
          className="border-none bg-dark-3 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </MeetingModal>

      <MeetingModal
        isOpen={meetingState === 'isInstantMeeting'}
        onClose={() => setMeetingState(undefined)}
        title="Start an Instant Class"
        className="text-center"
        buttonText="Start Class"
        handleClick={createMeeting}
      />
    </section>
  );
};

export default MeetingTypeList;
