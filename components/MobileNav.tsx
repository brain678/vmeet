'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { sidebarLinks, type SidebarLink } from '@/constants';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isLecturer: boolean;
}

const MobileNav = ({ isLecturer }: MobileNavProps) => {
  const pathname = usePathname() || '';

  // Filter out lecturer-specific routes for non-lecturers
  const availableLinks = sidebarLinks.filter(link => {
    if (link.requiresLecturer) {
      return isLecturer;
    }
    return true;
  });

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Image
            src="/icons/hamburger.svg"
            width={36}
            height={36}
            alt="Menu"
            className="cursor-pointer"
          />
        </SheetTrigger>
        <SheetContent side="left" className="border-none bg-dark-1 p-0">
          <div className="flex h-full flex-col px-6">
            <Link href="/home" className="flex items-center gap-2 py-6">
              <div className="relative w-10 h-10">
                <Image 
                  src="/images/logo.png"
                  fill
                  className="object-contain"
                  alt="Logo"
                  priority
                />
              </div>
            </Link>
            <nav className="flex flex-col gap-4">
              {availableLinks.map((item) => {
                const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);

                return (
                  <SheetClose asChild key={item.route}>
                    <Link
                      href={item.route}
                      className={cn(
                        'flex items-center gap-4 rounded-lg p-4 transition-colors hover:bg-blue-1/10',
                        {
                          'bg-blue-1': isActive,
                        }
                      )}
                    >
                      <Image
                        src={item.imgURL}
                        alt={item.label}
                        width={24}
                        height={24}
                      />
                      <span className="text-base font-medium text-white">{item.label}</span>
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
