'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

import { sidebarLinks, type SidebarLink } from '@/constants';
import { cn } from '@/lib/utils';
import { BACKEND_URL } from '@/constants/config';

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
    !link.requiresLecturer || userRole === 'lecturer'
  );

  return (
    <section className="flex h-[calc(100vh-64px)] w-[280px] flex-col border-r border-gray-800 bg-[#0F1828] max-md:hidden">
      <div className="flex flex-1 flex-col gap-2 p-3 pt-4">
        {filteredLinks.map((item) => {
          const isActive = pathname === item.route;
          
          return (
            <Link
              href={item.route}
              key={item.label}
              className={cn(
                'group flex h-[64px] items-center gap-3 rounded-2xl px-4 transition-all',
                {
                  'bg-[#1E88E5] text-white hover:bg-[#1976D2]': isActive,
                  'text-gray-400 hover:bg-white/5 hover:text-white': !isActive,
                }
              )}
            >
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
              )}>
                <Image
                  src={item.imgURL}
                  alt={item.label}
                  width={24}
                  height={24}
                  className={cn(
                    'transition-all',
                    isActive ? 'brightness-200' : 'opacity-70 group-hover:opacity-100'
                  )}
                />
              </div>
              <span className="text-base font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default Sidebar;
