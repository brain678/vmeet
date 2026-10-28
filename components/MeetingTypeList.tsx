/* eslint-disable camelcase */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomeCard from './HomeCard';
import MeetingModal from './MeetingModal';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';
import { Textarea } from './ui/textarea';
import ReactDatePicker from 'react-datepicker';
import { useToast } from './ui/use-toast';
import { Input } from './ui/input';
import { BACKEND_URL } from '@/constants/config';
import { v4 as uuidv4 } from 'uuid';
import { Building2, CalendarDays, CheckCircle2, Link2, Plus, UserRound, Video } from 'lucide-react';

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

interface ActivityRecord {
  timestamp?: string;
  startTime?: string;
}

const DashboardOverview = ({ userData, records, onView, onActiveSession }: { userData: UserData; records: ActivityRecord[]; onView: () => void; onActiveSession: () => void }) => {
  const isLecturer = userData.role === 'lecturer';
  const attendance = userData.roleData?.attendanceCount || 0;
  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const activityDate = date.getTime();
    const nextDay = activityDate + 24 * 60 * 60 * 1000;

    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: records.filter((record) => {
        const recordDate = new Date(record.timestamp || record.startTime || '').getTime();
        return recordDate >= activityDate && recordDate < nextDay;
      }).length,
    };
  });
  const maxActivity = Math.max(...activityDays.map((day) => day.count), 1);
  const reviewableClasses = records.length;

  return (
    <div className="mt-9" data-tour-id={isLecturer ? 'teaching-overview' : 'attendance-overview'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#3B3045]">Your {isLecturer ? 'Teaching' : 'Attendance'} Overview</h2>
        <button className="text-xs font-semibold text-[#8437C8] transition-colors hover:text-[#6E27AE]" onClick={onView}>View full overview <span aria-hidden="true">-&gt;</span></button>
      </div>
      <div className="mt-4 grid items-stretch gap-4 md:grid-cols-[1fr_1.4fr_0.9fr]">
        <div className="flex min-h-[136px] items-center gap-4 rounded-2xl bg-white px-5 py-5 shadow-[0_5px_10px_rgba(71,38,96,0.12)]">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-[3px] border-[#8437C8] text-base font-bold text-[#2D1A3A]">{isLecturer ? userData.roleData?.activeSessions || 0 : attendance}</div>
          <div className="min-w-0"><p className="text-sm font-semibold text-[#2D1A3A]">{isLecturer ? 'Active sessions' : 'Overall attendance'}</p><p className="mt-1 text-xs leading-4 text-[#6B6172]">{isLecturer ? 'Classes running now' : 'Keep building your streak'}</p>{isLecturer && <button type="button" onClick={onActiveSession} disabled={!userData.roleData?.activeSessions} className="mt-3 rounded-md bg-[#8437C8] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#6E27AE] disabled:cursor-not-allowed disabled:opacity-40">Open active session -&gt;</button>}</div>
        </div>
        <div className="min-h-[136px] rounded-2xl bg-white px-5 py-4 shadow-[0_5px_10px_rgba(71,38,96,0.12)]"><p className="text-xs font-semibold text-[#2D1A3A]">{isLecturer ? 'Class activity this week' : 'Attendance this week'}</p><div className="mt-4 flex h-[80px] items-end justify-around gap-2">{activityDays.map((day, index) => <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className={`w-5 rounded-t ${index === 3 ? 'bg-[#F05A75]' : 'bg-[#7138C6]'}`} style={{ height: `${Math.max((day.count / maxActivity) * 100, day.count ? 12 : 3)}%` }} /><span className="text-[9px] font-medium text-[#8A7D91]">{day.label}</span></div>)}</div></div>
        <div className="min-h-[136px] rounded-2xl bg-[#B98BDC] p-5 text-[#5D2A86]"><p className="text-sm font-semibold">{isLecturer ? 'Class insight' : 'Stay on track'}</p><p className="mt-3 text-xs leading-4">{isLecturer ? reviewableClasses > 0 ? `${reviewableClasses} ${reviewableClasses === 1 ? 'class is' : 'classes are'} ready for review.` : 'No class activity is available yet.' : 'Regular attendance helps you learn better and achieve more.'}</p></div>
      </div>
    </div>
  );
};

const initialValues = {
  title: '',
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
  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
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

  useEffect(() => {
    const fetchActivityRecords = async () => {
      if (!user?.id) {
        setActivityRecords([]);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/get-attendance-records?userId=${user.id}`);
        if (!response.ok) {
          setActivityRecords([]);
          return;
        }

        const data = await response.json();
        setActivityRecords(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching dashboard activity:', error);
        setActivityRecords([]);
      }
    };

    fetchActivityRecords();
  }, [user?.id]);

  const createMeeting = async () => {
    if (!client || !user) {
      toast({
        title: "Error",
        description: "Unable to create meeting. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Validation
    if (!values.title || !values.description || !values.dateTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields (title, description, date & time)",
        variant: "destructive"
      });
      return;
    }
    if (new Date(values.dateTime) <= new Date()) {
      toast({
        title: "Invalid Date",
        description: "Please select a future date and time for the meeting.",
        variant: "destructive"
      });
      return;
    }

    try {
      const id = uuidv4();
      const call = client.call('default', id);
      // Use 'starts_at' (snake_case) for Stream API compatibility
      await call.getOrCreate({
        data: {
          starts_at: values.dateTime.toISOString(),
          custom: {
            title: values.title,
            description: values.description,
          },
        },
      });
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
              <p className="text-gray-400 mb-6">To get started, please select whether you&apos;re a student or lecturer.</p>
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
          <>
            <div className="mb-4 flex items-center justify-between" data-tour-id="quick-actions">
              <h2 className="text-lg font-semibold text-[#3B3045]">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div data-tour-id="new-class-card">
                <HomeCard
                  icon={<Plus className="h-6 w-6 text-[#8437C8]" strokeWidth={2} />}
                  title="New Class"
                  description="Start an instant class"
                  actionLabel="Start Now"
                  actionClassName="bg-white text-[#6E27AE]"
                  descriptionClassName="text-white/90"
                  className="bg-[#8437C8] text-white"
                  handleClick={() => setMeetingState('isInstantMeeting')}
                />
              </div>
              <div data-tour-id="schedule-class-card">
                <HomeCard
                  icon={<CalendarDays className="h-6 w-6 text-[#0E9F4D]" strokeWidth={1.8} />}
                  title="Schedule Class"
                  description="Schedule a future class"
                  actionLabel="Schedule Now"
                  actionClassName="bg-[#0E9F4D] text-white"
                  className="bg-[#92D0AA]"
                  handleClick={() => setMeetingState('isScheduleMeeting')}
                />
              </div>
              <div data-tour-id="physical-attendance-card">
                <HomeCard
                  icon={<CheckCircle2 className="h-6 w-6 text-[#2E63C7]" strokeWidth={1.8} />}
                  title="Physical Attendance"
                  description="Track physical class attendance"
                  actionLabel="Take Attendance"
                  actionClassName="bg-[#2E63C7] text-white"
                  className="bg-[#A6B8E5]"
                  handleClick={() => router.push('/physical-attendance')}
                />
              </div>
              <div data-tour-id="profile-card">
                <HomeCard
                  icon={<UserRound className="h-6 w-6 text-[#E5A900]" strokeWidth={1.8} />}
                  title="Lecturer Profile"
                  description="Manage your lecturer profile"
                  actionLabel="View Profile"
                  actionClassName="bg-[#E5A900] text-white"
                  className="bg-[#F2D59B]"
                  handleClick={() => router.push('/lecturer-profile')}
                />
              </div>
            </div>
            <DashboardOverview userData={userData} records={activityRecords} onView={() => router.push('/home/attendance')} onActiveSession={() => router.push('/physical-attendance')} />
          </>
        )}

        {/* Student View */}
        {userData?.role === 'student' && userData.roleData?.registrationComplete && !error && (
          <>
            <div className="mb-4 flex items-center justify-between" data-tour-id="quick-actions">
              <h2 className="text-lg font-semibold text-[#3B3045]">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div data-tour-id="join-class-card">
                <HomeCard
                  icon={<Link2 className="h-6 w-6 text-[#8437C8]" strokeWidth={1.8} />}
                  title="Join Class"
                  description="Enter invitation link to join your class"
                  actionLabel="Join Now"
                  actionClassName="bg-white text-[#6E27AE]"
                  descriptionClassName="text-white/90"
                  className="bg-[#8437C8] text-white"
                  handleClick={() => setMeetingState('isJoiningMeeting')}
                />
              </div>
              <div data-tour-id="mark-attendance-card">
                <HomeCard
                  icon={<CheckCircle2 className="h-6 w-6 text-[#0E9F4D]" strokeWidth={1.8} />}
                  title="Mark Attendance"
                  description="Mark your physical attendance for today"
                  actionLabel="Mark Attendance"
                  actionClassName="bg-[#0E9F4D] text-white"
                  className="bg-[#92D0AA]"
                  handleClick={() => router.push('/physical-attendance')}
                />
              </div>
              <div data-tour-id="profile-card">
                <HomeCard
                  icon={<Building2 className="h-6 w-6 text-[#2E63C7]" strokeWidth={1.8} />}
                  title="Upcoming Class"
                  description="See your next class and stay prepared"
                  actionLabel="View Schedule"
                  actionClassName="bg-[#2E63C7] text-white"
                  className="bg-[#A6B8E5]"
                  handleClick={() => router.push('/upcoming')}
                />
              </div>
              <div data-tour-id="recordings-card">
                <HomeCard
                  icon={<Video className="h-6 w-6 text-[#E5A900]" strokeWidth={1.8} />}
                  title="Class Recordings"
                  description="Watch and review your previous classes"
                  actionLabel="View Recordings"
                  actionClassName="bg-[#F7B916] text-white"
                  className="bg-[#F2D59B]"
                  handleClick={() => router.push('/home/recordings')}
                />
              </div>
            </div>
            <DashboardOverview userData={userData} records={activityRecords} onView={() => router.push('/home/previous')} onActiveSession={() => router.push('/physical-attendance')} />
          </>
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
                Class Title
              </label>
              <Input
                className="border-none bg-dark-3 text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Enter class title"
                value={values.title}
                onChange={(e) => setValues({ ...values, title: e.target.value })}
              />
            </div>
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
              const id = uuidv4();
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
          <div className="rounded-2xl border border-[#E8E0ED] bg-[#F7F4F8] px-4 py-5 text-center sm:px-6">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#EADCF3] text-[#8437C8]">
              <Plus className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <p className="mt-4 text-sm leading-6 text-[#6B6172]">
              Click &apos;Start Now&apos; to start an instant class. Students can join using the class link.
            </p>
          </div>
        </MeetingModal>
      </div>
    </>
  );
};

export default MeetingTypeList;
