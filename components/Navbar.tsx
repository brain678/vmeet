'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import MobileNav from './MobileNav';
import { BACKEND_URL } from '@/constants/config';
import Image from 'next/image';

const Navbar = () => {
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

  return (
    <nav className="relative flex h-16 items-center justify-between px-4 sm:px-5 md:justify-end md:px-6">
      <Link
        href="/home"
        className="flex h-8 w-[110px] shrink-0 items-center md:hidden"
      >
        <Image
          src="/images/logo.png"
          width={110}
          height={28}
          className="h-8 w-[110px] object-contain object-left"
          alt="VMeet"
          priority
        />
      </Link>

      <div className="ml-auto flex items-center md:hidden">
        <MobileNav isLecturer={userRole === 'lecturer'} />
      </div>

      <div className="hidden md:block">
        <MobileNav isLecturer={userRole === 'lecturer'} />
      </div>
    </nav>
  );
};

export default Navbar;
