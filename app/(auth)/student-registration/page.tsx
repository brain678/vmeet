"use client";
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useState, useEffect, type FormEvent } from 'react';
import { BACKEND_URL } from '@/constants/config';
import FaceCheckModule from '@/components/FaceCheckModule';
import { ChevronDown, Plus, X } from 'lucide-react';

interface FormData {
  name: string;
  matricNumber: string;
  department: string;
  level: string;
  courses: string[];
}

interface Course {
  _id: string;
  code: string;
  title: string;
  credits: number;
}

interface UserData {
  role: string;
  isRegistered: boolean;
  matricNumber?: string;
  department?: string;
  level?: string;
  name?: string;
  isUpdate?: boolean;
}

const steps = [
  { label: 'Full Name', field: 'name' },
  { label: 'Matric Number', field: 'matricNumber' },
  { label: 'Department', field: 'department' },
  { label: 'Level', field: 'level' },
  { label: 'Select Courses', field: 'courses' },
  { label: 'Face Image', field: 'file' },
];

// Removed hardcoded departments array - now using API data

const StudentRegistration = () => {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [studentData, setStudentData] = useState<UserData | null>(null);
  const [step, setStep] = useState<number>(0);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    matricNumber: '',
    department: '',
    level: '',
    courses: [],
  });
  // Check for existing registration and initialize form data
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        const userData = await response.json();
        setStudentData(userData);

        // Check if we're on the update path
        const isOnUpdatePath = location.pathname.includes('update');

        if (userData.role === 'student') {
          if (userData.isRegistered) {
            // If user is registered, set update mode and pre-fill form
            setIsUpdating(true);
            setFormData({
              matricNumber: userData.matricNumber || '',
              department: userData.department || '',
              level: userData.level || '',
              name: userData.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : ''),
              courses: [],
            });
          } else if (isOnUpdatePath) {
            // If trying to update but not registered
            setMessage("❌ You need to register first before updating your profile.");
            router.push('/student-registration');
          }
        }
      } catch (error) {
        console.error('Error checking registration:', error);
        setMessage("❌ Error loading your profile data. Please try again.");
      }
    };

    checkRegistration();
  }, [user?.id, router]);

  // Check if user is already registered
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        const userData = await response.json();

        if (userData.role === 'student') {
          if (userData.isRegistered) {
            setIsUpdating(true);
            // Pre-fill form data with existing values
            setFormData(prevData => ({
              ...prevData,
              matricNumber: userData.matricNumber || prevData.matricNumber,
              department: userData.department || prevData.department,
              level: userData.level || prevData.level,
              name: userData.name || prevData.name
            }));
          }
        }
      } catch (error) {
        console.error('Error checking registration:', error);
        setMessage('❌ Error checking registration status');
      }
    };

    checkRegistration();
  }, [user?.id]);

  // State to store department and level IDs for API calls
  const [departmentId, setDepartmentId] = useState<string>('');
  const [levelId, setLevelId] = useState<string>('');
  const [departments, setDepartmentsList] = useState<any[]>([]);
  const [levels, setLevelsList] = useState<any[]>([]);

  // Fetch departments and levels on mount
  useEffect(() => {
    const fetchDepartmentsAndLevels = async () => {
      try {
        // Fetch all departments
        const deptResponse = await fetch(`${BACKEND_URL}/departments?limit=1000`);
        const deptData = await deptResponse.json();
        if (deptData.data) {
          setDepartmentsList(deptData.data);
        }

        // Fetch all levels
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

  // Update department ID when department selection changes
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

  // Update level ID when level selection changes
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
        
        // Fetch courses for this department and level
        const coursesResponse = await fetch(
          `${BACKEND_URL}/courses?department_id=${departmentId}&level_id=${levelId}&limit=1000`
        );
        const coursesData = await coursesResponse.json();
        
        if (coursesData.data && Array.isArray(coursesData.data)) {
          setCourses(coursesData.data);
          // Reset selected courses when fetching new courses
          setFormData(prev => ({ ...prev, courses: [] }));
        } else {
          setCourses([]);
          setFormData(prev => ({ ...prev, courses: [] }));
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
        setMessage("❌ Error loading courses. Please try again.");
        setCourses([]);
        setFormData(prev => ({ ...prev, courses: [] }));
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [departmentId, levelId]);

  // Step validation
  const isStepValid = () => {
    switch (step) {
      case 0:
        return !!formData.name;
      case 1:
        return !!formData.matricNumber;
      case 2:
        return !!formData.department;
      case 3:
        return !!formData.level;
      case 4:
        return formData.courses.length > 0;
      case 5:
        return !!file;
      default:
        return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!file) {
      setMessage("❌ Please capture or upload your face image");
      return;
    }
    if (!formData.matricNumber || !formData.department || !formData.level || !formData.name) {
      setMessage("❌ Please fill in all required fields");
      return;
    }
    if (formData.courses.length === 0) {
      setMessage("❌ Please select at least one course");
      return;
    }
    
    // Handle registration/update logic
    if (!isUpdating && studentData?.isRegistered) {
      setMessage("❌ You are already registered. Please use the update profile option instead.");
      router.push('/');
      return;
    } else if (isUpdating && !studentData?.isRegistered) {
      setMessage("❌ You need to register first before updating your profile.");
      router.push('/student-registration');
      return;
    }
    
    setLoading(true);
    setProgress(10);
    setMessage(isUpdating ? "Updating your profile..." : "Processing your registration... 10%");

    try {
      // Show the correct action in console logs
      console.log(`[${isUpdating ? 'Update' : 'Registration'}] Starting...`);
      const imageFormData = new FormData();
      imageFormData.append('userId', user?.id || '');
      imageFormData.append('name', formData.name);
      imageFormData.append('matric', formData.matricNumber);
      imageFormData.append('department', formData.department);
      imageFormData.append('file', file);      console.log(`[${isUpdating ? 'Update' : 'Registration'}] Uploading face image...`);
      const imageResponse = await fetch(`${BACKEND_URL}/upload-face-image`, {
        method: 'POST',
        body: imageFormData,
      });

      setProgress(40);
      setMessage(isUpdating ? 'Updating your profile... 40%' : 'Processing your registration... 40%');

      if (!imageResponse.ok) {
        const errorData = await imageResponse.json();
        throw new Error(errorData.detail || 'Failed to upload face image');
      }

      console.log(`[${isUpdating ? 'Update' : 'Registration'}] Saving student info...`);
      setProgress(70);
      setMessage(isUpdating ? 'Updating your profile... 70%' : 'Processing your registration... 70%');

      const registrationResponse = await fetch(`${BACKEND_URL}/register-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          matricNumber: formData.matricNumber,
          department: formData.department,
          level: formData.level,
          name: formData.name,
          courses: formData.courses,
          isUpdate: isUpdating
        }),
      });

      if (!registrationResponse.ok) {
        const errorData = await registrationResponse.json();
        throw new Error(errorData.detail || `Failed to ${isUpdating ? 'update profile' : 'complete registration'}`);
      }

      setProgress(100);
      setMessage(`✅ ${isUpdating ? 'Profile updated' : 'Registration completed'} successfully! Redirecting...`);
      console.log(`[${isUpdating ? 'Update' : 'Registration'}] Successful`);
      setTimeout(() => router.push('/home'), 1500);
    } catch (error) {
      console.error(`[${isUpdating ? 'Update' : 'Registration'}] Error:`, error);
      setMessage(`❌ ${error instanceof Error ? error.message : `${isUpdating ? 'Profile update' : 'Registration'} failed. Please try again.`}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(0.115deg,#D2BEE0_0.17%,#FFFFFF_97.16%)] px-4 py-10 text-[#111111] sm:px-8 sm:py-14">
      <div className="mx-auto w-full max-w-[756px]">
        <h1 className="mb-10 text-center text-[24px] font-medium leading-[1.2] text-[#000000] sm:mb-12 sm:text-[32px]">
          {isUpdating ? 'Update Your Profile' : 'Complete Your Registration'}
        </h1>
        {/* Progress Bar */}
        <div className="mb-8 h-[16px] w-full overflow-hidden rounded-full bg-white shadow-[0_1px_1px_rgba(128,54,197,0.16)] sm:mb-10 sm:h-[23px]">
          <div
            className="h-full rounded-full bg-[#07AF37] transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
        {loading && progress > 0 && (
          <div className="mb-4 text-right text-xs text-[#5B5A5A]">
            Registration progress: {progress}%
          </div>
        )}
        <div className="mb-12 flex justify-center gap-2 sm:mb-14 sm:gap-3">
          {steps.map((s, idx) => (
            <div
              key={s.label}
              className={`flex h-[42px] w-[42px] items-center justify-center rounded-full text-[20px] font-medium text-white transition-colors sm:h-[58px] sm:w-[58px] sm:text-[32px]
                ${step === idx ? 'bg-[#2A1856]' : 'bg-[#A9A1C0]'}
                ${idx < step ? 'bg-[#8036C5]' : ''}`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step Content */}
          {step === 0 && (
            <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
              <label className="block text-[16px] font-medium text-white sm:text-[20px]">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-3 h-[54px] w-full rounded-[8px] border-2 border-white bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
                required
              />
            </div>
          )}
          {step === 1 && (
            <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
              <label className="block text-[16px] font-medium text-white sm:text-[20px]">Matric Number</label>
              <input
                type="text"
                value={formData.matricNumber}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 11) setFormData(prev => ({ ...prev, matricNumber: val }));
                }}
                className="mt-3 h-[54px] w-full rounded-[8px] border-2 border-white bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
                required
                maxLength={11}
                pattern="\\d{11}"
                placeholder="Enter 11-digit Matric Number"
              />
              <span className="mt-2 block text-xs text-white/75">Matric number must be exactly 11 digits.</span>
            </div>
          )}
          {step === 2 && (
            <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
              <label className="block text-[16px] font-medium text-white sm:text-[20px]">Department</label>
              <div className="relative mt-3">
                <select
                  value={formData.department}
                  onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  className="h-[54px] w-full appearance-none rounded-[8px] border-2 border-white bg-[#8036C5] px-4 pr-12 text-[14px] text-white outline-none transition-colors focus:bg-[#8D43D2] focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
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
          {step === 3 && (
            <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
              <label className="block text-[16px] font-medium text-white sm:text-[20px]">Level</label>
              <div className="relative mt-3">
                <select
                  value={formData.level}
                  onChange={e => setFormData(prev => ({ ...prev, level: e.target.value }))}
                  className="h-[54px] w-full appearance-none rounded-[8px] border-2 border-white bg-[#8036C5] px-4 pr-12 text-[14px] text-white outline-none transition-colors focus:bg-[#8D43D2] focus:ring-2 focus:ring-white/40 sm:h-[69px] sm:text-[18px]"
                  required
                >
                  <option value="" className="bg-white text-[#5B5A5A]">Select level</option>
                  {levels.length === 0 ? (
                    <option disabled className="bg-white text-[#5B5A5A]">Loading levels...</option>
                  ) : (
                    levels.map(level => (
                      <option key={level._id || level.id} value={String(level.code)} className="bg-white text-[#2A1856]">
                        {level.name} ({level.code} Level)
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
              <label className="mb-6 block text-[16px] font-medium text-white sm:text-[20px]">Select Your Courses</label>
              
              {/* Selected Courses Display */}
              {formData.courses.length > 0 && (
                <div className="mb-6">
                  <p className="mb-3 text-xs text-white/75">Selected Courses ({formData.courses.length})</p>
                  <div className="flex flex-wrap gap-3">
                    {courses
                      .filter(c => formData.courses.includes(c._id))
                      .map(course => (
                        <div
                          key={`selected-${course._id}`}
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              courses: prev.courses.filter(id => id !== course._id)
                            }));
                          }}
                          className="group relative"
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                  <p className="text-gray-300 mt-3 text-sm">Loading courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-4xl mb-3">📚</div>
                  <p className="text-gray-300">No courses available for this department and level</p>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-xs text-white/75">Available Courses</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {courses
                      .filter(c => !formData.courses.includes(c._id))
                      .map((course) => (
                        <div
                          key={`available-${course._id}`}
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              courses: [...prev.courses, course._id]
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
          {step === 5 && (
            <div className="rounded-[16px] bg-[#8036C5] p-6 sm:rounded-[20px] sm:p-10">
              <h2 className="mb-4 text-lg font-semibold text-white">Face Photo Verification</h2>
              <p className="mb-4 text-sm text-white/80">
                We use real-time face detection with liveness verification to ensure secure identity verification.
              </p>
              
              {!file ? (
                <FaceCheckModule
                  onFaceDetected={(blob) => {
                    const faceFile = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' });
                    setFile(faceFile);
                    setMessage('✅ Face captured successfully!');
                  }}
                  onError={(error) => {
                    setMessage(`❌ ${error}`);
                  }}
                  isLoading={loading}
                />
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Captured Face"
                      className="w-full h-64 object-cover rounded-lg border-2 border-green-500/50"
                    />
                    <div className="absolute top-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">
                      ✅ Face Verified
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setMessage('');
                    }}
                    className="w-full rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 transition-colors"
                  >
                    Retake Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stepper Navigation */}
          <div className="flex justify-between gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded-[8px] bg-[#A9A1C0] px-5 py-3 text-sm font-medium text-white hover:bg-[#8F86A9]"
                disabled={loading}
              >
                Back
              </button>
            )}
            {step < steps.length - 1 && (
              <button
                type="button"
                onClick={() => isStepValid() && setStep(step + 1)}
                className={`rounded-[8px] px-7 py-3 text-sm font-medium text-white ${isStepValid() ? 'bg-[#2A1856] hover:bg-[#41227A]' : 'cursor-not-allowed bg-[#A9A1C0]'}`}
                disabled={!isStepValid() || loading}
              >
                Next
              </button>
            )}
            {step === steps.length - 1 && (
              <button
                type="submit"
                disabled={loading || !isStepValid()}
                className={`w-full rounded-[8px] p-3 font-medium text-white transition-colors ${
                  loading ? 'cursor-not-allowed bg-[#A9A1C0]' : 'bg-[#2A1856] hover:bg-[#41227A]'
                }`}
              >
                {loading
                  ? isUpdating
                    ? `Updating... ${progress}%`
                    : `Registering... ${progress}%`
                  : isUpdating
                    ? 'Update Profile'
                    : 'Complete Registration'}
              </button>
            )}
          </div>

          {/* Status Message */}
          {message && (
            <div className={`rounded-[10px] p-4 text-center ${
              message.startsWith('✅')
                ? 'bg-[#07AF37]/10 text-[#087A2A]'
                : 'bg-red-500/10 text-red-600'
            }`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default StudentRegistration;
