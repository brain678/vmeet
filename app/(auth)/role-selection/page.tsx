"use client";

import * as React from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { BACKEND_URL } from '@/constants/config';
import { ChevronDown, Plus, X } from 'lucide-react';

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

interface Department {
  _id: string;
  id?: string;
  name: string;
}

interface Course {
  _id: string;
  code: string;
  title: string;
  credits?: number;
}

const lecturerSteps = [
  { label: 'Full Name', field: 'name' },
  { label: 'Email Address', field: 'email' },
  { label: 'Department', field: 'department' },
  { label: 'Select Courses', field: 'courses' },
];

export default function RoleSelection() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [isCheckingData, setIsCheckingData] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  
  // Lecturer registration form states
  const [lecturerStep, setLecturerStep] = useState(0);
  const [lecturerFormData, setLecturerFormData] = useState({
    name: '',
    email: '',
    department: '',
    courses: [] as string[],
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initializeAndCheckUserRole = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setIsCheckingData(false);
          setError('User information is not available. Please sign in again.');
        }
        return;
      }

      const currentUserId = user.id;
      setIsCheckingData(true);
      setError('');
      
      try {
        // First, initialize user in MongoDB if coming from Google OAuth
        const userEmail = user.emailAddresses?.[0]?.emailAddress;
        const userFullName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        if (userEmail) {
          const initResponse = await fetch(`${BACKEND_URL}/initialize-user-from-google`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              email: userEmail,
              name: userFullName,
              firstName: user.firstName,
              lastName: user.lastName,
            }),
          });

          const initData = await initResponse.json();
          if (!initResponse.ok || initData.status !== 'success') {
            throw new Error(initData.detail || 'Could not initialize your account');
          }

          console.log('✅ User initialized in MongoDB:', initData);
        }

        // Wait a moment to ensure database is updated
        await new Promise(resolve => setTimeout(resolve, 500));

        // Now check role selection status
        const response = await fetch(`${BACKEND_URL}/check-role-selection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Could not load your account profile');
        }

        const data: RoleCheckResponse = await response.json();
        console.log('📋 Role check response:', data);

        // Never let a response for a previous account affect the current account.
        if (cancelled || user?.id !== currentUserId) return;
        
        // Only a confirmed response for this user may show the role form.
        if (data.needsRoleSelection === true && !data.role) {
          setIsCheckingData(false);
          return;
        }

        // User has a role and data already - redirect them
        if (data.role) {
          const nextStep = data.roleData?.nextStep || 'home';
          console.log('✅ User has role:', data.role, 'Redirecting to:', nextStep);
          // Set checking to false before redirect to ensure cleanup
          setIsCheckingData(false);
          if (nextStep === 'registration') {
            router.replace('/student-registration');
          } else {
            router.replace('/home');
          }
          return;
        }

        // Fallback: if no role found, show role selection
        setIsCheckingData(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Error checking user role:', err);
        setError(err instanceof Error ? err.message : 'Failed to check user role. Please try again.');
        setIsCheckingData(false);
      }
    };

    if (isLoaded && user) {
      initializeAndCheckUserRole();
    }

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id, router]);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/departments?limit=1000`);
        const data = await response.json();
        if (data.data) {
          setDepartments(data.data);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch courses when department changes
  useEffect(() => {
    const fetchCourses = async () => {
      if (!departmentId) {
        setCourses([]);
        return;
      }

      try {
        setLoadingCourses(true);
        const response = await fetch(
          `${BACKEND_URL}/courses?department_id=${departmentId}&limit=1000`
        );
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          setCourses(data.data);
          // Reset selected courses when department changes
          setLecturerFormData(prev => ({ ...prev, courses: [] }));
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [departmentId]);

  // Update department ID when department selection changes
  useEffect(() => {
    if (lecturerFormData.department) {
      const selectedDept = departments.find(d => d.name === lecturerFormData.department);
      if (selectedDept) {
        setDepartmentId(selectedDept._id || selectedDept.id || '');
      }
    } else {
      setDepartmentId('');
    }
  }, [lecturerFormData.department, departments]);

  const handleRoleSelection = async (selectedRole: Role) => {
    if (!user?.id || !user?.emailAddresses[0]?.emailAddress) {
      setError('User information not available. Please sign in again.');
      return;
    }

    if (selectedRole === 'lecturer') {
      setSelectedRole(selectedRole);
      setLecturerFormData(prev => ({
        ...prev,
        email: user.emailAddresses[0].emailAddress,
      }));
      setLecturerStep(0);
      return;
    }

    setLoading(true);
    setError("");
    setSelectedRole(selectedRole);

    try {
      const checkResponse = await fetch(`${BACKEND_URL}/check-role-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const checkData: RoleCheckResponse = await checkResponse.json();
      
      if (!checkData.needsRoleSelection && checkData.role) {
        const currentRole = checkData.role;
        const isChangingRole = currentRole !== selectedRole;
        
        if (isChangingRole) {
          if (!confirm('You already have a role assigned. Are you sure you want to change it? This may affect your existing data.')) {
            setLoading(false);
            return;
          }
        }
      }

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

      const data = await response.json();
      if (data.status === "success") {
        router.replace('/student-registration');
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

  const isLecturerStepValid = () => {
    switch (lecturerStep) {
      case 0:
        return !!lecturerFormData.name;
      case 1:
        return !!lecturerFormData.email;
      case 2:
        return !!lecturerFormData.department;
      case 3:
        return lecturerFormData.courses.length > 0;
      default:
        return false;
    }
  };

  const handleLecturerSubmit = async () => {
    if (!user?.id || !user?.emailAddresses[0]?.emailAddress) {
      setError('User information not available. Please sign in again.');
      return;
    }

    if (!lecturerFormData.name || !lecturerFormData.email || !lecturerFormData.department || lecturerFormData.courses.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const checkResponse = await fetch(`${BACKEND_URL}/check-role-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const checkData: RoleCheckResponse = await checkResponse.json();
      
      if (!checkData.needsRoleSelection && checkData.role && checkData.role !== 'lecturer') {
        if (!confirm('You already have a role assigned. Are you sure you want to change it? This may affect your existing data.')) {
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`${BACKEND_URL}/set-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: lecturerFormData.email,
          name: lecturerFormData.name,
          role: 'lecturer',
          department: lecturerFormData.department,
          courses: lecturerFormData.courses,
        }),
      });

      const data = await response.json();
      if (data.status === "success") {
        console.log('Lecturer role set successfully, redirecting to home');
        router.replace('/home');
      } else {
        console.error('Failed to set lecturer role:', data);
        throw new Error(data.detail || 'Failed to set lecturer role');
      }
    } catch (err) {
      console.error('Error in lecturer role selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to set lecturer role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[linear-gradient(0.115deg,#D2BEE0_0.17%,#FFFFFF_97.16%)] px-5 py-12 text-[#111111] sm:px-8 sm:py-16 lg:px-0 lg:py-0">
      {/* Loading State - Show while checking user data */}
      {isCheckingData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-[#1B2B44] to-[#0F1828] rounded-2xl p-8 shadow-2xl border border-blue-500/20"
          >
            <div className="flex items-center justify-center">
              <div className="relative h-12 w-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#9B5CFF] border-r-[#20D96B]"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#8036C5] border-l-[#A9A1C0]"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Main Content - Show after loading is complete */}
      {!isCheckingData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[1064px]"
        >
        {!selectedRole || selectedRole === 'student' ? (
          <>
            <div className="mb-12 text-center sm:mb-14 lg:mb-[106px]">
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-3 text-[20px] font-medium leading-[1.2] tracking-[-0.02em] text-[#000000] sm:text-[32px]"
              >
                Welcome to VMeet
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-[12px] leading-[1.4] text-[#5B5A5A] sm:text-[24px]"
              >
                Please select your role to continue
              </motion.p>
            </div>

            <div className="mx-auto grid w-full max-w-[474px] grid-cols-1 gap-6 px-0 sm:max-w-none sm:grid-cols-2 sm:gap-8 lg:gap-[116px]">
              {[
                { role: 'student' as const, title: 'Student', icon: '/icons/student.svg', description: 'Join classes and mark your attendance', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700' },
                { role: 'lecturer' as const, title: 'Lecturer', icon: '/icons/lecturer.svg', description: 'Create classes and manage attendance', color: 'bg-green-600', hoverColor: 'hover:bg-green-700' }
              ].map((card, index) => (
                <motion.div
                  key={card.role}
                  initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  onClick={() => setSelectedRole(card.role)}
                  className={`flex min-h-[260px] w-full cursor-pointer flex-col justify-center rounded-[12px] bg-white px-5 py-8 text-center shadow-[0_2px_2px_rgba(128,54,197,0.25)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_9px_22px_rgba(71,42,92,0.16)] sm:min-h-[360px] lg:h-[435px] lg:min-h-0 lg:rounded-[20px] ${selectedRole === card.role ? 'ring-2 ring-[#755DD9] ring-offset-2 ring-offset-[#F5EAF8]' : ''}`}
                >
                  <div className="text-center">
                    <div className={`mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[8px] sm:h-[70px] sm:w-[70px] sm:rounded-[10px] ${card.role === 'student' ? 'bg-[rgba(128,54,197,0.4)]' : 'bg-[rgba(47,99,200,0.33)]'}`}>
                      <Image src={card.icon} alt="" width={29} height={29} className="h-[22px] w-[22px] sm:h-[29px] sm:w-[29px]" />
                    </div>
                    <h3 className="mb-4 text-[20px] font-medium text-[#8036C5] sm:text-[26px]">{card.title}</h3>
                    <p className="mx-auto mb-7 max-w-[280px] text-[13px] leading-[1.35] text-[#000000] sm:text-[20px]">{card.description}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRoleSelection(card.role);
                      }}
                      disabled={loading}
                      className={`mx-auto flex h-[48px] w-full max-w-[230px] items-center justify-center rounded-[8px] px-2 py-1.5 text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-[62px] sm:max-w-[285px] sm:rounded-[10px] sm:text-[20px] bg-[#2A1856] hover:bg-[#41227A] ${loading && selectedRole === card.role ? 'animate-pulse' : ''}`}
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
          </>
        ) : (
          <>
            <div className="mb-10 text-center sm:mb-12">
              <h1 className="text-[24px] font-medium leading-[1.2] text-[#000000] sm:text-[32px]">Complete your Registration</h1>
              <p className="mt-2 text-[13px] text-[#5B5A5A] sm:text-[16px]">Lecturer Registration</p>
            </div>

            {/* Progress Bar */}
            <div className="mx-auto mb-8 h-[16px] w-full max-w-[756px] overflow-hidden rounded-full bg-white shadow-[0_1px_1px_rgba(128,54,197,0.16)] sm:mb-10 sm:h-[23px]">
              <div
                className="h-full rounded-full bg-[#07AF37] transition-all duration-300"
                style={{ width: `${((lecturerStep + 1) / lecturerSteps.length) * 100}%` }}
              ></div>
            </div>

            {/* Step Indicators */}
            <div className="mb-12 flex justify-center gap-3 sm:mb-14">
              {lecturerSteps.map((s, idx) => (
                <div
                  key={s.label}
                  className={`flex h-[42px] w-[42px] items-center justify-center rounded-full text-[20px] font-medium text-white transition-colors sm:h-[58px] sm:w-[58px] sm:text-[32px]
                    ${lecturerStep === idx ? 'bg-[#2A1856]' : 'bg-[#A9A1C0]'}
                    ${idx < lecturerStep ? 'bg-[#8036C5]' : ''}`}
                >
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Form Steps */}
            <div className="mx-auto w-full max-w-[756px]">
              {/* Step 0: Full Name */}
              {lecturerStep === 0 && (
                <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
                  <label className="block text-[16px] font-medium text-white sm:text-[20px]">Full Name</label>
                  <input
                    type="text"
                    value={lecturerFormData.name}
                    onChange={(e) => setLecturerFormData({ ...lecturerFormData, name: e.target.value })}
                    className="mt-3 h-[54px] w-full rounded-[8px] border-2 border-white bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              )}

              {/* Step 1: Email */}
              {lecturerStep === 1 && (
                <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
                  <label className="block text-[16px] font-medium text-white sm:text-[20px]">Email Address</label>
                  <input
                    type="email"
                    value={lecturerFormData.email}
                    onChange={(e) => setLecturerFormData({ ...lecturerFormData, email: e.target.value })}
                    className="mt-3 h-[54px] w-full rounded-[8px] border-2 border-white bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              )}

              {/* Step 2: Department */}
              {lecturerStep === 2 && (
                <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
                  <label className="block text-[16px] font-medium text-white sm:text-[20px]">Department</label>
                  <div className="relative mt-3">
                    <select
                      value={lecturerFormData.department}
                      onChange={(e) => setLecturerFormData({ ...lecturerFormData, department: e.target.value })}
                      className="h-[54px] w-full appearance-none rounded-[8px] border-2 border-white bg-[#8036C5] px-4 pr-12 text-[14px] text-white outline-none focus:bg-[#8D43D2] focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
                      required
                    >
                      <option value="" className="bg-white text-[#5B5A5A]">Select department</option>
                      {departments.length === 0 ? (
                        <option disabled className="bg-white text-[#5B5A5A]">Loading departments...</option>
                      ) : (
                        departments.map(dept => (
                          <option key={dept._id || dept.id} value={dept.name} className="bg-white text-[#2A1856]">
                            {dept.name}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
                  </div>
                </div>
              )}

              {/* Step 3: Select Courses */}
              {lecturerStep === 3 && (
                <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
                  <label className="mb-6 block text-[16px] font-medium text-white sm:text-[20px]">Select Your Courses</label>
                  
                  {/* Selected Courses */}
                  {lecturerFormData.courses.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-3 text-xs text-white/75">Selected Courses ({lecturerFormData.courses.length})</p>
                      <div className="flex flex-wrap gap-3">
                        {courses
                          .filter(c => lecturerFormData.courses.includes(c._id))
                          .map(course => (
                            <div
                              key={`selected-${course._id}`}
                              onClick={() => {
                                setLecturerFormData(prev => ({
                                  ...prev,
                                  courses: (prev.courses || []).filter(id => id !== course._id)
                                }));
                              }}
                              className="relative group"
                            >
                              <div className="rounded-full bg-[#B8E8C6] p-0.5 shadow-[0_3px_8px_rgba(7,175,55,0.2)]">
                                <div className="flex cursor-pointer items-center gap-2 rounded-full bg-[#2A1856] px-4 py-2 transition-colors hover:bg-[#41227A]">
                                  <span className="text-sm font-medium text-white">{course.code}</span>
                                  <X className="h-4 w-4 text-[#B8E8C6] transition-colors group-hover:text-[#FFB4B4]" strokeWidth={2.5} />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Available Courses */}
                  {loadingCourses ? (
                    <div className="text-center py-12">
                      <div className="inline-block">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                      </div>
                      <p className="text-gray-300 mt-3 text-sm">Loading courses...</p>
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-4xl mb-3">📚</div>
                      <p className="text-gray-300">No courses available for this department</p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-3 text-xs text-white/75">Available Courses</p>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                        {courses
                          .filter(c => !lecturerFormData.courses.includes(c._id))
                          .map((course) => (
                            <div
                              key={`available-${course._id}`}
                              onClick={() => {
                                setLecturerFormData(prev => ({
                                  ...prev,
                                  courses: [...(prev.courses || []), course._id]
                                }));
                              }}
                              className="group cursor-pointer rounded-[10px] border border-white/25 bg-white/10 p-4 transition-all hover:-translate-y-0.5 hover:border-white hover:bg-white/20 hover:shadow-[0_5px_12px_rgba(42,24,86,0.15)]"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-white transition-colors group-hover:text-white">
                                    {course.code}
                                  </div>
                                  <div className="text-xs text-white/65">{course.title}</div>
                                </div>
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white/70 transition-colors group-hover:bg-white group-hover:text-[#8036C5]"><Plus className="h-4 w-4" strokeWidth={2.5} /></div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-[10px] bg-red-500/10 p-3 text-center">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-6 flex justify-between gap-3">
                {lecturerStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setLecturerStep(lecturerStep - 1)}
                    className="rounded-[8px] bg-[#A9A1C0] px-5 py-3 text-sm font-medium text-white hover:bg-[#8F86A9]"
                    disabled={loading}
                  >
                    Back
                  </button>
                )}
                {lecturerStep < lecturerSteps.length - 1 && (
                  <button
                    type="button"
                    onClick={() => isLecturerStepValid() && setLecturerStep(lecturerStep + 1)}
                    className={`rounded-[8px] px-7 py-3 text-sm font-medium text-white ${isLecturerStepValid() ? 'bg-[#2A1856] hover:bg-[#41227A]' : 'cursor-not-allowed bg-[#A9A1C0]'}`}
                    disabled={!isLecturerStepValid() || loading}
                  >
                    Next
                  </button>
                )}
                {lecturerStep === lecturerSteps.length - 1 && (
                  <button
                    type="button"
                    onClick={handleLecturerSubmit}
                    disabled={loading || !isLecturerStepValid()}
                    className={`w-full rounded-[8px] p-3 font-medium text-white transition-colors ${
                      loading ? 'cursor-not-allowed bg-[#A9A1C0]' : 'bg-[#2A1856] hover:bg-[#41227A]'
                    }`}
                  >
                    {loading ? 'Setting up...' : 'Complete Registration'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {error && !selectedRole && (
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
      )}
    </div>
  );
}
