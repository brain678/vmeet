'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, DownloadIcon, UserIcon, MapPinIcon } from 'lucide-react';
import { BACKEND_URL } from '@/constants/config';

interface AttendanceRecord {
  id: string;
  sessionId: string;
  timestamp: string;
  downloadUrl: string;
  attendeeCount: number;
  hostId?: string;
  hostName?: string;
  status: 'active' | 'completed';
  startTime?: string;
  endTime?: string;
}

export default function RecordsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'physical'>('all');

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
        fetchRecords();
      } catch (error) {
        console.error('Error checking user role:', error);
        router.push('/');
      }
    };

    const fetchRecords = async () => {
      if (!user?.id) return;      try {
        const response = await fetch(`${BACKEND_URL}/get-attendance-records?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch attendance records');
        }
        
        const data = await response.json();
        // Sort records: completed first, then by date (latest first)
        const sortedRecords = data.sort((a: AttendanceRecord, b: AttendanceRecord) => {
          // First sort by status (completed before active)
          if (a.status === 'completed' && b.status !== 'completed') return -1;
          if (a.status !== 'completed' && b.status === 'completed') return 1;
          
          // Then sort by date within each status
          const dateA = a.endTime || a.timestamp;
          const dateB = b.endTime || b.timestamp;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        
        setRecords(sortedRecords);
        setFilteredRecords(sortedRecords);
      } catch (error) {
        console.error('Error fetching records:', error);
        toast({
          title: "Error",
          description: "Failed to fetch attendance records",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, [user?.id, router, toast]);
  useEffect(() => {
    if (filter === 'all') {
      setFilteredRecords(records);
    } else if (filter === 'physical') {
      setFilteredRecords(records.filter(record => record.sessionId.startsWith('geo-')));
    } else {
      setFilteredRecords(records.filter(record => record.status === filter));
    }
  }, [filter, records]);  const handleDownload = async (sessionId: string, downloadUrl?: string) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setDownloading(sessionId);
      
      // Add a timestamp to prevent caching
      const response = await fetch(
        `${BACKEND_URL}/download-attendance?sessionId=${sessionId}&userId=${user.id}&t=${Date.now()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          cache: 'no-store'
        }
      );
        if (!response.ok) {
        console.error('Download failed with status:', response.status);
        const errorText = await response.text();
        throw new Error(errorText || `Download failed: ${response.statusText}`);
      }
      
      // Verify content type
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('spreadsheetml') && !contentType?.includes('excel')) {
        console.error('Invalid content type:', contentType);
        throw new Error('Invalid file format received');
      }
      
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Received empty file');
      }
      
      // Create and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      toast({
        title: "Success",
        description: "Attendance report downloaded successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download attendance report",
        variant: "destructive"
      });
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0F1828]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="mt-4 text-gray-300">Loading attendance records...</p>
      </div>
    );
  }

  return (    <div className="min-h-screen p-4 sm:p-8 bg-[#0F1828]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Your Attendance Records</h1>
          
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('all')}
              className={`
                ${filter === 'all' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'border-gray-600 text-gray-300 hover:bg-[#2A3C56] hover:text-white'}
              `}
            >
              All
            </Button>
            <Button
              variant={filter === 'active' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('active')}
              className={`
                ${filter === 'active' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'border-gray-600 text-gray-300 hover:bg-[#2A3C56] hover:text-white'}
              `}
            >
              Active
            </Button>
            <Button
              variant={filter === 'completed' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('completed')}
              className={`
                ${filter === 'completed' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'border-gray-600 text-gray-300 hover:bg-[#2A3C56] hover:text-white'}
              `}
            >
              Completed
            </Button>
            <Button
              variant={filter === 'physical' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('physical')}
              className={`
                ${filter === 'physical' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'border-gray-600 text-gray-300 hover:bg-[#2A3C56] hover:text-white'}
              `}
            >
              Physical
            </Button>
          </div>
        </div>
          {filteredRecords.length === 0 ? (
          <div className="text-center py-12 bg-[#1B2B44] rounded-lg shadow">
            <p className="text-gray-300">
              {filter === 'all' 
                ? 'No attendance records found'
                : filter === 'physical'
                ? 'No physical attendance sessions found'
                : `No ${filter === 'active' ? 'active' : 'completed'} sessions found`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecords.map((record) => {
              const date = record.endTime || record.timestamp;
              return (                <Card key={record.sessionId} className="p-6 hover:shadow-lg transition-shadow bg-[#1B2B44] border-gray-700">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Session ID</p>
                        <p className="font-medium text-white">{record.sessionId}</p>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <UserIcon size={16} />
                        <span>{record.attendeeCount || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <CalendarIcon size={16} />
                        <span>
                          {(() => {
                            try {
                              const dateObj = new Date(date);
                              if (isNaN(dateObj.getTime())) {
                                return 'Invalid date';
                              }
                              return format(dateObj, 'PPpp');
                            } catch (e) {
                              return 'Invalid date';
                            }
                          })()}
                        </span>
                      </div>
                      {record.hostName && (
                        <p className="text-sm text-gray-400">
                          Host: {record.hostName}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded ${
                          record.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.status === 'completed' ? 'Completed' : 'Active'}
                        </span>
                        {record.sessionId.startsWith('geo-') && (
                          <span className="text-sm px-2 py-1 rounded bg-blue-100 text-blue-800 flex items-center gap-1">
                            <MapPinIcon size={12} />
                            Physical
                          </span>
                        )}
                      </div>
                      
                      {record.downloadUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(record.sessionId, record.downloadUrl)}
                          disabled={downloading === record.sessionId}
                        >
                          {downloading === record.sessionId ? (
                            <span className="animate-spin">↻</span>
                          ) : (
                            <DownloadIcon size={16} />
                          )}
                          <span className="ml-2">Download</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
