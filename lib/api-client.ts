import { API_ENDPOINTS } from './api-config';

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

async function handleResponse(response: Response) {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        throw new ApiError(response.status, error.message);
    }
    return response.json();
}

export const apiClient = {
    async uploadFaceImage(formData: FormData) {
        const response = await fetch(API_ENDPOINTS.uploadFaceImage, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        return handleResponse(response);
    },

    async verifyFace(formData: FormData) {
        const response = await fetch(API_ENDPOINTS.verifyFace, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        return handleResponse(response);
    },

    async createAttendanceSession(data: any) {
        const response = await fetch(API_ENDPOINTS.createAttendanceSession, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            credentials: 'include',
        });
        return handleResponse(response);
    },

    async healthCheck() {
        const response = await fetch(API_ENDPOINTS.healthCheck);
        return handleResponse(response);
    }
};
