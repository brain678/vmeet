'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, DownloadIcon, UserIcon, Trash2Icon, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { BACKEND_URL } from '@/constants/config';

interface AttendanceRecord {
  id: string;
  sessionId: string;
  classTitle?: string;  // Add classTitle field
  courseCode?: string;  // Add courseCode field for physical sessions
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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
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
        
        // Fetch course codes for physical sessions
        const recordsWithCourseCodes = await Promise.all(
          data.map(async (record: AttendanceRecord) => {
            if (record.sessionId.startsWith('geo-')) {
              try {
                const courseResponse = await fetch(
                  `${BACKEND_URL}/get-session-course-code?sessionId=${record.sessionId}`
                );
                if (courseResponse.ok) {
                  const courseData = await courseResponse.json();
                  return {
                    ...record,
                    courseCode: courseData.courseCode || courseData.code || null
                  };
                }
              } catch (error) {
                console.error('Error fetching course code:', error);
              }
            }
            return record;
          })
        );
        
        // Sort records: completed first, then by date (latest first)
        const sortedRecords = recordsWithCourseCodes.sort((a: AttendanceRecord, b: AttendanceRecord) => {
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

  const handleDelete = async (sessionId: string) => {
    if (!user?.id || deleting === sessionId) return;
    
    if (!confirm('Are you sure you want to delete this attendance record? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeleting(sessionId);
      
      const response = await fetch(`${BACKEND_URL}/delete-attendance`, {
        method: 'POST', // <-- change from 'DELETE' to 'POST'
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          userId: user.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete attendance record');
      }

      // Remove the deleted record from state
      setRecords(prev => prev.filter(record => record.sessionId !== sessionId));
      
      toast({
        title: "Success",
        description: "Attendance record deleted successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete record",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F4F8] p-4 text-[#2D1A3A]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#E4D6ED] border-t-[#8437C8]" />
        <p className="mt-4 text-sm font-medium text-[#6B6172]">Loading attendance records...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4F8] px-4 pb-12 pt-16 text-[#2D1A3A] sm:px-8 sm:pt-20 lg:px-12">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="relative mb-8 overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7630B8] via-[#8234C6] to-[#A14EDD] px-5 py-7 text-white shadow-[0_12px_25px_rgba(99,44,148,0.18)] sm:rounded-[38px] sm:px-9 sm:py-9">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[22px] border-white/10" />
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <button type="button" onClick={() => router.push('/home')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-white/80 transition-colors hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </button>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/70">Lecturer workspace</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-[38px]">Attendance records</h1>
              <p className="mt-2 max-w-[520px] text-sm leading-6 text-white/80">Review every class session, download reports, and keep your attendance history organized.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <FileSpreadsheet className="h-5 w-5 text-white/90" />
              <div>
                <p className="text-lg font-semibold leading-none">{records.length}</p>
                <p className="mt-1 text-xs text-white/75">total sessions</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#E8E0ED] bg-white p-3 shadow-[0_5px_12px_rgba(71,38,96,0.08)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <p className="px-2 text-sm font-semibold text-[#3B3045]">Filter records</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-[#8437C8] text-white hover:bg-[#6E27AE]' : 'border-[#E0D7E5] bg-white text-[#6B6172] hover:bg-[#F4ECF8] hover:text-[#6E27AE]'}
            >
              All
            </Button>
            <Button
              variant={filter === 'active' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('active')}
              className={filter === 'active' ? 'bg-[#8437C8] text-white hover:bg-[#6E27AE]' : 'border-[#E0D7E5] bg-white text-[#6B6172] hover:bg-[#F4ECF8] hover:text-[#6E27AE]'}
            >
              Active
            </Button>
            <Button
              variant={filter === 'completed' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('completed')}
              className={filter === 'completed' ? 'bg-[#8437C8] text-white hover:bg-[#6E27AE]' : 'border-[#E0D7E5] bg-white text-[#6B6172] hover:bg-[#F4ECF8] hover:text-[#6E27AE]'}
            >
              Completed
            </Button>
            <Button
              variant={filter === 'physical' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('physical')}
              className={filter === 'physical' ? 'bg-[#8437C8] text-white hover:bg-[#6E27AE]' : 'border-[#E0D7E5] bg-white text-[#6B6172] hover:bg-[#F4ECF8] hover:text-[#6E27AE]'}
            >
              Physical
            </Button>
          </div>
        </div>
        </div>
          {filteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-[#E8E0ED] bg-white px-5 py-16 text-center shadow-[0_5px_12px_rgba(71,38,96,0.08)]">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-[#B98BDC]" />
            <p className="mt-4 text-sm font-medium text-[#6B6172]">
              {filter === 'all' 
                ? 'No attendance records found'
                : filter === 'physical'
                ? 'No physical attendance sessions found'
                : `No ${filter === 'active' ? 'active' : 'completed'} sessions found`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecords.map((record) => {
              const date = record.endTime || record.timestamp;
              const isPhysicalSession = record.sessionId.startsWith('geo-');
              
              return (
                <Card key={record.sessionId} className="border-[#E8E0ED] bg-white p-5 shadow-[0_5px_12px_rgba(71,38,96,0.08)] transition-shadow hover:shadow-[0_10px_22px_rgba(71,38,96,0.13)] sm:p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-[#8A7D91]">
                            {isPhysicalSession ? 'Course Code' : 'Class Title'}
                          </p>
                          {isPhysicalSession && (
                            <Badge variant="outline" className="border-[#D8BDE8] text-xs text-[#8437C8]">
                              Physical
                            </Badge>
                          )}
                        </div>
                        <p className="break-words font-semibold text-[#2D1A3A]">
                          {isPhysicalSession 
                            ? (record.courseCode || record.sessionId)
                            : (record.classTitle || record.sessionId)
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#8A7D91]">
                        <UserIcon size={16} />
                        <span>{record.attendeeCount || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">                      <div className="flex items-center gap-2 text-sm text-[#6B6172]">
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
                        <p className="text-sm text-[#6B6172]">
                          Host: {record.hostName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[#F0EAF2] pt-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded ${
                          record.status === 'completed' 
                            ? 'bg-[#E4F5EA] text-[#18733B]' 
                            : 'bg-[#FFF3D5] text-[#8A5A00]'
                        }`}>
                          {record.status === 'completed' ? 'Completed' : 'Active'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDownload(record.sessionId)}
                          disabled={downloading === record.sessionId}
                          className="h-10 w-10 bg-[#2E63C7] p-0 text-white hover:bg-[#2453A9]"
                          title="Download attendance"
                        >
                          {downloading === record.sessionId ? (
                            <span className="animate-spin">↻</span>
                          ) : (
                            <DownloadIcon size={16} />
                          )}
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(record.sessionId)}
                          disabled={deleting === record.sessionId}
                          className="h-10 w-10 bg-[#E45D72] p-0 text-white hover:bg-[#C9475D]"
                          title="Delete record"
                        >
                          {deleting === record.sessionId ? (
                            <span className="animate-spin">↻</span>
                          ) : (
                            <Trash2Icon size={16} />
                          )}
                        </Button>
                      </div>
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
