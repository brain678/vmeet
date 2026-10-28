export interface AttendanceData {
  recordCount: number;
  sessionEndTime: string;
  downloadUrl: string;
  status?: 'active' | 'completed';
  hostId?: string;
  hostName?: string;
  attendeeCount?: number;
  startTime?: string;
  endTime?: string;
}

export type AttendanceSessionType = 'physical' | 'virtual';
export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceCourse {
  code: string;
  title: string;
}

export interface AttendanceStudent {
  userId: string;
  name: string;
  matric: string;
  department?: string;
  level?: string;
  timestamp?: string;
  status?: AttendanceStatus;
}

export interface AttendanceSession {
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  type: AttendanceSessionType;
  status: string;
  finalizationStatus?: 'pending' | 'processing' | 'retrying' | 'completed' | 'skipped';
  startTime: string;
  endTime: string;
  createdAt: string;
  attendeeCount: number;
  enrolledCount: number | null;
  attendanceRate: number | null;
  attendees?: AttendanceStudent[];
}

export interface AttendanceReport {
  courses: AttendanceCourse[];
  sessions: AttendanceSession[];
  students?: AttendanceStudent[];
}
