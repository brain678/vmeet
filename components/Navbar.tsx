'use client';

import Link from 'next/link';
import { SignedIn, UserButton, useUser } from '@clerk/nextjs';
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
    <nav className="flex justify-between items-center h-16 px-6 bg-[#0F1828] border-b border-gray-800">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
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
      </div>

      <div className="flex items-center gap-4">
        <SignedIn>
          <UserButton afterSignOutUrl="/sign-in" />
        </SignedIn>
        <MobileNav isLecturer={userRole === 'lecturer'} />
      </div>
    </nav>
  );
};

export default Navbar;
