export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
    uploadFaceImage: `${API_BASE_URL}/upload-face-image`,
    verifyFace: `${API_BASE_URL}/verify-face`,
    createAttendanceSession: `${API_BASE_URL}/create-attendance-session`,
    healthCheck: `${API_BASE_URL}`,
} as const;
