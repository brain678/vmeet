'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, UserButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { sidebarLinks, type SidebarLink } from '@/constants';
import { cn } from '@/lib/utils';
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

interface MobileNavProps {
  isLecturer: boolean;
}

const MobileNav = ({ isLecturer }: MobileNavProps) => {
  const pathname = usePathname() || '';
  const [isOpen, setIsOpen] = useState(false);

  const getTourIdForRoute = (route: string) => {
    const normalized = route
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '') || 'home';
    return `mobile-nav-${normalized}-link`;
  };

  // Filter out lecturer-specific routes for non-lecturers
  const availableLinks = sidebarLinks.filter(link => {
    if (link.requiresLecturer) {
      return isLecturer;
    }
    if (link.requiresStudent) {
      return !isLecturer;
    }
    return true;
  });

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleTourEnd = () => {
      setIsOpen(false);
    };

    window.addEventListener('vmeet-tour-open-mobile-nav', handleOpen);
    window.addEventListener('vmeet-tour-close-mobile-nav', handleClose);
    window.addEventListener('vmeet-tour-end-mobile-nav', handleTourEnd);

    return () => {
      window.removeEventListener('vmeet-tour-open-mobile-nav', handleOpen);
      window.removeEventListener('vmeet-tour-close-mobile-nav', handleClose);
      window.removeEventListener('vmeet-tour-end-mobile-nav', handleTourEnd);
    };
  }, []);

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex h-16 items-center justify-end text-[#8736C5]">
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-violet-50"
              aria-label="Open navigation menu"
              data-tour-id="mobile-nav-menu-trigger"
            >
              <Image
                src="/icons/hamburger.svg"
                width={28}
                height={28}
                alt=""
                className="h-7 w-7"
              />
            </button>
          </SheetTrigger>
        </div>
        <SheetContent side="left" className="border-none bg-gradient-to-b from-[#8736C5] via-[#7024A9] to-[#42105F] p-0 text-white" data-tour-id="mobile-nav-menu-panel">
          <div className="flex h-full flex-col px-5">
            <div className="relative z-50 flex items-center justify-between border-b border-white/15 py-6" onClick={(event) => event.stopPropagation()}>
              <Link href="/home" className="flex h-8 w-[120px] items-center">
                <Image
                  src="/images/logo.png"
                  width={120}
                  height={32}
                  className="h-8 w-[120px] object-contain object-left"
                  alt="VMeet"
                />
              </Link>
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
            </div>
            <nav className="flex flex-col gap-2 pt-6">
              {availableLinks.map((item) => {
                const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);

                return (
                  <SheetClose asChild key={item.route}>
                    <Link
                      href={item.route}
                      data-tour-id={getTourIdForRoute(item.route)}
                      className={cn(
                        'flex min-h-12 items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-white/10',
                        {
                          'bg-white/20 shadow-sm': isActive,
                        }
                      )}
                    >
                      {(() => {
                        const Icon = navigationIcons[item.iconName];
                        return <Icon className="h-5 w-5 text-white/90" strokeWidth={1.8} aria-hidden="true" />;
                      })()}
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileNav;
