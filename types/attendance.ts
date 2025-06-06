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
