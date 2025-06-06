"use client";

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useState, useRef, useEffect } from 'react';
import { BACKEND_URL } from '@/constants/config';

interface FormData {
  name: string;
  matricNumber: string;
  department: string;
  level: string;
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

const StudentRegistration = () => {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [studentData, setStudentData] = useState<UserData | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    matricNumber: '',
    department: '',
    level: '',
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

  // Start webcam
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

  // Capture photo
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          setFile(file);
          setShowCamera(false);
          
          const stream = video.srcObject as MediaStream;
          stream?.getTracks().forEach(track => track.stop());
        }
      }, 'image/jpeg', 0.8);
    }
  };

  // Cancel camera
  const cancelCamera = () => {
    setShowCamera(false);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setMessage("❌ Image size should be less than 5MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!file) {
      setMessage("❌ Please capture or upload your face image");
      return;
    }    if (!formData.matricNumber || !formData.department || !formData.level || !formData.name) {
      setMessage("❌ Please fill in all required fields");
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
    setMessage(isUpdating ? "Updating your profile..." : "Processing your registration...");

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

      if (!imageResponse.ok) {
        const errorData = await imageResponse.json();
        throw new Error(errorData.detail || 'Failed to upload face image');
      }

      console.log(`[${isUpdating ? 'Update' : 'Registration'}] Saving student info...`);
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
          isUpdate: isUpdating
        }),
      });

      if (!registrationResponse.ok) {
        const errorData = await registrationResponse.json();
        throw new Error(errorData.detail || `Failed to ${isUpdating ? 'update profile' : 'complete registration'}`);
      }

      console.log(`[${isUpdating ? 'Update' : 'Registration'}] Successful`);
      setMessage(`✅ ${isUpdating ? 'Profile updated' : 'Registration completed'} successfully! Redirecting...`);
      setTimeout(() => router.push('/'), 1500);    } catch (error) {
      console.error(`[${isUpdating ? 'Update' : 'Registration'}] Error:`, error);
      setMessage(`❌ ${error instanceof Error ? error.message : `${isUpdating ? 'Profile update' : 'Registration'} failed. Please try again.`}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1828] p-4">
      <div className="mx-auto max-w-md">
        <h1 className="mb-8 text-center text-2xl font-bold text-white">
          {isUpdating ? 'Update Your Profile' : 'Complete Your Registration'}
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Face Image Section */}
          <div className="rounded-lg bg-[#1B2B44] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Face Photo</h2>
            
            {showCamera ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="mt-4 flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={cancelCamera}
                    className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {file ? (
                  <div className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      className="h-48 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center space-x-4">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                    >
                      Use Camera
                    </button>
                    <label className="cursor-pointer rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">
                      Upload Image
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="rounded-lg bg-[#1B2B44] p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Full Name</label>              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`mt-1 w-full rounded-lg p-2 text-white ${
                  isUpdating ? 'bg-[#1F2937] cursor-not-allowed' : 'bg-[#2C3C56]'
                }`}
                disabled={isUpdating}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300">Matric Number</label>              <input
                type="text"
                value={formData.matricNumber}
                onChange={e => setFormData(prev => ({ ...prev, matricNumber: e.target.value }))}
                className={`mt-1 w-full rounded-lg p-2 text-white ${
                  isUpdating ? 'bg-[#1F2937] cursor-not-allowed' : 'bg-[#2C3C56]'
                }`}
                disabled={isUpdating}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Department</label>              <input
                type="text"
                value={formData.department}
                onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className={`mt-1 w-full rounded-lg p-2 text-white ${
                  isUpdating ? 'bg-[#1F2937] cursor-not-allowed' : 'bg-[#2C3C56]'
                }`}
                disabled={isUpdating}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Level</label>
              <select
                value={formData.level}
                onChange={e => setFormData(prev => ({ ...prev, level: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-[#2C3C56] p-2 text-white"
                required
              >
                <option value="">Select Level</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg p-3 font-medium text-white transition-colors ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? (isUpdating ? 'Updating...' : 'Registering...') : (isUpdating ? 'Update Profile' : 'Complete Registration')}
          </button>

          {/* Status Message */}
          {message && (
            <div className={`rounded-lg p-4 text-center ${
              message.startsWith('✅')
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
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
