'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { BACKEND_URL } from '@/constants/config';

interface AttendanceRecord {
  id: string;
  sessionId: string;
  timestamp: string;
  downloadUrl: string;
  attendeeCount: number;
  hostId?: string;
  status?: 'active' | 'completed';
  startTime?: string;
  endTime?: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const { user } = useUser();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        const userData = await response.json();
        
        if (userData.role !== 'lecturer') {
          router.push('/');
          return;
        }
        
        setIsAuthorized(true);
        // Fetch attendance records after authorization
        fetchAttendanceRecords();
      } catch (error) {
        console.error('Error checking user role:', error);
        router.push('/');
      }
    };

    const fetchAttendanceRecords = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/get-attendance-records?userId=${user?.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch attendance records');
        }
        const data = await response.json();
        setAttendanceRecords(data); // Backend already returns sorted records
        setError(null);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch attendance records');
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, [user?.id, router]);

  // Handle attendance report download
  const handleDownload = async (sessionId: string, downloadUrl: string) => {
    if (downloading === sessionId) return;
    
    try {
      setDownloading(sessionId);
      const response = await fetch(`${BACKEND_URL}${downloadUrl}`);
      if (!response.ok) throw new Error('Failed to download report');
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `attendance_${sessionId}.xlsx`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      setMessage('Failed to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (!isAuthorized || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-gray-500 animate-pulse">Loading your attendance records...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto">
        {message && (
          <div className={`mb-4 p-4 rounded-lg text-center ${
            message.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">Your Attendance Records</h1>
          <div className="flex items-center gap-2 text-gray-600">
            <Image
              src="/icons/checked.svg"
              alt="Total Sessions"
              width={20}
              height={20}
              className="opacity-60"
            />
            <span className="text-lg">
              {attendanceRecords.length} {attendanceRecords.length === 1 ? 'Session' : 'Sessions'} Recorded
            </span>
          </div>
        </div>
        
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{error}</p>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No attendance records found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attendanceRecords.map((record) => (
              <Card key={record.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800 mb-2">
                      Session {record.sessionId.split('-').pop()}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {record.status === 'active' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      <p className="text-gray-600 flex items-center gap-2">
                        <Image
                          src="/icons/calendar.svg"
                          alt="Date"
                          width={16}
                          height={16}
                          className="opacity-60"
                        />
                        {(() => {
                          try {
                            if (record.status === 'active' && record.startTime) {
                              const startDate = new Date(record.startTime);
                              if (!isNaN(startDate.getTime())) {
                                return startDate.toLocaleString('en-GB', {
                                  dateStyle: 'long',
                                  timeStyle: 'short',
                                }) + ' (Started)';
                              }
                            } else if (record.endTime || record.startTime) {
                              const date = new Date(record.endTime || record.startTime || '');
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleString('en-GB', {
                                  dateStyle: 'long',
                                  timeStyle: 'short',
                                }) + ' (Ended)';
                              }
                            }
                            return 'Date not available';
                          } catch (e) {
                            console.error('Error formatting date:', e);
                            return 'Date not available';
                          }
                        })()}
                      </p>
                      <p className="text-gray-600 flex items-center gap-2">
                        <Image
                          src="/icons/group.svg"
                          alt="Attendees"
                          width={16}
                          height={16}
                          className="opacity-60"
                        />
                        <span className="font-medium">{record.attendeeCount}</span> {record.attendeeCount === 1 ? 'attendee' : 'attendees'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Image
                      src="/icons/checked.svg"
                      alt="Attendance"
                      width={24}
                      height={24}
                    />
                  </div>
                </div>
                
                <Button
                  onClick={() => handleDownload(record.sessionId, record.downloadUrl)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                  disabled={downloading === record.sessionId}
                >
                  <Image
                    src="/icons/download.svg"
                    alt="Download"
                    width={16}
                    height={16}
                  />
                  {downloading === record.sessionId ? 'Downloading...' : 'Download Attendance Report'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
