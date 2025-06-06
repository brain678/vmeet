"use client";
import React, { useState, useRef } from 'react';
import { useUser } from "@clerk/nextjs";
import { BACKEND_URL } from '@/constants/config';

export default function UploadFaceImage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [name, setName] = useState("");
  const [matric, setMatric] = useState("");
  const [department, setDepartment] = useState(""); // Add this line
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { user } = useUser();
  const userId = user?.id;

  // Start webcam
  const startCamera = async () => {
    setShowCamera(true);
    setMessage("");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }
  };

  // Capture photo from webcam
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const imageFile = new File([blob], "captured-image.png", { type: "image/png" });
          setFile(imageFile);
          setShowCamera(false);
          // Stop the camera
          const stream = video.srcObject;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }
      }, "image/png");
    }
  };

  // Cancel camera
  const cancelCamera = () => {
    setShowCamera(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const upload = async () => {
    if (!file) {
      setMessage("Select or capture an image first.");
      return;
    }
    if (!userId) {
      setMessage("User not identified.");
      return;
    }
    if (!name || !matric || !department) {
      setMessage("Please enter your name, matric number, and department.");
      return;
    }
    setLoading(true);
    setMessage("Processing your request..."); // Add this line
    
    try {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("name", name);
      formData.append("matric", matric);
      formData.append("file", file);
      formData.append("department", department);

      console.log("Starting upload to backend...");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      console.log("Backend URL:", backendUrl);
      
      const res = await fetch(`${backendUrl}/upload-face-image`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      console.log("Backend response:", data);
      
      if (res.ok) {
        setMessage("✅ Face registration successful!");
        setFile(null);
        setName("");
        setMatric("");
        setDepartment("");
        
        // Stop camera if it's running
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject;
          stream.getTracks().forEach(track => track.stop());
        }
      } else {
        setMessage(`❌ Upload failed: ${data.detail || "Unknown error"}`);
        console.error("Upload failed:", data);
      }
    } catch (e) {
      console.error("Upload error:", e);
      setMessage(`❌ Upload failed: ${e.message || "Network error. Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-gradient-to-b from-white to-blue-50/50 backdrop-blur-sm p-10 rounded-2xl shadow-xl border border-blue-100 space-y-8">
      <div className="text-center mb-6">
        <div className="inline-block p-3 bg-blue-50 rounded-full mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
          Face Registration
        </h3>
        <p className="text-gray-500 mt-2 text-sm">Fill in your details to complete registration</p>
      </div>

      {/* Form Fields */}
      <div className="space-y-6 bg-white/90 p-8 rounded-xl border-2 border-blue-100 shadow-sm">
        <div className="form-group relative">
          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="name">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group relative">
          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="matric">
            Matric Number
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <input
              id="matric"
              type="text"
              placeholder="Enter your matric number"
              className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200"
              value={matric}
              onChange={e => setMatric(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group relative">
          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="department">
            Department
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <input
              id="department"
              type="text"
              placeholder="Enter your department"
              className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200"
              value={department}
              onChange={e => setDepartment(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Preview Image - Show at the top if available */}
      {file && !showCamera && (
        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-200 shadow-lg group-hover:border-blue-300 transition-all duration-300">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all duration-300">
              <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Options */}
      <div className="flex justify-center gap-4 my-6">
        <label className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            {file && !showCamera ? 'Change Image' : 'Upload Image'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setShowCamera(false);
              setMessage("");
            }}
          />
        </label>

        <button
          type="button"
          onClick={startCamera}
          className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all duration-200"
        >
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Take Picture</span>
        </button>
      </div>

      {/* Submit Button */}
      <button
        onClick={upload}
        disabled={loading}
        className={`w-full py-3.5 px-4 mt-6 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "Processing..." : "Complete Registration"}
      </button>

      {/* Status Message */}
      {message && (
        <div className={`mt-4 p-4 rounded-xl border ${
          message.startsWith("✅") 
            ? "bg-green-50/50 border-green-200" 
            : "bg-red-50/50 border-red-200"
        }`}>
          <p className={`text-center text-sm font-medium ${
            message.startsWith("✅") ? "text-green-700" : "text-red-700"
          }`}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
