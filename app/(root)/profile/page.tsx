"use client";

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Loader from '@/components/Loader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { BACKEND_URL } from '@/constants/config';

interface FormData {
  name: string;
  matricNumber: string;
  department: string;
  level: string;
  courses?: string[];
}

interface Course {
  _id: string;
  code: string;
  title: string;
  credits?: number;
}

interface UserData {
  role: string;
  isRegistered: boolean;
  roleData?: { registrationComplete?: boolean };
  matricNumber?: string;
  department?: string;
  level?: string;
  name?: string;
  courses?: Array<string | Course>;
  lastProfilePicUpdate?: string; // ISO date string from backend
  lastCoursesUpdate?: string; // ISO date string from backend
}

export default function ProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    matricNumber: '',
    department: '',
    level: '',
    courses: [],
  });
  const [canUpdatePhoto, setCanUpdatePhoto] = useState(true);
  const [lastProfilePicUpdate, setLastProfilePicUpdate] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [canUpdateCourses, setCanUpdateCourses] = useState(true);
  const [lastCoursesUpdate, setLastCoursesUpdate] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [levelId, setLevelId] = useState<string>('');
  const [departments, setDepartmentsList] = useState<any[]>([]);
  const [levels, setLevelsList] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to load profile data');
        }

        const userData: UserData = await response.json();

        // Check last profile pic update
        if (userData.lastProfilePicUpdate) {
          setLastProfilePicUpdate(userData.lastProfilePicUpdate);
          const lastUpdate = new Date(userData.lastProfilePicUpdate);
          const now = new Date();
          const diffDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays < 30) {
            setCanUpdatePhoto(false);
          } else {
            setCanUpdatePhoto(true);
          }
        } else {
          setCanUpdatePhoto(true);
        }

        // Check last courses update
        if (userData.lastCoursesUpdate) {
          setLastCoursesUpdate(userData.lastCoursesUpdate);
          const lastUpdate = new Date(userData.lastCoursesUpdate);
          const now = new Date();
          const diffDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays < 30) {
            setCanUpdateCourses(false);
          } else {
            setCanUpdateCourses(true);
          }
        } else {
          setCanUpdateCourses(true);
        }

        if (userData.role === 'student') {
          const isRegistered = userData.isRegistered;
          const registrationComplete = userData.roleData?.registrationComplete;

          if (!isRegistered || !registrationComplete) {
            toast({
              title: "Registration Required",
              description: "Please complete your student registration first. You need to provide:\n- Face Photo\n- Full Name\n- Matric Number\n- Department\n- Level",
              variant: "destructive",
            });
            router.push('/student-registration');
            return;
          }

          // If properly registered, set form data
          console.log('User data loaded:', userData);
          console.log('Courses from userData:', userData.courses);
          
          // Extract course IDs from the courses array (which contains full course objects)
          const courseIds = userData.courses?.map((course) =>
            typeof course === 'string' ? course : course._id
          ) || [];
          
          // Initialize courses state with the full course data from backend
          if (userData.courses && Array.isArray(userData.courses) && userData.courses.length > 0) {
            setCourses(userData.courses.filter((course): course is Course => typeof course !== 'string'));
          }
          
          setFormData({
            matricNumber: userData.matricNumber || '',
            department: userData.department || '',
            level: userData.level || '',
            name: userData.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : ''),
            courses: courseIds,
          });
        } else {
          // If not a student, show error and redirect
          toast({
            title: "Access Denied",
            description: "Only students can access the profile page",
            variant: "destructive",
          });
          router.push('/');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: "Error",
          description: "Failed to load your profile data. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id, router, user?.firstName, user?.lastName, toast]);

  // Fetch departments and levels on mount
  useEffect(() => {
    const fetchDepartmentsAndLevels = async () => {
      try {
        const deptResponse = await fetch(`${BACKEND_URL}/departments?limit=1000`);
        const deptData = await deptResponse.json();
        if (deptData.data) {
          setDepartmentsList(deptData.data);
        }

        const levelResponse = await fetch(`${BACKEND_URL}/levels?limit=1000`);
        const levelData = await levelResponse.json();
        if (levelData.data) {
          setLevelsList(levelData.data);
        }
      } catch (error) {
        console.error('Error fetching departments/levels:', error);
      }
    };

    fetchDepartmentsAndLevels();
  }, []);

  // Update department ID when department in form data changes
  useEffect(() => {
    if (formData.department) {
      const selectedDept = departments.find(d => d.name === formData.department);
      if (selectedDept) {
        setDepartmentId(selectedDept._id || selectedDept.id);
      }
    } else {
      setDepartmentId('');
    }
  }, [formData.department, departments]);

  // Update level ID when level in form data changes
  useEffect(() => {
    if (formData.level) {
      const selectedLevel = levels.find(l => String(l.code) === formData.level);
      if (selectedLevel) {
        setLevelId(selectedLevel._id || selectedLevel.id);
      }
    } else {
      setLevelId('');
    }
  }, [formData.level, levels]);

  // Fetch courses when department and level IDs are available
  useEffect(() => {
    const fetchCourses = async () => {
      if (!departmentId || !levelId) {
        setCourses([]);
        return;
      }

      try {
        setLoadingCourses(true);
        const coursesResponse = await fetch(
          `${BACKEND_URL}/courses?department_id=${departmentId}&level_id=${levelId}&limit=1000`
        );
        const coursesData = await coursesResponse.json();
        
        if (coursesData.data && Array.isArray(coursesData.data)) {
          console.log('Fetched courses from API:', coursesData.data);
          setCourses(coursesData.data);
        } else {
          setCourses([]);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [departmentId, levelId]);

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

    if (!formData.matricNumber || !formData.department || !formData.level || !formData.name) {
      setMessage("❌ Please fill in all required fields");
      return;
    }

    setLoading(true);
    setMessage("Updating your profile...");

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('userId', user.id);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('matricNumber', formData.matricNumber);
      formDataToSend.append('department', formData.department);
      formDataToSend.append('level', formData.level);
      
      if (file) {
        formDataToSend.append('file', file);
      }

      // First upload the image if provided
      if (file) {
        console.log('[Update] Uploading face image...');
        const imageResponse = await fetch(`${BACKEND_URL}/upload-face-image`, {
          method: 'POST',
          body: formDataToSend,
        });

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json();
          throw new Error(errorData.detail || 'Failed to upload face image');
        }
      }

      // Then update the profile
      console.log('[Update] Saving profile info...');
      const updateResponse = await fetch(`${BACKEND_URL}/register-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          matricNumber: formData.matricNumber,
          department: formData.department,
          level: formData.level,
          name: formData.name,
          courses: formData.courses || [],
          isUpdate: true
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.detail || 'Failed to update profile');
      }

      setMessage("✅ Profile updated successfully!");
      toast({
        title: "Success",
        description: "Your profile has been updated successfully",
      });
    } catch (error) {
      console.error('[Update] Error:', error);
      setMessage(`❌ ${error instanceof Error ? error.message : 'Failed to update profile. Please try again.'}`);
      toast({
        title: "Error",
        description: "Failed to update your profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert the canvas content to a file
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
            setFile(file);
          }
        }, 'image/jpeg', 0.8);
      }
      
      // Stop the camera stream
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
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#F5EFFB] via-white to-[#F1EAFF] p-4">
        <Loader />
        <p className="mt-4 text-sm text-[#5F526A]">Loading your profile...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5EFFB] via-white to-[#F1EAFF] px-4 pb-10 pt-16 text-[#18121F] sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7630B8] via-[#8234C6] to-[#A14EDD] px-6 py-7 text-white shadow-[0_12px_25px_rgba(99,44,148,0.22)] sm:rounded-[40px] sm:px-10 sm:py-9">
          <div className="absolute inset-0 bg-gradient-to-r from-[#6E27AE]/70 via-transparent to-[#A14EDD]/50" />
          <div className="relative z-10 max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/75">Your account</p>
            <h1 className="text-3xl font-semibold sm:text-[38px]">Update your profile</h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">Manage your student information, courses, and face photo.</p>
          </div>
        </header>
        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[0.85fr_1.5fr]">
          {/* Face Image Section */}
          <section className="h-fit rounded-2xl border border-[#E7DDF0] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-1 text-lg font-semibold text-[#2D1A3A]">Face photo</h2>
            <p className="mb-5 text-sm text-[#6B6172]">Use a clear photo so your face can be recognized.</p>
            {!canUpdatePhoto && lastProfilePicUpdate && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
                You can only update your profile picture once every 30 days.<br />
                Last updated: {new Date(lastProfilePicUpdate).toLocaleDateString()}<br />
                Please try again after 30 days from your last update.
              </div>
            )}
            {showCamera ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-xl border border-[#E7DDF0] bg-slate-950"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="bg-[#8437C8] text-white hover:bg-[#6E27AE]"
                    disabled={!canUpdatePhoto}
                  >
                    Capture
                  </Button>
                  <Button
                    type="button"
                    onClick={cancelCamera}
                    variant="destructive"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {file ? (
                  <div className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      className="h-56 w-full rounded-xl border border-[#E7DDF0] object-cover"
                    />
                    <Button
                      type="button"
                      onClick={() => setFile(null)}
                      variant="destructive"
                      className="absolute right-2 top-2"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      onClick={startCamera}
                      className="w-full bg-[#8437C8] text-white hover:bg-[#6E27AE]"
                      disabled={!canUpdatePhoto}
                    >
                      Take Photo
                    </Button>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        disabled={!canUpdatePhoto}
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        variant="outline"
                        className="w-full border-[#DCC9EA] bg-white text-[#6E27AE] hover:bg-[#F6F0FB]"
                        disabled={!canUpdatePhoto}
                      >
                        Upload Photo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Profile Information */}
          <section className="space-y-5 rounded-2xl border border-[#E7DDF0] bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-[#2D1A3A]">Profile information</h2>
              <p className="mt-1 text-sm text-[#6B6172]">Review your details and manage your enrolled courses.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#5F526A]">Full name</label>
              <Input
                type="text"
                value={formData.name}
                readOnly
                className="mt-1 border-[#E7DDF0] bg-[#F8F5FB] text-[#6B6172] disabled:opacity-100"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#5F526A]">Matric number</label>
              <Input
                type="text"
                value={formData.matricNumber}
                readOnly
                className="mt-1 border-[#E7DDF0] bg-[#F8F5FB] text-[#6B6172] disabled:opacity-100"
                placeholder="Enter your matric number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#5F526A]">Department</label>
              <Input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="mt-1 border-[#E7DDF0] bg-white text-[#2D1A3A] focus-visible:ring-[#8437C8]"
                placeholder="Enter your department"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#5F526A]">Level</label>
              <Input
                type="text"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="mt-1 border-[#E7DDF0] bg-white text-[#2D1A3A] focus-visible:ring-[#8437C8]"
                placeholder="Enter your level"
              />
            </div>

            {/* Courses Section */}
            <div className="border-t border-[#EEE6F4] pt-5">
              <label className="mb-3 block text-sm font-semibold text-[#5F526A]">Your courses ({formData.courses?.length || 0})</label>
              {!canUpdateCourses && lastCoursesUpdate && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
                  You can only update your courses once every 30 days.<br />
                  Last updated: {new Date(lastCoursesUpdate).toLocaleDateString()}<br />
                  Please try again after 30 days from your last update.
                </div>
              )}
              {loadingCourses ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-[#6B6172]">Loading courses...</p>
                </div>
              ) : (
                <>
                  {/* Selected Courses Display */}
                  {formData.courses && formData.courses.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-3 text-xs font-medium text-[#6B6172]">Selected courses ({formData.courses.length})</p>
                      <div className="flex flex-wrap gap-3">
                        {courses
                          .filter(c => formData.courses?.includes(c._id))
                          .map(course => (
                            <div
                              key={`selected-${course._id}`}
                              onClick={() => {
                                if (canUpdateCourses) {
                                  setFormData(prev => ({
                                    ...prev,
                                    courses: (prev.courses || []).filter(id => id !== course._id)
                                  }));
                                }
                              }}
                              className={`group relative ${!canUpdateCourses ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              <div className="rounded-full bg-gradient-to-r from-[#8437C8] to-[#A14EDD] p-px">
                                <div className={`flex items-center gap-2 rounded-full bg-white px-4 py-2 transition-colors ${canUpdateCourses ? 'cursor-pointer hover:bg-[#F6F0FB]' : ''}`}>
                                  <span className="text-sm font-medium text-[#6E27AE]">{course.code}</span>
                                  {canUpdateCourses && (
                                    <span className="text-xl text-[#8437C8] transition-colors group-hover:text-red-500">×</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Available Courses */}
                  {courses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#DCC9EA] bg-[#FBF9FD] py-10 text-center">
                      <div className="mb-3 text-4xl">📚</div>
                      <p className="text-[#5F526A]">No courses available for this department and level</p>
                      {formData.courses && formData.courses.length > 0 && (
                        <p className="mt-2 text-sm text-[#6B6172]">Your previously selected courses are still saved</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="mb-3 text-xs font-medium text-[#6B6172]">Available courses</p>
                      <div className={`max-h-80 space-y-2 overflow-y-auto pr-2 ${!canUpdateCourses ? 'pointer-events-none opacity-60' : ''}`}>
                        {courses
                          .filter(c => !formData.courses?.includes(c._id))
                          .map((course) => (
                            <div
                              key={`available-${course._id}`}
                              onClick={() => {
                                if (canUpdateCourses) {
                                  setFormData(prev => ({
                                    ...prev,
                                    courses: [...(prev.courses || []), course._id]
                                  }));
                                }
                              }}
                              className={`group rounded-lg border border-[#E7DDF0] bg-[#FBF9FD] p-3 transition-all ${canUpdateCourses ? 'cursor-pointer hover:border-[#C7A6E2] hover:bg-[#F6F0FB]' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-[#4F3D5D] transition-colors group-hover:text-[#6E27AE]">
                                    {course.code}
                                  </div>
                                  <div className="text-xs text-[#6B6172]">{course.title}</div>
                                </div>
                                {canUpdateCourses && (
                                  <div className="text-xl text-[#8437C8] transition-colors">+</div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {message && (
            <div role="status" className={`rounded-lg border p-3 text-center text-sm lg:col-span-2 ${
              message.startsWith('✅') ? 'border-green-200 bg-green-50 text-green-800' :
              message.startsWith('❌') ? 'border-red-200 bg-red-50 text-red-800' :
              'border-[#DCC9EA] bg-[#F6F0FB] text-[#6E27AE]'
            }`}>
              {message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#8437C8] text-white hover:bg-[#6E27AE] lg:col-span-2"
            disabled={loading}
          >
            {loading ? <Loader /> : 'Update Profile'}
          </Button>
        </form>
      </div>
    </main>
  );
}
