"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

const PhysicalAttendancePage = () => {
  const { user } = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-user-role?userId=${user.id}`);
        const data = await response.json();
        setUserRole(data.role);
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };

    if (user?.id) {
      checkUserRole();
    }
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-[#0F1828] flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-white mb-6">Coming Soon</h1>
        
        {userRole === 'lecturer' ? (
          <div className="space-y-4">
            <div className="glassmorphism bg-gradient-to-br from-teal-500/20 to-emerald-700/20 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold text-teal-400 mb-3">Attendance Management</h2>
              <p className="text-gray-300 text-lg">
                Soon you'll be able to manage physical attendance with features like QR codes, 
                manual marking, and real-time tracking.
              </p>
            </div>
          </div>
        ) : userRole === 'student' ? (
          <div className="space-y-4">
            <div className="glassmorphism bg-gradient-to-br from-indigo-500/20 to-purple-600/20 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold text-indigo-400 mb-3">Student Check-In</h2>
              <p className="text-gray-300 text-lg">
                Soon you'll be able to mark your attendance for physical classes using QR codes 
                or location-based verification.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-lg">Loading...</p>
        )}      </div>
    </div>
  );
};

export default PhysicalAttendancePage;
