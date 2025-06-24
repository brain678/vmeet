"use client";

import * as React from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { BACKEND_URL } from '@/constants/config';

type Role = 'lecturer' | 'student';

interface RoleData {
  isRegistered: boolean;
  hasReferenceImage?: boolean;
  registrationComplete?: boolean;
  nextStep?: string;
  sessionsCount?: number;
}

interface RoleCheckResponse {
  status: string;
  role?: Role;
  needsRoleSelection: boolean;
  roleData?: RoleData;
}

export default function RoleSelection() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleData, setRoleData] = useState<RoleData | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/check-role-selection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });
        
        const data: RoleCheckResponse = await response.json();
        
        if (data.needsRoleSelection) {
          setRoleData(data.roleData || null);
          return;
        }

        if (data.role) {
          const nextStep = data.roleData?.nextStep || 'home';
          if (nextStep === 'registration') {
            router.push('/student-registration');
          } else {
            router.push('/home');
          }
        }
      } catch (err) {
        console.error('Error checking user role:', err);
        setError('Failed to check user role. Please try again.');
      }
    };

    if (isLoaded && user) {
      checkUserRole();
    }
  }, [isLoaded, user, router]);

  const handleRoleSelection = async (selectedRole: Role) => {
    if (!user?.id || !user?.emailAddresses[0]?.emailAddress) {
      setError('User information not available. Please sign in again.');
      return;
    }

    setLoading(true);
    setError("");
    setSelectedRole(selectedRole);

    try {
      // First check if role selection is allowed
      const checkResponse = await fetch(`${BACKEND_URL}/check-role-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const checkData: RoleCheckResponse = await checkResponse.json();
      
      // If user already has a role and it's different, confirm change
      if (!checkData.needsRoleSelection && checkData.role && checkData.role !== selectedRole) {
        if (!confirm('You already have a role assigned. Are you sure you want to change it? This may affect your existing data.')) {
          setLoading(false);
          return;
        }
      }

      // Set the user's role
      const response = await fetch(`${BACKEND_URL}/set-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.emailAddresses[0].emailAddress,
          name: user.fullName || user.firstName || 'Unknown',
          role: selectedRole,
        }),
      });

      const data = await response.json();      if (data.status === "success") {
        if (selectedRole === 'lecturer') {
          console.log('Role set successfully, redirecting to home');
          router.push('/home');
        } else {
          console.log('Student role set successfully, redirecting to registration');
          router.push('/student-registration');
        }
      } else {
        console.error('Failed to set user role:', data);
        throw new Error(data.detail || 'Failed to set user role');
      }
    } catch (err) {
      console.error('Error in role selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to set user role');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (!isLoaded || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0F1828] to-[#1B2B44]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state for missing user data
  if (!user.id || !user.emailAddresses[0]?.emailAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0F1828] to-[#1B2B44]">
        <div className="text-center bg-red-500/10 p-6 rounded-lg">
          <Image src="/icons/error.svg" alt="Error" width={48} height={48} className="mx-auto mb-4" />
          <div className="text-red-500">User information not available. Please sign in again.</div>
        </div>
      </div>
    );
  }

  const roleCards = [
    {
      role: 'student' as const,
      title: 'Student',
      icon: '/icons/student.svg',
      description: 'Join classes and mark your attendance',
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      disabledColor: 'disabled:bg-blue-400'
    },
    {
      role: 'lecturer' as const,
      title: 'Lecturer',
      icon: '/icons/lecturer.svg',
      description: 'Create classes and manage attendance',
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      disabledColor: 'disabled:bg-green-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1828] to-[#1B2B44] p-4 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold text-white mb-4"
          >
            Welcome to VMeet
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-gray-400 text-lg"
          >
            Please select your role to continue
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 px-4">
          {roleCards.map((card, index) => (
            <motion.div
              key={card.role}
              initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              onClick={() => setSelectedRole(card.role)}
              className={`
                cursor-pointer rounded-xl p-6 
                ${selectedRole === card.role ? 'bg-[#2C3C56] ring-2 ring-blue-500' : 'bg-[#1B2B44]'}
                transition-all duration-200 hover:transform hover:scale-105 hover:shadow-xl
              `}
            >
              <div className="text-center">
                <div className="rounded-full bg-opacity-10 p-4 inline-block mb-4">
                  <Image src={card.icon} alt={card.title} width={48} height={48} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-gray-400 mb-6">{card.description}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSelection(card.role);
                  }}
                  disabled={loading}
                  className={`
                    w-full rounded-lg px-4 py-3 font-medium text-white 
                    transition-all duration-200
                    ${card.color} ${card.hoverColor} ${card.disabledColor}
                    transform hover:scale-105
                    disabled:cursor-not-allowed
                    ${loading && selectedRole === card.role ? 'animate-pulse' : ''}
                  `}
                >
                  {loading && selectedRole === card.role ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                      Setting up...
                    </div>
                  ) : (
                    `Continue as ${card.title}`
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-lg bg-red-500/10 p-4 text-center"
          >
            <div className="flex items-center justify-center space-x-2">
              <Image src="/icons/error.svg" alt="Error" width={20} height={20} />
              <p className="text-red-500">{error}</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
