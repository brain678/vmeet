'use client';

import Link from 'next/link';
import { SignedIn, UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import MobileNav from './MobileNav';
import Image from 'next/image';

const BACKEND_URL = "http://127.0.0.1:8000";

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
    <nav className="fixed left-0 top-0 z-50 flex h-[72px] w-full items-center justify-between bg-[#0F1828] px-6">
      <Link href="/home" className="flex items-center gap-2">
        <p className="text-2xl font-bold text-white">
          V-meet
        </p>
      </Link>

      <div className="flex items-center gap-4">
        <SignedIn>
          <UserButton 
            afterSignOutUrl="/sign-in" 
            appearance={{
              elements: {
                avatarBox: "h-[40px] w-[40px]"
              }
            }}
          />
        </SignedIn>
        <MobileNav isLecturer={userRole === 'lecturer'} />
      </div>
    </nav>
  );
};

export default Navbar;
