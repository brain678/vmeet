'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

import { sidebarLinks, type SidebarLink } from '@/constants';
import { cn } from '@/lib/utils';
import { BACKEND_URL } from '@/constants/config';
import { CalendarDays, ClipboardCheck, DoorOpen, History, Home as HomeIcon, UserRound, Video, type LucideIcon } from 'lucide-react';

const navigationIcons: Record<SidebarLink['iconName'], LucideIcon> = {
  home: HomeIcon,
  upcoming: CalendarDays,
  previous: History,
  recordings: Video,
  attendance: ClipboardCheck,
  'personal-room': DoorOpen,
  profile: UserRound,
};

const Sidebar = () => {
  const pathname = usePathname();
  const { user } = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        const userData = await response.json();
        setUserRole(userData.role);
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };

    checkUserRole();
  }, [user?.id]);

  // Filter links based on user role
  const filteredLinks = sidebarLinks.filter(link => 
    (!link.requiresLecturer || userRole === 'lecturer') &&
    (!link.requiresStudent || userRole === 'student')
  );

  const getTourIdForRoute = (route: string) => {
    const normalized = route
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '') || 'home';
    return `sidebar-${normalized}-link`;
  };

  return (
    <section className="flex h-dvh w-[240px] min-w-0 flex-col overflow-hidden bg-gradient-to-b from-[#8736C5] via-[#7024A9] to-[#42105F] text-white max-md:hidden">
      <div className="px-5 pt-6">
        <Link href="/home" className="flex h-8 w-[120px] items-center px-1">
          <Image
            src="/images/logo.png"
            width={120}
            height={32}
            className="h-8 w-[120px] object-contain object-left"
            alt="VMeet"
            priority
          />
        </Link>
        <div
          className="relative z-50 mt-6 flex items-center gap-3 border-b border-white/15 pb-5"
          data-tour-id="navbar-account-menu"
          onClick={(event) => event.stopPropagation()}
        >
          <SignedIn>
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: 'h-10 w-10 ring-2 ring-white/80',
                    userButtonPopoverCard: 'z-[100] pointer-events-auto',
                    userButtonPopoverActionButton: 'pointer-events-auto',
                },
              }}
            />
          </SignedIn>
          <span className="min-w-0 truncate text-sm font-semibold text-white">
            {user?.firstName || user?.username || 'Account'}
          </span>
          <span className="ml-auto text-sm text-white/75" aria-hidden="true">⌄</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6">
        <div className="flex flex-col gap-2">
        {filteredLinks.map((item) => {
          const isActive = pathname === item.route || pathname?.startsWith(`${item.route}/`);
          const linkTourId = getTourIdForRoute(item.route);
          
          return (
            <Link
              href={item.route}
              key={item.label}
              data-tour-id={linkTourId}
              className={cn(
                'group flex min-h-12 w-full items-center gap-4 rounded-lg px-4 py-3 text-left transition-all',
                {
                  'bg-white/20 text-white shadow-sm': isActive,
                  'text-white/80 hover:bg-white/10 hover:text-white': !isActive,
                }
              )}
            >
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-all',
                isActive ? 'bg-white/15' : 'bg-transparent'
              )}>
                {(() => {
                  const Icon = navigationIcons[item.iconName];
                  return <Icon className={cn('h-5 w-5 transition-all', isActive ? 'text-white' : 'text-white/80 group-hover:text-white')} strokeWidth={1.8} aria-hidden="true" />;
                })()}
              </div>
              <span className="truncate text-sm font-semibold leading-5">{item.label}</span>
            </Link>
          );
        })}
        </div>
      </div>
    </section>
  );
};

export default Sidebar;
