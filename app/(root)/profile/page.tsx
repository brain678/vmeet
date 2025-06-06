"use client";

import { useState, useEffect, useRef } from 'react';
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
}

interface UserData {
  role: string;
  isRegistered: boolean;
  matricNumber?: string;
  department?: string;
  level?: string;
  name?: string;
}

export default function ProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>('');
  const [studentData, setStudentData] = useState<UserData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    matricNumber: '',
    department: '',
    level: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to load profile data');
        }

        const userData = await response.json();
        setStudentData(userData);

        if (userData.role === 'student') {
          const is_registered = userData.isRegistered;
          const registration_complete = userData.roleData?.registrationComplete;

          if (!is_registered || !registration_complete) {
            toast({
              title: "Registration Required",
              description: "Please complete your student registration first. You need to provide:\n- Face Photo\n- Full Name\n- Matric Number\n- Department\n- Level",
              variant: "destructive",
            });
            router.push('/student-registration');
            return;
          }

          // If properly registered, set form data
          setFormData({
            matricNumber: userData.matricNumber || '',
            department: userData.department || '',
            level: userData.level || '',
            name: userData.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : ''),
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0F1828]">
        <Loader />
        <p className="mt-4 text-gray-300">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1828] p-4">
      <div className="mx-auto max-w-md">
        <h1 className="mb-8 text-center text-2xl font-bold text-white">
          Update Your Profile
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
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="bg-blue-500 hover:bg-blue-600"
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
                      className="h-48 w-full rounded-lg object-cover"
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
                      className="w-full bg-blue-500 hover:bg-blue-600"
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
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        variant="outline"
                        className="w-full border-gray-600 text-gray-300"
                      >
                        Upload Photo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile Information */}
          <div className="rounded-lg bg-[#1B2B44] p-6 space-y-4">
            <h2 className="mb-4 text-lg font-semibold text-white">Profile Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-300">Full Name</label>
              <Input
                type="text"
                value={formData.name}
                readOnly
                className="mt-1 bg-[#0F1828] border-gray-600 text-gray-400 cursor-not-allowed"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Matric Number</label>
              <Input
                type="text"
                value={formData.matricNumber}
                readOnly
                className="mt-1 bg-[#0F1828] border-gray-600 text-gray-400 cursor-not-allowed"
                placeholder="Enter your matric number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Department</label>
              <Input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="mt-1 bg-[#0F1828] border-gray-600 text-white"
                placeholder="Enter your department"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Level</label>
              <Input
                type="text"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="mt-1 bg-[#0F1828] border-gray-600 text-white"
                placeholder="Enter your level"
              />
            </div>
          </div>

          {message && (
            <div className={`text-center p-2 rounded ${
              message.startsWith('✅') ? 'bg-green-100 text-green-800' : 
              message.startsWith('❌') ? 'bg-red-100 text-red-800' : 
              'bg-blue-100 text-blue-800'
            }`}>
              {message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? <Loader /> : 'Update Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}
