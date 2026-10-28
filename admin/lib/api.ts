/**
 * Admin API Client for Backend Integration
 * Handles all API calls for courses, departments, and levels
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  status: string;
  message?: string;
  data?: T;
  total?: number;
  skip?: number;
  limit?: number;
}

interface Course {
  id?: string;
  _id?: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  levelId: string;
  levelCode?: number;
  credits: number;
  description?: string;
  prerequisites?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface Department {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  description?: string;
  headOfDepartment?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Level {
  id?: string;
  _id?: string;
  name: string;
  code: number;
  description?: string;
  yearOfStudy: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CourseStats {
  totalCourses: number;
  totalDepartments: number;
  totalLevels: number;
  coursesByDepartment: Array<{ _id: string; count: number }>;
  coursesByLevel: Array<{ _id: number; count: number }>;
}

// Error handling
class ApiError extends Error {
  constructor(public status: number, public response: any) {
    super(response?.detail || response?.message || 'API Error');
  }
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const options: Parameters<typeof fetch>[1] = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(`API call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ===========================
// DEPARTMENTS API
// ===========================

export const departmentsAPI = {
  // Create a new department
  create: async (department: Department): Promise<ApiResponse<Department>> => {
    return apiCall('/departments', 'POST', department);
  },

  // Get all departments
  getAll: async (skip = 0, limit = 100): Promise<ApiResponse<Department[]>> => {
    return apiCall(`/departments?skip=${skip}&limit=${limit}`);
  },

  // Get a specific department
  getById: async (id: string): Promise<ApiResponse<Department>> => {
    return apiCall(`/departments/${id}`);
  },

  // Update a department
  update: async (id: string, department: Partial<Department>): Promise<ApiResponse<Department>> => {
    return apiCall(`/departments/${id}`, 'PUT', department);
  },

  // Delete a department
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiCall(`/departments/${id}`, 'DELETE');
  },
};

// ===========================
// LEVELS API
// ===========================

export const levelsAPI = {
  // Create a new level
  create: async (level: Level): Promise<ApiResponse<Level>> => {
    return apiCall('/levels', 'POST', level);
  },

  // Get all levels
  getAll: async (skip = 0, limit = 100): Promise<ApiResponse<Level[]>> => {
    return apiCall(`/levels?skip=${skip}&limit=${limit}`);
  },

  // Get a specific level
  getById: async (id: string): Promise<ApiResponse<Level>> => {
    return apiCall(`/levels/${id}`);
  },

  // Update a level
  update: async (id: string, level: Partial<Level>): Promise<ApiResponse<Level>> => {
    return apiCall(`/levels/${id}`, 'PUT', level);
  },

  // Delete a level
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiCall(`/levels/${id}`, 'DELETE');
  },
};

// ===========================
// COURSES API
// ===========================

export const coursesAPI = {
  // Create a new course
  create: async (course: Course): Promise<ApiResponse<Course>> => {
    return apiCall('/courses', 'POST', course);
  },

  // Get all courses with optional filters
  getAll: async (
    skip = 0,
    limit = 100,
    departmentId?: string,
    levelId?: string,
    search?: string
  ): Promise<ApiResponse<Course[]>> => {
    let endpoint = `/courses?skip=${skip}&limit=${limit}`;
    if (departmentId) endpoint += `&department_id=${departmentId}`;
    if (levelId) endpoint += `&level_id=${levelId}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    return apiCall(endpoint);
  },

  // Get a specific course
  getById: async (id: string): Promise<ApiResponse<Course>> => {
    return apiCall(`/courses/${id}`);
  },

  // Update a course
  update: async (id: string, course: Partial<Course>): Promise<ApiResponse<Course>> => {
    return apiCall(`/courses/${id}`, 'PUT', course);
  },

  // Delete a course
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiCall(`/courses/${id}`, 'DELETE');
  },
};

// ===========================
// STATISTICS API
// ===========================

export const statsAPI = {
  // Get course statistics
  getCourseStats: async (): Promise<ApiResponse<CourseStats>> => {
    return apiCall('/stats/courses');
  },
};

export interface AdminSession {
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  type: 'physical' | 'virtual';
  status: 'active' | 'completed' | string;
  hostId: string;
  hostName: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
  finalizationStatus: 'pending' | 'processing' | 'retrying' | 'completed' | 'skipped' | string;
  finalizationError?: string;
}

export interface AdminSessionAttendee {
  userId: string;
  name: string;
  matric: string;
  department?: string;
  level?: string;
  timestamp?: string;
  attendanceStatus: 'present' | 'absent' | string;
}

async function adminApiCall<T>(endpoint: string, method = 'GET'): Promise<T> {
  const storedAdmin = localStorage.getItem('admin');
  const admin = storedAdmin ? JSON.parse(storedAdmin) : null;
  if (!admin?.token) throw new Error('Admin session expired. Please log in again.');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export const adminSessionsAPI = {
  verify: () => adminApiCall<{ status: string; admin: { id: string; email: string; name: string; role: string } }>('/admin/verify'),
  list: (status: 'all' | 'active' | 'completed' = 'all') =>
    adminApiCall<{ status: string; data: AdminSession[]; total: number; activeCount: number; completedCount: number }>(`/admin/sessions?status=${status}&limit=500`),
  detail: (sessionId: string) =>
    adminApiCall<{ status: string; session: AdminSession; attendees: AdminSessionAttendee[]; attendeesTruncated: boolean }>(`/admin/sessions/${encodeURIComponent(sessionId)}`),
  end: (sessionId: string) =>
    adminApiCall<{ status: string; message: string; session: AdminSession }>(`/admin/sessions/${encodeURIComponent(sessionId)}/end`, 'POST'),
  logout: () => adminApiCall<{ status: string }>('/admin/logout', 'POST'),
};

// ===========================
// BATCH OPERATIONS
// ===========================

export const batchAPI = {
  // Get all data at once (departments, levels, courses)
  getAllData: async () => {
    try {
      const [departments, levels, courses, stats] = await Promise.all([
        departmentsAPI.getAll(0, 1000),
        levelsAPI.getAll(0, 1000),
        coursesAPI.getAll(0, 1000),
        statsAPI.getCourseStats(),
      ]);

      return {
        departments: departments.data || [],
        levels: levels.data || [],
        courses: courses.data || [],
        stats: stats.data,
      };
    } catch (error) {
      throw new Error(`Failed to fetch all data: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

// ===========================
// EXPORT TYPES
// ===========================

export type { ApiResponse, Course, Department, Level, CourseStats, ApiError };
