'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import MeetingTypeList from '@/components/MeetingTypeList';
import DashboardOnboardingTour from '@/components/DashboardOnboardingTour';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '@/constants/config';
import { BookOpenCheck, CheckCircle2 } from 'lucide-react';

const Home = () => {
  const now = new Date();
  const router = useRouter();
  const { user } = useUser();
  const [timeState, setTimeState] = useState({
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(now)
  });
  const [isLecturer, setIsLecturer] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [matricNumber, setMatricNumber] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState({ first: 0, second: 0 });
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [nextClassTime, setNextClassTime] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

  const getScheduleCacheKey = () => {
    if (!user?.id) return null;
    return `home-schedule-${user.id}-${isLecturer ? 'lecturer' : 'student'}`;
  };

  const readCachedScheduleData = () => {
    if (typeof window === 'undefined') return null;

    const cacheKey = getScheduleCacheKey();
    if (!cacheKey) return null;

    try {
      const cachedValue = window.sessionStorage.getItem(cacheKey);
      if (!cachedValue) return null;

      const parsedValue = JSON.parse(cachedValue);
      if (!parsedValue || !parsedValue.expiresAt || parsedValue.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(cacheKey);
        return null;
      }

      return parsedValue.data || null;
    } catch (error) {
      console.warn('Error reading cached schedule data:', error);
      return null;
    }
  };

  const writeCachedScheduleData = (data: { upcomingClasses: any[]; nextClassTime: string | null }) => {
    if (typeof window === 'undefined') return;

    const cacheKey = getScheduleCacheKey();
    if (!cacheKey) return;

    try {
      const payload = {
        expiresAt: Date.now() + 5 * 60 * 1000,
        data,
      };

      window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Error writing cached schedule data:', error);
    }
  };

  // Redirect logged-out users to the public landing page
  useEffect(() => {
    if (user === null && user !== undefined) {
      router.push('/');
    }
  }, [user, router]);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimeState({
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(now)
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user?.id}`);
        const data = await response.json();
        setIsLecturer(data.role === 'lecturer');
        setDisplayName(typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null);
        setMatricNumber(data.role === 'student' ? data.matricNumber || null : null);
        const sessionCount = data.roleData?.totalSessions || 0;
        const attendanceCount = data.roleData?.attendanceCount || 0;
        setDashboardStats(
          data.role === 'lecturer'
            ? { first: sessionCount, second: sessionCount }
            : { first: attendanceCount, second: attendanceCount }
        );
        setIsRestricted(data.isRestricted || false);
      } catch (error) {
        console.error('Error checking user role:', error);
      } finally {
        setIsRoleLoaded(true);
      }
    };
    
    if (user?.id) {
      checkUserRole();
    } else {
      setDisplayName(null);
      setIsRoleLoaded(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.id) {
        setNeedsOnboarding(false);
        setHasCheckedOnboarding(true);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/onboarding-status?userId=${user.id}`);
        if (!response.ok) {
          setNeedsOnboarding(false);
          return;
        }

        const data = await response.json();
        setNeedsOnboarding(data.needsOnboarding === true);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setNeedsOnboarding(false);
      } finally {
        setHasCheckedOnboarding(true);
      }
    };

    checkOnboardingStatus();
  }, [user?.id]);

  const completeOnboarding = async () => {
    if (!user?.id) {
      setNeedsOnboarding(false);
      return;
    }

    try {
      await fetch(`${BACKEND_URL}/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setNeedsOnboarding(false);
    }
  };

  useEffect(() => {
    const loadSecondaryHomeData = async () => {
      if (!user?.id || !isRoleLoaded) return;

      setIsScheduleLoaded(false);

      const cachedScheduleData = readCachedScheduleData();
      if (cachedScheduleData) {
        setNextClassTime(cachedScheduleData.nextClassTime || null);
        setIsScheduleLoaded(true);
        return;
      }

      try {
        const schedulesResponse = await fetch(
          `${BACKEND_URL}/${isLecturer ? 'lecturer-schedules?lecturerId' : 'student-schedules?studentId'}=${user.id}`
        );

        const schedulesPayload = schedulesResponse.ok ? await schedulesResponse.json() : {};
        const scheduledClasses = isLecturer ? schedulesPayload.schedules?.upcoming || [] : schedulesPayload.schedules || [];

        const futureSessions = scheduledClasses
          .map((schedule: any) => ({ ...schedule, startTime: schedule.scheduledDateTime || schedule.startTime }))
          .filter((session: any) => {
            const start = new Date(session.startTime);
            return !isNaN(start.getTime()) && start.getTime() > Date.now();
          });

        futureSessions.sort((a: any, b: any) => {
          const aTime = new Date(a.startTime).getTime();
          const bTime = new Date(b.startTime).getTime();
          return aTime - bTime;
        });

        const nextUpcomingClasses = futureSessions.slice(0, 3);
        const nextClassLabel = nextUpcomingClasses.length > 0
          ? new Date(nextUpcomingClasses[0].startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
          : null;

        setNextClassTime(nextClassLabel);

        writeCachedScheduleData({
          upcomingClasses: nextUpcomingClasses,
          nextClassTime: nextClassLabel,
        });
      } catch (error) {
        console.error('Error loading secondary homepage data:', error);
        setNextClassTime(null);
      } finally {
        setIsScheduleLoaded(true);
      }
    };

    const timer = window.setTimeout(() => {
      loadSecondaryHomeData();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [user?.id, isLecturer, isRoleLoaded]);

  return (
    <section className="min-h-screen px-5 pb-10 pt-16 text-[#18121F] sm:px-8 lg:px-12">
      {hasCheckedOnboarding && isRoleLoaded && needsOnboarding && (
        <DashboardOnboardingTour
          isOpen={needsOnboarding}
          isLecturer={isLecturer}
          onFinish={completeOnboarding}
        />
      )}

      {isRestricted && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 rounded-lg bg-red-500/20 border border-red-500/50 px-6 py-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-200">Account Restricted</h3>
              <p className="text-sm text-red-200/80">Your account has been restricted. Please contact an administrator for more information.</p>
            </div>
          </div>
        </motion.div>
      )}
      <div className="mx-auto w-full max-w-[1180px]">
        <motion.div data-tour-id="welcome-banner" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative min-h-[230px] overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7630B8] via-[#8234C6] to-[#A14EDD] px-5 py-6 text-white shadow-[0_12px_25px_rgba(99,44,148,0.22)] sm:rounded-[50px] sm:px-10 sm:py-9">
          <Image
            src="/images/hero.jpg"
            alt=""
            fill
            className="pointer-events-none object-cover object-center opacity-20 mix-blend-screen"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#6E27AE]/70 via-transparent to-[#A14EDD]/50" />
          {isRoleLoaded && isScheduleLoaded ? (
          <div className="relative z-10 flex min-h-[166px] items-center justify-between gap-7">
            <div className="min-w-0 max-w-[440px]">
              <p className="text-xs font-medium text-white/80 sm:text-base">{timeState.date}</p>
              <p className="mt-2 text-2xl font-semibold leading-tight sm:mt-3 sm:text-[38px]">Welcome Back,</p>
              <h1 className="text-2xl font-semibold leading-tight sm:text-[38px]">
                {isLecturer
                  ? displayName || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User'
                  : user?.firstName || displayName?.split(/\s+/)[0] || user?.username || 'User'}
              </h1>
              {!isLecturer && matricNumber && (
                <p className="mt-1 text-xs font-medium text-white/85 sm:mt-2 sm:text-base">{matricNumber}</p>
              )}
              <div className="mt-4 grid max-w-[320px] grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
                <div className="flex min-h-[48px] items-center gap-2 rounded-md bg-white px-2 py-2 text-[#2D1A3A] shadow-sm sm:min-h-[54px] sm:gap-3 sm:px-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#F0E5F8] text-[#8736C5]" aria-hidden="true"><CheckCircle2 className="h-5 w-5" strokeWidth={2} /></span>
                  <span className="min-w-0">
                    <strong className="block text-lg leading-none">{dashboardStats.first}</strong>
                    <span className="mt-1 block text-[10px] font-medium leading-3 text-[#5E5365]">{isLecturer ? 'attendance taken' : 'attendance marked'}</span>
                  </span>
                </div>
                <div className="flex min-h-[48px] items-center gap-2 rounded-md bg-white px-2 py-2 text-[#2D1A3A] shadow-sm sm:min-h-[54px] sm:gap-3 sm:px-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#F0E5F8] text-[#8736C5]" aria-hidden="true"><BookOpenCheck className="h-5 w-5" strokeWidth={2} /></span>
                  <span className="min-w-0">
                    <strong className="block text-lg leading-none">{dashboardStats.second}</strong>
                    <span className="mt-1 block text-[10px] font-medium leading-3 text-[#5E5365]">{isLecturer ? 'classes created' : 'classes attended'}</span>
                  </span>
                </div>
              </div>
            </div>
            <Image
              src={isLecturer ? '/images/lecturer-experience-dashboard.png' : '/images/student-experience-dashboard.png'}
              alt=""
              width={250}
              height={166}
              className="hidden h-[166px] w-[250px] rounded-lg object-cover object-top shadow-[0_8px_18px_rgba(37,10,69,0.3)] lg:block"
            />
            <div className="hidden w-[200px] shrink-0 rounded-2xl bg-white px-5 py-4 text-[#281637] shadow-[0_8px_18px_rgba(37,10,69,0.2)] sm:block">
              <p className="text-xs font-medium text-[#6B6171]">Next class</p>
              <p className="mt-2 text-lg font-semibold">{nextClassTime ? nextClassTime.split(',')[0] : 'No class scheduled'}</p>
              <p className="text-xs text-[#6B6171]">{nextClassTime ? nextClassTime.split(',').slice(1).join(',') : 'You are all caught up'}</p>
              <button type="button" onClick={() => router.push('/upcoming')} className="mt-4 text-xs font-semibold text-[#6E27AE] hover:underline">View schedule -&gt;</button>
            </div>
          </div>
          ) : (
            <div className="relative z-10 flex min-h-[166px] items-center justify-between gap-7" aria-label="Loading welcome data">
              <div className="w-[440px] max-w-full space-y-4">
                <div className="h-4 w-40 animate-pulse rounded bg-white/20" />
                <div className="h-10 w-64 animate-pulse rounded bg-white/20" />
                <div className="h-10 w-52 animate-pulse rounded bg-white/20" />
                <div className="flex gap-3">
                  <div className="h-[54px] w-36 animate-pulse rounded-md bg-white/20" />
                  <div className="h-[54px] w-36 animate-pulse rounded-md bg-white/20" />
                </div>
              </div>
              <div className="hidden h-[166px] w-[250px] animate-pulse rounded-lg bg-white/20 lg:block" />
              <div className="hidden h-[150px] w-[200px] animate-pulse rounded-2xl bg-white/20 sm:block" />
            </div>
          )}
        </motion.div>
        <div className="mt-7"><MeetingTypeList /></div>
      </div>
    </section>
  );
};

export default Home;
