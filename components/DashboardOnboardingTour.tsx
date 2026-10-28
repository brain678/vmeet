'use client';

import { useEffect, useMemo, useState } from 'react';

type TourStep = {
  title: string;
  description: string;
  targetId: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

interface DashboardOnboardingTourProps {
  isOpen: boolean;
  isLecturer: boolean;
  onFinish: () => void;
}

const lecturerSteps: TourStep[] = [
  {
    title: 'Welcome to your dashboard',
    description: 'This is your Home area. Start or manage your classes from these cards.',
    targetId: 'sidebar-home-link',
  },
  {
    title: 'Your welcome summary',
    description: 'See your name, live class totals, and the next scheduled class at a glance.',
    targetId: 'welcome-banner',
  },
  {
    title: 'Quick Actions',
    description: 'These cards give you fast access to create, schedule, and manage your classes.',
    targetId: 'quick-actions',
  },
  {
    title: 'Start a class instantly',
    description: 'Use New Class when you want to begin a live session right away.',
    targetId: 'new-class-card',
  },
  {
    title: 'Plan ahead',
    description: 'Use Schedule Class to create future classes with date and time.',
    targetId: 'schedule-class-card',
  },
  {
    title: 'Track attendance',
    description: 'Open Physical Attendance to verify and record student attendance.',
    targetId: 'physical-attendance-card',
  },
  {
    title: 'Upcoming sessions',
    description: 'Use Upcoming to review classes that are scheduled ahead of time.',
    targetId: 'sidebar-home-upcoming-link',
  },
  {
    title: 'Previous sessions',
    description: 'Use Previous to review ended class calls and past activity.',
    targetId: 'sidebar-home-previous-link',
  },
  {
    title: 'Recordings library',
    description: 'Use Recordings to revisit recorded sessions when available.',
    targetId: 'sidebar-home-recordings-link',
  },
  {
    title: 'Attendance records page',
    description: 'The Attendance page is where lecturers access exported class attendance records.',
    targetId: 'sidebar-records-link',
  },
  {
    title: 'Personal room',
    description: 'Your Personal Room provides a dedicated meeting space tied to your account.',
    targetId: 'sidebar-home-personal-room-link',
  },
  {
    title: 'Your account controls',
    description: 'Use your profile menu to manage account options and sign out.',
    targetId: 'navbar-account-menu',
  },
  {
    title: 'Your Teaching Overview',
    description: 'Review your active sessions, weekly class activity, and class insights here.',
    targetId: 'teaching-overview',
  },
];

const studentSteps: TourStep[] = [
  {
    title: 'Welcome to your dashboard',
    description: 'This Home page is your starting point for classes and activity.',
    targetId: 'sidebar-home-link',
  },
  {
    title: 'Your welcome summary',
    description: 'See your name, attendance totals, and the next scheduled class at a glance.',
    targetId: 'welcome-banner',
  },
  {
    title: 'Quick Actions',
    description: 'Use these cards to join class, mark attendance, view upcoming classes, and open recordings.',
    targetId: 'quick-actions',
  },
  {
    title: 'Join classes',
    description: 'Use Join Class with an invitation link or class code from your lecturer.',
    targetId: 'join-class-card',
  },
  {
    title: 'Mark attendance',
    description: 'Use Mark Attendance when you are in a physical class session.',
    targetId: 'mark-attendance-card',
  },
  {
    title: 'Keep your profile updated',
    description: 'Update Profile helps you keep your student details current.',
    targetId: 'profile-card',
  },
  {
    title: 'Browse recordings and activity',
    description: 'Use this card to quickly open your recordings and review previous materials.',
    targetId: 'recordings-card',
  },
  {
    title: 'Upcoming classes',
    description: 'Use Upcoming in the sidebar to see your scheduled classes and plan ahead.',
    targetId: 'sidebar-home-upcoming-link',
  },
  {
    title: 'Previous classes',
    description: 'Use Previous to revisit completed sessions and your class history.',
    targetId: 'sidebar-home-previous-link',
  },
  {
    title: 'Recordings page',
    description: 'Use Recordings in the sidebar to access available recordings in one place.',
    targetId: 'sidebar-home-recordings-link',
  },
  {
    title: 'Personal room',
    description: 'Personal Room is your private class space for quick meetings and invites.',
    targetId: 'sidebar-home-personal-room-link',
  },
  {
    title: 'Your account controls',
    description: 'Open your profile menu here to manage your account and sign out securely.',
    targetId: 'navbar-account-menu',
  },
  {
    title: 'Your Attendance Overview',
    description: 'Review your attendance percentage, weekly activity, and progress insight here.',
    targetId: 'attendance-overview',
  },
];

const lecturerMobileSteps: TourStep[] = [
  {
    title: 'Welcome to VMeet',
    description: 'This mobile tour shows your key lecturer navigation shortcuts.',
    targetId: 'mobile-nav-menu-trigger',
  },
  {
    title: 'Welcome summary',
    description: 'See your name, live class totals, and next scheduled class on the dashboard.',
    targetId: 'welcome-banner',
  },
  {
    title: 'Quick Actions',
    description: 'Use these cards to create, schedule, and manage your classes quickly.',
    targetId: 'quick-actions',
  },
  {
    title: 'Teaching overview',
    description: 'Review active sessions, weekly class activity, and class insights here.',
    targetId: 'teaching-overview',
  },
  {
    title: 'Home',
    description: 'Use Home to return to your main dashboard cards anytime.',
    targetId: 'mobile-nav-home-link',
  },
  {
    title: 'Upcoming and Previous',
    description: 'Use Upcoming for scheduled classes and Previous for completed sessions.',
    targetId: 'mobile-nav-home-upcoming-link',
  },
  {
    title: 'Recordings',
    description: 'Use Recordings to review saved session media.',
    targetId: 'mobile-nav-home-recordings-link',
  },
  {
    title: 'Attendance',
    description: 'Attendance gives lecturers access to attendance records and exports.',
    targetId: 'mobile-nav-records-link',
  },
  {
    title: 'Personal Room',
    description: 'Use Personal Room for your dedicated class meeting space.',
    targetId: 'mobile-nav-home-personal-room-link',
  },
  {
    title: 'Account menu',
    description: 'Use your account menu to manage profile options and sign out.',
    targetId: 'navbar-account-menu',
  },
];

const studentMobileSteps: TourStep[] = [
  {
    title: 'Welcome to VMeet',
    description: 'This quick mobile tour shows your most important navigation links.',
    targetId: 'mobile-nav-menu-trigger',
  },
  {
    title: 'Welcome summary',
    description: 'See your name, attendance totals, and next scheduled class on the dashboard.',
    targetId: 'welcome-banner',
  },
  {
    title: 'Quick Actions',
    description: 'Use these cards to join class, mark attendance, view upcoming classes, and open recordings.',
    targetId: 'quick-actions',
  },
  {
    title: 'Attendance overview',
    description: 'Review your attendance percentage, weekly activity, and progress insight here.',
    targetId: 'attendance-overview',
  },
  {
    title: 'Home',
    description: 'Use Home to return to your dashboard and core class actions.',
    targetId: 'mobile-nav-home-link',
  },
  {
    title: 'Upcoming and Previous',
    description: 'Use Upcoming for scheduled classes and Previous for class history.',
    targetId: 'mobile-nav-home-upcoming-link',
  },
  {
    title: 'Recordings',
    description: 'Use Recordings to revisit learning sessions and materials.',
    targetId: 'mobile-nav-home-recordings-link',
  },
  {
    title: 'Personal Room',
    description: 'Personal Room is your private meeting space and invite point.',
    targetId: 'mobile-nav-home-personal-room-link',
  },
  {
    title: 'Account menu',
    description: 'Use your account menu to update account settings and sign out.',
    targetId: 'navbar-account-menu',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DashboardOnboardingTour = ({ isOpen, isLecturer, onFinish }: DashboardOnboardingTourProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const steps = useMemo(() => {
    if (isMobileViewport) {
      return isLecturer ? lecturerMobileSteps : studentMobileSteps;
    }
    return isLecturer ? lecturerSteps : studentSteps;
  }, [isLecturer, isMobileViewport]);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      window.dispatchEvent(new Event('vmeet-tour-close-mobile-nav'));
      window.dispatchEvent(new Event('vmeet-tour-end-mobile-nav'));
      return;
    }

    if (!isMobileViewport) {
      window.dispatchEvent(new Event('vmeet-tour-close-mobile-nav'));
      window.dispatchEvent(new Event('vmeet-tour-end-mobile-nav'));
      return;
    }

    window.dispatchEvent(new Event('vmeet-tour-start-mobile-nav'));
    const currentStep = steps[stepIndex];
    const isMenuTriggerStep = currentStep?.targetId === 'mobile-nav-menu-trigger';
    const isMobileMenuTarget = currentStep?.targetId?.startsWith('mobile-nav-') && !isMenuTriggerStep;

    if (isMobileMenuTarget) {
      window.dispatchEvent(new Event('vmeet-tour-open-mobile-nav'));
      return;
    }

    window.dispatchEvent(new Event('vmeet-tour-close-mobile-nav'));
  }, [isOpen, isMobileViewport, stepIndex, steps]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      return;
    }

    const currentStep = steps[stepIndex];

    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`) as HTMLElement | null;

      if (!target) {
        setSpotlight(null);
        setTooltipPosition({ top: window.innerHeight * 0.5 - 120, left: window.innerWidth * 0.5 - 180 });
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      const rect = target.getBoundingClientRect();
      const padding = 8;
      const width = rect.width + padding * 2;
      const height = rect.height + padding * 2;
      const left = rect.left - padding;
      const top = rect.top - padding;

      setSpotlight({ top, left, width, height });

      const tooltipWidth = 360;
      const tooltipHeight = 190;
      const preferredTop = top + height + 12;
      const aboveTop = top - tooltipHeight - 12;
      const topPosition = preferredTop + tooltipHeight <= window.innerHeight ? preferredTop : Math.max(12, aboveTop);
      const leftPosition = clamp(left + width / 2 - tooltipWidth / 2, 12, window.innerWidth - tooltipWidth - 12);

      setTooltipPosition({ top: topPosition, left: leftPosition });
    }, 320);

    return () => window.clearTimeout(timer);
  }, [isOpen, stepIndex, steps]);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const currentStep = steps[stepIndex];
      const target = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`) as HTMLElement | null;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const padding = 8;
      const width = rect.width + padding * 2;
      const height = rect.height + padding * 2;
      const left = rect.left - padding;
      const top = rect.top - padding;

      setSpotlight({ top, left, width, height });

      const tooltipWidth = 360;
      const tooltipHeight = 190;
      const preferredTop = top + height + 12;
      const aboveTop = top - tooltipHeight - 12;
      const topPosition = preferredTop + tooltipHeight <= window.innerHeight ? preferredTop : Math.max(12, aboveTop);
      const leftPosition = clamp(left + width / 2 - tooltipWidth / 2, 12, window.innerWidth - tooltipWidth - 12);

      setTooltipPosition({ top: topPosition, left: leftPosition });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, stepIndex, steps]);

  if (!isOpen) return null;

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div className="pointer-events-none absolute inset-0 bg-black/65" />

      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-blue-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute z-10 w-[360px] max-w-[calc(100vw-24px)] rounded-xl border border-blue-300/50 bg-[#10213A] p-5 text-white shadow-2xl"
        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
          Dashboard Tour {stepIndex + 1}/{steps.length}
        </p>
        <h3 className="mt-2 text-xl font-bold">{currentStep.title}</h3>
        <p className="mt-2 text-sm text-blue-100/90">{currentStep.description}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event('vmeet-tour-close-mobile-nav'));
              onFinish();
            }}
            className="rounded-md border border-white/25 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
              className="rounded-md border border-white/25 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/10"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  window.dispatchEvent(new Event('vmeet-tour-close-mobile-nav'));
                  onFinish();
                  return;
                }
                setStepIndex((prev) => prev + 1);
              }}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOnboardingTour;
