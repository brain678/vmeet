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
import { BACKEND_URL } from '@/constants/config';

interface UserData {
  role: string;
  isRegistered: boolean;
  roleData?: {
    activeSessions?: number;
    totalSessions?: number;
    attendanceCount?: number;
    registrationComplete?: boolean;
  };
}

const initialValues = {
  dateTime: new Date(),
  description: '',
  link: '',
};

const MeetingTypeList = () => {
  const router = useRouter();
  const [meetingState, setMeetingState] = useState<
    'isScheduleMeeting' | 'isJoiningMeeting' | 'isInstantMeeting' | undefined
  >(undefined);
  const [values, setValues] = useState(initialValues);
  const [callDetail, setCallDetail] = useState<Call>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const client = useStreamVideoClient();
  const { user } = useUser();
  const { toast } = useToast();

  // Fetch user data and role when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        setError(null);
        setLoading(true);
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to load user data');
        }
        
        const data = await response.json();
        setUserData(data);

        // Show registration reminder for students
        if (data.role === 'student' && !data.roleData?.registrationComplete) {
          toast({
            title: "Registration Required",
            description: "Please complete your registration to access all features",
            variant: "destructive",
            duration: 5000
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load user data');
        toast({
          title: "Error",
          description: "Failed to load user data. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user?.id, toast]);

  const createMeeting = async () => {
    if (!client || !user) {
      toast({
        title: "Error",
        description: "Unable to create meeting. Please try again.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (!values.dateTime) {
        toast({ 
          title: "Missing Information",
          description: "Please select a date and time for the meeting",
          variant: "destructive"
        });
        return;
      }

      const id = crypto.randomUUID();
      const call = client.call('default', id);
      await call.getOrCreate();
      setCallDetail(call);
      setMeetingState(undefined);
      router.push(`/meeting/${id}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Loading state with skeleton UI
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-orange-1 px-4 py-6 h-[260px] rounded-[14px] animate-pulse">
            <div className="flex-center glassmorphism size-12 rounded-[10px] bg-gray-600/50" />
            <div className="mt-auto space-y-3">
              <div className="h-8 bg-gray-600/50 rounded w-2/3" />
              <div className="h-6 bg-gray-600/50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Common layout wrapper for both views */}
      <div className="w-full">
        {/* Error state */}
        {error && (
          <div className="w-full flex justify-center p-4">
            <div className="w-full max-w-lg text-center p-8 bg-[#1B2B44] rounded-xl">
              <div className="text-red-500 mb-4">⚠️ {error}</div>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Role selection prompt */}
        {!userData?.role && !error && (
          <div className="w-full flex justify-center p-4">
            <div className="w-full max-w-lg text-center p-8 bg-[#1B2B44] rounded-xl">
              <h3 className="text-2xl text-white mb-4">Welcome to VMeet</h3>
              <p className="text-gray-400 mb-6">To get started, please select whether you're a student or lecturer.</p>
              <button
                onClick={() => router.push('/role-selection')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Select Role
              </button>
            </div>
          </div>
        )}

        {/* Student registration prompt */}
        {userData?.role === 'student' && !userData.roleData?.registrationComplete && !error && (
          <div className="w-full flex justify-center p-4">
            <div className="w-full max-w-lg text-center p-8 bg-[#1B2B44] rounded-xl">
              <h3 className="text-2xl text-white mb-4">Complete Your Registration</h3>
              <p className="text-gray-400 mb-6">Please complete your registration to access all VMeet features.</p>
              <button
                onClick={() => router.push('/student-registration')}
                className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors text-lg"
              >
                Complete Registration
              </button>
            </div>
          </div>
        )}

        {/* Lecturer View */}
        {userData?.role === 'lecturer' && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <HomeCard
              img="/icons/add-meeting.svg"
              title="New Class"
              description="Start an instant class"
              className="bg-blue-1"
              handleClick={() => setMeetingState('isInstantMeeting')}
            />
            <HomeCard
              img="/icons/schedule.svg"
              title="Schedule Class"
              description="Schedule a future class"
              className="bg-orange-1"
              handleClick={() => setMeetingState('isScheduleMeeting')}
            />
            <HomeCard
              img="/icons/attendance.svg"
              title="Physical Attendance"
              description="Track physical class attendance"
              className="bg-emerald-600/20"
              handleClick={() => router.push('/physical-attendance')}
            />
            <HomeCard
              img="/icons/recordings.svg"
              title="View Records"
              description="Class recordings & attendance"
              className="bg-yellow-1"
              handleClick={() => router.push('/records')}
            />
          </div>
        )}

        {/* Student View */}
        {userData?.role === 'student' && userData.roleData?.registrationComplete && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <HomeCard
              img="/icons/join-meeting.svg"
              title="Join Class"
              description="via invitation link"
              className="bg-blue-1"
              handleClick={() => setMeetingState('isJoiningMeeting')}
            />
            <HomeCard
              img="/icons/attendance.svg"
              title="Mark Attendance"
              description={`${userData.roleData?.attendanceCount || 0} classes attended`}
              className="bg-emerald-600/20"
              handleClick={() => router.push('/physical-attendance')}
            />
            <HomeCard
              img="/icons/profile.svg"
              title="Update Profile"
              description="Manage your profile"
              className="bg-indigo-600/20"
              handleClick={() => router.push('/profile')}
            />
            <HomeCard
              img="/icons/recordings.svg"
              title="View Records"
              description="Your attendance history"
              className="bg-yellow-1"
              handleClick={() => router.push('/records')}
            />
          </div>
        )}

        {/* Meeting Modals */}
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
                placeholder="Enter class description or any important notes"
                value={values.description}
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
                onChange={(date: Date) =>
                  setValues({ ...values, dateTime: date })
                }
                showTimeSelect
                timeFormat="HH:mm"
                dateFormat="MMMM d, yyyy h:mm aa"
                className="w-full rounded-lg bg-dark-3 p-2 text-white outline-none"
                minDate={new Date()}
                placeholderText="Select date and time"
              />
            </div>
          </MeetingModal>
        ) : null}

        <MeetingModal
          isOpen={meetingState === 'isJoiningMeeting'}
          onClose={() => {
            setMeetingState(undefined);
            setValues({ ...values, link: '' });
          }}
          title="Join a Class"
          buttonText="Join"
          handleClick={async () => {
            if (!values.link) {
              toast({
                title: "Missing Information",
                description: "Please enter a valid meeting link or code",
                variant: "destructive"
              });
              return;
            }

            try {
              // Clean the link - remove any full URLs and just get the meeting ID
              const meetingId = values.link.split('/').pop() || values.link;
              
              // Try to get or create the call
              const call = client!.call('default', meetingId);
              await call.getOrCreate();
              setCallDetail(call);
              setMeetingState(undefined);
              router.push(`/meeting/${meetingId}`);
            } catch (error) {
              console.error('Error joining meeting:', error);
              toast({
                title: "Error",
                description: "Unable to join the class. Please check the link and try again.",
                variant: "destructive"
              });
            }
          }}
        >
          <div className="flex w-full flex-col gap-2.5">
            <label className="text-base font-normal leading-[22.4px] text-sky-2">
              Enter class link or code
            </label>
            <Input
              type="text"
              placeholder="Enter meeting link or code"
              value={values.link}
              onChange={(e) => setValues({ ...values, link: e.target.value })}
              className="border-none bg-dark-3 text-white focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </MeetingModal>

        {/* Instant Meeting Modal */}
        <MeetingModal
          isOpen={meetingState === 'isInstantMeeting'}
          onClose={() => setMeetingState(undefined)}
          title="Start an Instant Class"
          buttonText="Start Now"
          handleClick={async () => {
            try {
              const id = crypto.randomUUID();
              const call = client!.call('default', id);
              await call.getOrCreate();
              setCallDetail(call);
              setMeetingState(undefined);
              router.push(`/meeting/${id}`);
            } catch (error) {
              console.error('Error creating instant meeting:', error);
              toast({
                title: "Error",
                description: "Failed to start class. Please try again.",
                variant: "destructive"
              });
            }
          }}
        >
          <div className="text-center text-gray-400 p-4">
            Click &apos;Start Now&apos; to start an instant class. Students can join using the class link.
          </div>
        </MeetingModal>
      </div>
    </>
  );
};

export default MeetingTypeList;
