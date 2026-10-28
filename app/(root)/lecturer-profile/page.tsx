"use client";

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Loader from '@/components/Loader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { BACKEND_URL } from '@/constants/config';
import Image from 'next/image';

interface LecturerData {
  role: string;
  name: string;
  email: string;
  department: string;
  courses: Array<{
    _id?: string;
    id?: string;
    name: string;
    code: string;
    credits?: number;
  }>;
  profilePicture?: string;
  registeredAt?: string;
  activeSessions?: number;
  totalSessions?: number;
}

interface AvailableCourse {
  _id: string;
  code: string;
  name: string;
  credits?: number;
}

export default function LecturerProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>('');
  const [lecturerData, setLecturerData] = useState<LecturerData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingCourses, setIsEditingCourses] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to load profile data');
        }

        const userData = await response.json();

        // Only allow lecturers to access this page
        if (userData.role !== 'lecturer') {
          toast({
            title: "Access Denied",
            description: "Only lecturers can access this profile page",
            variant: "destructive",
          });
          router.push('/');
          return;
        }

        // Fetch full course details
        let coursesData = userData.courses || [];
        const courseDetailsResponse = await fetch(`${BACKEND_URL}/get-lecturer-courses?userId=${user.id}`);
        if (courseDetailsResponse.ok) {
          const courseDetails = await courseDetailsResponse.json();
          if (courseDetails.status === 'success') {
            coursesData = courseDetails.courses || [];
          }
        }

        setLecturerData({
          role: userData.role,
          name: userData.name || user?.firstName || '',
          email: userData.email || user?.emailAddresses?.[0]?.emailAddress || '',
          department: userData.department || '',
          courses: coursesData,
          registeredAt: userData.registeredAt,
          activeSessions: userData.roleData?.activeSessions || 0,
          totalSessions: userData.roleData?.totalSessions || 0,
          profilePicture: userData.profilePicture || user?.imageUrl || '',
        });

        // Initialize selected courses
        setSelectedCourses((coursesData || []).map((c: any) => c.id || c._id || ''));

        // Set form data for editing
        setFormData({
          name: userData.name || '',
          email: userData.email || '',
          department: userData.department || '',
        });

        // Lecturers can update their profile photo anytime.

        // Fetch available courses
        const coursesListResponse = await fetch(`${BACKEND_URL}/courses?limit=1000`);
        if (coursesListResponse.ok) {
          const coursesList = await coursesListResponse.json();
          if (coursesList.data) {
            // Filter courses by lecturer's department
            const lecturerDept = userData.department;
            const filteredCourses = coursesList.data.filter((course: any) => 
              course.departmentName === lecturerDept || 
              course.department === lecturerDept
            );
            setAvailableCourses(filteredCourses);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: "Error",
          description: "Failed to load your profile data. Please try again.",
          variant: "destructive"
        });
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id, router, toast]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setMessage("❌ Please upload an image file");
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setMessage("❌ Image size should be less than 5MB");
        return;
      }
      setFile(selectedFile);
      setMessage('Image selected. Click "Upload Photo" to save changes.');
    }
  };

  const startCamera = async () => {
    try {
      setShowCamera(true);
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      setMessage('❌ Could not access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
            setFile(file);
            setMessage('Photo captured. Click "Upload Photo" to save changes.');
          }
        }, 'image/jpeg', 0.8);
      }

      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const cancelCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    setShowCamera(false);
    setMessage('');
  };

  const handleUploadPhoto = async () => {
    if (!file || !user?.id) {
      setMessage("❌ No image selected");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setMessage("Uploading profile photo...");
      const formDataToSend = new FormData();
      formDataToSend.append('userId', user.id);
      formDataToSend.append('file', file);

      const response = await fetch(`${BACKEND_URL}/upload-profile-image`, {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload profile photo');
      }

      setMessage("✅ Profile photo updated successfully!");
      setFile(null);
      toast({
        title: "Success",
        description: "Your profile photo has been updated",
      });

      // Reload profile data
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage(`❌ ${error instanceof Error ? error.message : 'Failed to upload photo'}`);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourses(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  const handleSaveCourses = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return;
    }

    setLoadingCourses(true);
    setMessage("Updating courses...");

    try {
      const response = await fetch(`${BACKEND_URL}/update-lecturer-courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          courses: selectedCourses,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update courses');
      }

      setMessage("✅ Courses updated successfully!");
      setIsEditingCourses(false);
      toast({
        title: "Success",
        description: "Your courses have been updated",
      });

      // Reload profile data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error updating courses:', error);
      setMessage(`❌ ${error instanceof Error ? error.message : 'Failed to update courses'}`);
      toast({
        title: "Error",
        description: "Failed to update courses",
        variant: "destructive",
      });
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name || !formData.email || !formData.department) {
      setMessage("❌ Please fill in all required fields");
      return;
    }

    setLoading(true);
    setMessage("Updating your profile...");

    try {
      const response = await fetch(`${BACKEND_URL}/update-lecturer-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          name: formData.name,
          email: formData.email,
          department: formData.department,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update profile');
      }

      setMessage("✅ Profile updated successfully!");
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Your profile has been updated",
      });

      // Reload profile data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage(`❌ ${error instanceof Error ? error.message : 'Failed to update profile'}`);
      toast({
        title: "Error",
        description: "Failed to update your profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F1FA] p-4">
        <div className="rounded-[28px] bg-white/80 p-8 shadow-[0_20px_50px_rgba(105,73,152,0.12)] backdrop-blur-sm">
          <Loader />
          <p className="mt-4 text-center text-sm font-medium text-[#473A52]">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!lecturerData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F4F1FA] px-4 pb-10 pt-6 text-[#1E1329] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
              message.includes('✅')
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : message.includes('❌')
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-violet-200 bg-violet-50 text-violet-700'
            }`}
          >
            {message}
          </div>
        )}

        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#5D2F8F] via-[#7437C7] to-[#A96BE8] px-5 py-6 text-white shadow-[0_18px_40px_rgba(105,63,150,0.22)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),transparent_35%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100/80">Lecturer profile</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                Welcome back, {lecturerData.name.split(' ')[0] || 'Lecturer'}
              </h1>
              <p className="mt-3 max-w-lg text-sm text-violet-100/85 sm:text-base">
                Manage your academic identity, review teaching activity, and keep your course list aligned with your department.
              </p>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white/35 bg-white/10 shadow-[0_12px_24px_rgba(19,10,29,0.22)] backdrop-blur-sm sm:h-24 sm:w-24">
                {lecturerData.profilePicture && !imageError ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={lecturerData.profilePicture}
                      alt={lecturerData.name}
                      fill
                      className="object-cover"
                      onError={() => setImageError(true)}
                    />
                  </div>
                ) : (
                  <span className="text-3xl font-bold text-white sm:text-4xl">
                    {lecturerData.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Active sessions', value: lecturerData.activeSessions || 0 },
              { label: 'Total sessions', value: lecturerData.totalSessions || 0 },
              { label: 'Department', value: lecturerData.department || 'N/A' },
              { label: 'Courses', value: lecturerData.courses.length || 0 },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-violet-100/75">{stat.label}</p>
                <p className="mt-3 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-[#E6DDF5] bg-white p-5 shadow-[0_16px_32px_rgba(61,35,88,0.08)] sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B9B]">Profile details</p>
                  <h2 className="mt-1 text-xl font-bold text-[#2A1737]">Personal information</h2>
                </div>
                {!isEditing && (
                  <Button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="bg-[#7C3AED] text-white hover:bg-[#6930D8]"
                  >
                    Edit profile
                  </Button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#584C63]">Name</label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="border-[#DED3F0] bg-[#F8F3FF] text-[#2A1737] placeholder:text-[#7E6E8F] focus-visible:ring-[#8B5CF6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#584C63]">Email</label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="border-[#DED3F0] bg-[#F8F3FF] text-[#2A1737] placeholder:text-[#7E6E8F] focus-visible:ring-[#8B5CF6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#584C63]">Department</label>
                    <Input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="border-[#DED3F0] bg-[#F8F3FF] text-[#2A1737] placeholder:text-[#7E6E8F] focus-visible:ring-[#8B5CF6]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <Button type="submit" className="bg-[#2FB67F] text-white hover:bg-[#259A6E]">
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: lecturerData.name,
                          email: lecturerData.email,
                          department: lecturerData.department,
                        });
                      }}
                      className="border-[#D7CBEA] bg-white text-[#3A2A48] hover:bg-[#F6F0FF]"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#F8F2FF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#7A5B9B]">Name</p>
                    <p className="mt-2 text-base font-semibold text-[#2A1737]">{lecturerData.name}</p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F2FF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#7A5B9B]">Email</p>
                    <p className="mt-2 break-all text-base font-semibold text-[#2A1737]">{lecturerData.email}</p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F2FF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#7A5B9B]">Department</p>
                    <p className="mt-2 text-base font-semibold text-[#2A1737]">{lecturerData.department}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#E6DDF5] bg-white p-5 shadow-[0_16px_32px_rgba(61,35,88,0.08)] sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B9B]">Teaching</p>
                  <h2 className="mt-1 text-xl font-bold text-[#2A1737]">
                    My courses ({lecturerData?.courses.length || 0})
                  </h2>
                </div>
                {!isEditingCourses && (
                  <Button
                    type="button"
                    onClick={() => setIsEditingCourses(true)}
                    className="bg-[#7C3AED] text-white hover:bg-[#6930D8]"
                  >
                    Edit courses
                  </Button>
                )}
              </div>

              {isEditingCourses ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                    Showing courses for <span className="font-semibold">{lecturerData.department}</span>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-[#E8E1F3] bg-[#FAF7FF] p-3">
                    {availableCourses.length > 0 ? (
                      <div className="space-y-2">
                        {availableCourses.map((course) => (
                          <label
                            key={course._id}
                            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-transparent bg-white px-3 py-3 transition hover:border-violet-200 hover:bg-violet-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCourses.includes(course._id)}
                              onChange={() => handleCourseToggle(course._id)}
                              className="h-4 w-4 rounded border-[#B99FDD] accent-[#7C3AED]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#2A1737]">{course.code}</p>
                              <p className="mt-1 line-clamp-2 text-sm text-[#645C6F]">{course.name}</p>
                            </div>
                            {course.credits && (
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">
                                {course.credits} credits
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="py-10 text-center text-sm text-[#6D6277]">No courses are available for your department yet.</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={handleSaveCourses}
                      className="bg-[#2FB67F] text-white hover:bg-[#259A6E]"
                      disabled={loadingCourses}
                    >
                      {loadingCourses ? 'Saving...' : 'Save courses'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditingCourses(false);
                        setSelectedCourses((lecturerData?.courses || []).map(c => c.id || c._id || ''));
                      }}
                      className="border-[#D7CBEA] bg-white text-[#3A2A48] hover:bg-[#F6F0FF]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {lecturerData.courses.length > 0 ? (
                    lecturerData.courses.map((course, index) => (
                      <div
                        key={index}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-[#EDE4F9] bg-[#FAF7FF] p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#2A1737]">{course.code}</p>
                          <p className="mt-1 text-sm text-[#675E71]">{course.name}</p>
                        </div>
                        {course.credits && (
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">
                            {course.credits}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#DCCBF0] bg-[#F8F3FF] p-8 text-center text-sm text-[#6D6277]">
                      No courses assigned yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-[#E6DDF5] bg-white p-5 shadow-[0_16px_32px_rgba(61,35,88,0.08)] sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B9B]">Profile photo</p>
                  <h2 className="mt-1 text-xl font-bold text-[#2A1737]">Appearance</h2>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="relative h-32 w-32 overflow-hidden rounded-full border-[5px] border-violet-200 bg-gradient-to-br from-violet-200 via-violet-100 to-white shadow-[0_18px_36px_rgba(124,58,237,0.18)] sm:h-36 sm:w-36">
                  {lecturerData.profilePicture && !imageError ? (
                    <Image
                      src={lecturerData.profilePicture}
                      alt={lecturerData.name}
                      fill
                      className="object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-violet-700">
                      {lecturerData.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                  {!showCamera ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <Button type="button" onClick={startCamera} className="bg-[#7C3AED] text-white hover:bg-[#6930D8]">
                        Take photo
                      </Button>
                      <Button
                        type="button"
                        onClick={() => document.getElementById('file-input')?.click()}
                        variant="outline"
                        className="border-[#D7CBEA] bg-white text-[#3A2A48] hover:bg-[#F6F0FF]"
                      >
                        Upload photo
                      </Button>
                      <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <video ref={videoRef} autoPlay className="h-52 w-full rounded-2xl bg-[#120E19] object-cover" />
                      <div className="flex justify-center gap-2">
                        <Button type="button" onClick={capturePhoto} className="bg-[#2FB67F] text-white hover:bg-[#259A6E]">
                          Capture
                        </Button>
                        <Button type="button" onClick={cancelCamera} variant="outline" className="border-[#D7CBEA] bg-white text-[#3A2A48] hover:bg-[#F6F0FF]">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {file && (
                    <Button
                      type="button"
                      onClick={handleUploadPhoto}
                      disabled={isUploadingPhoto}
                      className="w-full bg-[#2FB67F] text-white hover:bg-[#259A6E] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isUploadingPhoto ? 'Saving photo...' : 'Upload photo'}
                    </Button>
                  )}
                </div>
            </div>

            <div className="rounded-[28px] border border-[#E6DDF5] bg-gradient-to-br from-[#F7F1FF] via-white to-[#F3EEF9] p-5 shadow-[0_16px_32px_rgba(61,35,88,0.08)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B9B]">Quick actions</p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => router.push('/home')}
                  className="w-full rounded-2xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6930D8]"
                >
                  Back to dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full rounded-2xl border border-[#D7CBEA] bg-white px-4 py-3 text-sm font-semibold text-[#382947] transition hover:bg-[#F5EEFF]"
                >
                  Update profile info
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
