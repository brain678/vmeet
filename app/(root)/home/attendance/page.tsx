'use client';

// Lecturer attendance analytics for geofence and virtual sessions, including filters, trends, exports, and student history.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  Activity,
  BookOpen,
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  MapPin,
  Search,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BACKEND_URL } from '@/constants/config';
import type { AttendanceReport, AttendanceSession, AttendanceStudent } from '@/types/attendance';

type ReportTab = 'overview' | 'sessions' | 'students';
type SessionFilter = 'all' | 'physical' | 'virtual';

const monthNames = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

function sessionDate(session: AttendanceSession) {
  const value = session.startTime || session.endTime || session.createdAt;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function academicYear(date: Date) {
  const startYear = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
}

function csvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function studentMatches(attendee: AttendanceStudent, student: AttendanceStudent) {
  if (student.userId && attendee.userId) return attendee.userId === student.userId;
  if (student.matric && attendee.matric) return attendee.matric === student.matric;
  return attendee.name === student.name;
}

export default function AttendancePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [authorized, setAuthorized] = useState(false);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [tab, setTab] = useState<ReportTab>('overview');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentHistorySessions, setStudentHistorySessions] = useState<AttendanceSession[]>([]);
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, AttendanceSession>>({});
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [sessionDetailError, setSessionDetailError] = useState('');
  const sessionDetailRequest = useRef(0);
  const [downloading, setDownloading] = useState('');
  const [deleting, setDeleting] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user?.id) {
      setError('Sign in with a lecturer account to view attendance analytics.');
      setLoading(false);
      return;
    }
    let cancelled = false;

    const loadReport = async () => {
      setLoading(true);
      try {
        const reportResponse = await fetch(`${BACKEND_URL}/attendance-report?userId=${encodeURIComponent(user.id)}`);
        const reportData = await reportResponse.json();
        if (reportResponse.status === 403) {
          router.push('/');
          return;
        }
        if (!reportResponse.ok) throw new Error(reportData.detail || 'Failed to load attendance analytics.');
        if (!cancelled) {
          setAuthorized(true);
          setReport(reportData as AttendanceReport);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to load attendance analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadReport();
    return () => { cancelled = true; };
  }, [user?.id, isLoaded, router]);

  useEffect(() => {
    if (tab !== 'students' || !user?.id || studentsLoaded) return;
    let cancelled = false;
    const loadStudents = async () => {
      setStudentsLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/attendance-report/students?userId=${encodeURIComponent(user.id)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Failed to load students.');
        if (!cancelled) {
          setStudents(data.students || []);
          setStudentsLoaded(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setMessage(loadError instanceof Error ? loadError.message : 'Failed to load students.');
          setMessageKind('error');
        }
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    };
    loadStudents();
    return () => { cancelled = true; };
  }, [tab, user?.id, studentsLoaded]);

  const selectedStudent = students.find((student) => {
    const option = student.matric ? `${student.name} · ${student.matric}` : student.name;
    return studentQuery === option || studentQuery === student.name || studentQuery === student.matric || studentQuery === student.userId;
  }) || null;

  useEffect(() => {
    if (tab !== 'students' || !user?.id || !selectedStudent) {
      setStudentHistorySessions([]);
      setStudentHistoryLoading(false);
      return;
    }
    let cancelled = false;
    const studentId = selectedStudent.userId || selectedStudent.matric;
    if (!studentId) {
      setStudentHistorySessions([]);
      setStudentHistoryLoading(false);
      return;
    }
    const loadHistory = async () => {
      setStudentHistoryLoading(true);
      setStudentHistorySessions([]);
      try {
        const params = new URLSearchParams({ userId: user.id, studentId });
        const response = await fetch(`${BACKEND_URL}/attendance-report/student-history?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Failed to load student history.');
        if (!cancelled) setStudentHistorySessions(data.sessions || []);
      } catch (loadError) {
        if (!cancelled) {
          setMessage(loadError instanceof Error ? loadError.message : 'Failed to load student history.');
          setMessageKind('error');
        }
      } finally {
        if (!cancelled) setStudentHistoryLoading(false);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, [tab, user?.id, selectedStudent]);

  const yearOptions = useMemo(() => {
    const years = new Set((report?.sessions || []).flatMap((session) => {
      const date = sessionDate(session);
      return date ? [academicYear(date)] : [];
    }));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [report]);

  const matchingStudents = students.filter((student) => {
    const query = studentQuery.trim().toLocaleLowerCase();
    return !query || `${student.name} ${student.matric} ${student.userId}`.toLocaleLowerCase().includes(query);
  }).slice(0, 12);

  const filteredSessions = useMemo(() => (report?.sessions || []).filter((session) => {
    const date = sessionDate(session);
    if (academicYearFilter !== 'all' && (!date || academicYear(date) !== academicYearFilter)) return false;
    if (courseFilter !== 'all' && session.courseCode !== courseFilter) return false;
    if (sessionTypeFilter !== 'all' && session.type !== sessionTypeFilter) return false;
    if (dateFrom && (!date || date < new Date(`${dateFrom}T00:00:00`))) return false;
    if (dateTo && (!date || date > new Date(`${dateTo}T23:59:59`))) return false;
    if (selectedStudent && !studentHistorySessions.some((history) => history.sessionId === session.sessionId)) return false;
    return true;
  }), [report, academicYearFilter, courseFilter, sessionTypeFilter, dateFrom, dateTo, selectedStudent, studentHistorySessions]);

  const attendanceMarks = filteredSessions.reduce((total, session) => total + session.attendeeCount, 0);
  const ratedSessions = filteredSessions.filter((session) => session.attendanceRate !== null);
  const averageRate = ratedSessions.length
    ? ratedSessions.reduce((total, session) => total + (session.attendanceRate || 0), 0) / ratedSessions.length
    : null;
  const physicalCount = filteredSessions.filter((session) => session.type === 'physical').length;
  const virtualCount = filteredSessions.length - physicalCount;
  const latestYear = academicYearFilter === 'all' ? yearOptions[0] : academicYearFilter;

  const trendData = useMemo(() => monthNames.map((month, index) => {
    const [startYear] = (latestYear || '').split('/').map(Number);
    const monthIndex = (index + 7) % 12;
    const year = monthIndex >= 7 ? startYear : startYear + 1;
    const total = filteredSessions.reduce((sum, session) => {
      const date = sessionDate(session);
      return date && date.getFullYear() === year && date.getMonth() === monthIndex ? sum + session.attendeeCount : sum;
    }, 0);
    return { month, attendees: total };
  }), [filteredSessions, latestYear]);

  const courseChartData = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSessions.forEach((session) => {
      const key = session.courseCode || 'Unassigned';
      totals.set(key, (totals.get(key) || 0) + session.attendeeCount);
    });
    return Array.from(totals.entries()).map(([course, attendees]) => ({ course, attendees })).sort((a, b) => b.attendees - a.attendees);
  }, [filteredSessions]);

  const modalityData = [
    { name: 'Physical', value: physicalCount },
    { name: 'Virtual', value: virtualCount },
  ];

  const studentHistory = selectedStudent
    ? studentHistorySessions
      .filter((session) => filteredSessions.some((filtered) => filtered.sessionId === session.sessionId))
      .map((session) => ({ session, attendee: session.attendees?.[0] }))
      .filter((item): item is { session: AttendanceSession; attendee: AttendanceStudent } => !!item.attendee)
      .sort((a, b) => (sessionDate(b.session)?.getTime() || 0) - (sessionDate(a.session)?.getTime() || 0))
    : [];
  const studentPresentCount = studentHistory.filter(({ attendee }) => attendee.status === 'present').length;
  const studentRatedHistory = studentHistory.filter(({ attendee }) => attendee.status === 'present' || attendee.status === 'absent');
  const studentRate = studentRatedHistory.length ? studentPresentCount / studentRatedHistory.length * 100 : null;
  const studentCourseData = Array.from(new Set(studentHistory.map(({ session }) => session.courseCode || 'Unassigned'))).map((course) => {
    const courseHistory = studentHistory.filter(({ session }) => (session.courseCode || 'Unassigned') === course);
    const present = courseHistory.filter(({ attendee }) => attendee.status === 'present').length;
    return { course, present, total: courseHistory.length, rate: courseHistory.length ? present / courseHistory.length * 100 : 0 };
  });

  const showMessage = (text: string, kind: 'success' | 'error') => {
    setMessage(text);
    setMessageKind(kind);
  };

  const openSession = async (session: AttendanceSession) => {
    const requestId = ++sessionDetailRequest.current;
    setSelectedSession(session);
    setSessionDetailError('');
    const cachedDetails = sessionDetails[session.sessionId];
    if (cachedDetails) {
      setSelectedSession(cachedDetails);
      setSessionDetailLoading(false);
      return;
    }
    if (!user?.id) {
      setSessionDetailError('Sign in to load session details.');
      return;
    }
    setSessionDetailLoading(true);
    try {
      const params = new URLSearchParams({ userId: user.id });
      const response = await fetch(`${BACKEND_URL}/attendance-report/session/${encodeURIComponent(session.sessionId)}?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to load session details.');
      if (requestId !== sessionDetailRequest.current) return;
      setSessionDetails((current) => ({ ...current, [session.sessionId]: data }));
      setSelectedSession(data as AttendanceSession);
    } catch (detailError) {
      if (requestId !== sessionDetailRequest.current) return;
      setSessionDetailError(detailError instanceof Error ? detailError.message : 'Failed to load session details.');
    } finally {
      if (requestId === sessionDetailRequest.current) setSessionDetailLoading(false);
    }
  };

  const closeSession = () => {
    sessionDetailRequest.current += 1;
    setSelectedSession(null);
    setSessionDetailLoading(false);
  };

  const handleDownload = async (session: AttendanceSession) => {
    if (!user?.id || session.status === 'active') return;
    try {
      setDownloading(session.sessionId);
      setMessage('');
      const response = await fetch(`${BACKEND_URL}/download-attendance?sessionId=${encodeURIComponent(session.sessionId)}&userId=${encodeURIComponent(user.id)}&t=${Date.now()}`, {
        headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      });
      if (!response.ok) throw new Error((await response.text()) || `Download failed: ${response.statusText}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('spreadsheetml') && !contentType.includes('excel')) throw new Error('Invalid file format received.');
      const blob = await response.blob();
      if (!blob.size) throw new Error('The attendance report was empty.');
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `attendance_${session.sessionId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showMessage('Excel report downloaded.', 'success');
    } catch (downloadError) {
      showMessage(downloadError instanceof Error ? downloadError.message : 'Failed to download report.', 'error');
    } finally {
      setDownloading('');
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!user?.id || !window.confirm('Delete this session and its attendance records? This cannot be undone.')) return;
    try {
      setDeleting(sessionId);
      const response = await fetch(`${BACKEND_URL}/delete-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: user.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Failed to delete attendance session.');
      setReport((current) => current ? {
        ...current,
        sessions: current.sessions.filter((session) => session.sessionId !== sessionId),
      } : current);
      setSelectedSession(null);
      showMessage('Attendance session deleted.', 'success');
    } catch (deleteError) {
      showMessage(deleteError instanceof Error ? deleteError.message : 'Failed to delete attendance session.', 'error');
    } finally {
      setDeleting('');
    }
  };

  const exportFilteredReport = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/attendance-report/session-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sessionIds: filteredSessions.map((session) => session.sessionId),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to load report details for export.');
      const exportSessions: AttendanceSession[] = data.sessions || [];
      const sessionDetailsById = new Map(exportSessions.map((session) => [session.sessionId, session]));
      const rows: string[][] = [['Session ID', 'Course code', 'Course title', 'Session type', 'Date', 'Student name', 'Matric number', 'Status']];
      filteredSessions.forEach((session) => {
        const sessionWithDetails = sessionDetailsById.get(session.sessionId);
        const attendeesForSession = sessionWithDetails?.attendees || [];
        const attendees = selectedStudent
          ? attendeesForSession.filter((attendee) => studentMatches(attendee, selectedStudent))
          : attendeesForSession;
        if (!attendees.length) {
          rows.push([session.sessionId, session.courseCode, session.courseTitle, session.type, formatDate(sessionDate(session)), '', '', '']);
        } else {
          attendees.forEach((attendee) => rows.push([
            session.sessionId,
            session.courseCode,
            session.courseTitle,
            session.type,
            formatDate(sessionDate(session)),
            attendee.name,
            attendee.matric,
            attendee.status || 'present',
          ]));
        }
      });
      const csv = rows.map((row) => row.map(csvValue).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      showMessage('Filtered CSV report exported.', 'success');
    } catch (exportError) {
      showMessage(exportError instanceof Error ? exportError.message : 'Failed to export report.', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F5EFFB] via-white to-[#F1EAFF] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className="h-9 w-72 rounded bg-[#E8DDF7]" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 rounded-lg border border-[#E7DDF0] bg-white/80" />)}
          </div>
          <div className="h-24 rounded-lg border border-[#E7DDF0] bg-white/80" />
          <div className="h-80 rounded-lg border border-[#E7DDF0] bg-white/80" />
        </div>
      </main>
    );
  }

  if (!authorized && !error) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5EFFB] via-white to-[#F1EAFF] px-4 py-6 sm:px-8 sm:py-9">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-5 border-b border-[#E7DDF0] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#6E27AE]">Lecturer reporting</p>
            <h1 className="text-3xl font-bold text-[#2D1A3A]">Attendance analytics</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5F526A]">A clear view of participation across physical and virtual classes.</p>
          </div>
          <Button onClick={exportFilteredReport} disabled={exporting} className="flex w-full items-center justify-center gap-2 bg-[#8437C8] text-white hover:bg-[#6E27AE] disabled:opacity-60 sm:w-auto">
            <FileSpreadsheet size={17} /> {exporting ? 'Preparing export…' : 'Export filtered report'}
          </Button>
        </header>

        {message && (
          <div role="status" className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${messageKind === 'success' ? 'border-[#BEE5C8] bg-[#EAF8EF] text-[#0E9F4D]' : 'border-[#F2C7CC] bg-[#FFF1F2] text-[#B42318]'}`}>
            <span>{message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setMessage('')} className="ml-4"><X size={16} /></button>
          </div>
        )}

        {error ? (
          <Card className="border-[#F2C7CC] bg-white p-8 text-center shadow-sm">
            <Activity className="mx-auto mb-3 text-[#B42318]" size={28} />
            <h2 className="font-semibold text-[#2D1A3A]">Attendance report unavailable</h2>
            <p className="mt-2 text-sm text-[#8B1D1D]">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-5 bg-[#8437C8] text-white hover:bg-[#6E27AE]">Try again</Button>
          </Card>
        ) : (
          <>
            <section aria-label="Attendance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard icon={<CalendarDays size={19} />} label="Total sessions" value={filteredSessions.length.toLocaleString()} detail={`${physicalCount} physical · ${virtualCount} virtual`} accent="blue" />
              <KpiCard icon={<Users size={19} />} label="Attendance marks" value={attendanceMarks.toLocaleString()} detail="Present across the selected sessions" accent="teal" />
              <KpiCard icon={<Activity size={19} />} label="Average attendance" value={averageRate === null ? '—' : `${averageRate.toFixed(1)}%`} detail={averageRate === null ? 'No enrollment roster available' : `Across ${ratedSessions.length} rostered sessions`} accent="orange" />
              <Card className="relative overflow-hidden border-[#E7DDF0] bg-white p-5 shadow-sm">
                <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-[#F6F0FB]" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#5F526A]">Session format</p>
                    <div className="mt-4 flex items-center gap-5">
                      <div><p className="text-2xl font-bold text-[#6E27AE]">{physicalCount}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#5F526A]"><MapPin size={13} /> Physical</p></div>
                      <div className="h-9 w-px bg-[#E7DDF0]" />
                      <div><p className="text-2xl font-bold text-[#0E9F4D]">{virtualCount}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#5F526A]"><Video size={13} /> Virtual</p></div>
                    </div>
                  </div>
                  <div className="rounded-md bg-[#F6F0FB] p-2 text-[#6E27AE]"><Video size={19} /></div>
                </div>
              </Card>
            </section>

            <section aria-label="Report filters" className="sticky top-2 z-20 rounded-lg border border-[#E7DDF0] bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#4F3D5D]"><Search size={16} className="text-[#6E27AE]" /> Refine report</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <FilterSelect label="Academic year" value={academicYearFilter} onChange={setAcademicYearFilter}>
                  <option value="all">All years</option>
                  {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </FilterSelect>
                <FilterSelect label="Course" value={courseFilter} onChange={setCourseFilter}>
                  <option value="all">All courses</option>
                  {(report?.courses || []).map((course) => <option key={course.code} value={course.code}>{course.code} · {course.title}</option>)}
                </FilterSelect>
                <FilterSelect label="Session type" value={sessionTypeFilter} onChange={(value) => setSessionTypeFilter(value as SessionFilter)}>
                  <option value="all">All formats</option>
                  <option value="physical">Physical</option>
                  <option value="virtual">Virtual</option>
                </FilterSelect>
                <label className="block text-xs font-medium text-slate-600">From date<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1.5 block h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                <label className="block text-xs font-medium text-slate-600">To date<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1.5 block h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Attendance report views">
                {(['overview', 'sessions', 'students'] as ReportTab[]).map((view) => (
                  <button key={view} role="tab" aria-selected={tab === view} onClick={() => setTab(view)} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize transition-colors ${tab === view ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    {view === 'overview' ? 'Overview & trends' : view}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Showing {filteredSessions.length} of {report?.sessions.length || 0} sessions</p>
            </div>

            {tab === 'overview' && (
              <section className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                  <Card className="p-5 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div><h2 className="font-semibold text-slate-900">Monthly attendance</h2><p className="mt-1 text-xs text-slate-500">Students present by month · academic year {latestYear || '—'}</p></div>
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{latestYear || 'No data'}</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                          <defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                          <Tooltip contentStyle={{ borderRadius: 6, borderColor: '#dbeafe' }} />
                          <Area type="monotone" dataKey="attendees" name="Students present" stroke="#2563eb" strokeWidth={2.5} fill="url(#attendanceFill)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card className="p-5 sm:p-6">
                    <div className="mb-3"><h2 className="font-semibold text-slate-900">Session mix</h2><p className="mt-1 text-xs text-slate-500">Physical and virtual sessions</p></div>
                    <div className="relative h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={modalityData} dataKey="value" nameKey="name" innerRadius={59} outerRadius={83} paddingAngle={4} stroke="none">{modalityData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? '#2563eb' : '#0f766e'} />)}</Pie><Tooltip /></PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl text-slate-900">{filteredSessions.length}</strong><span className="text-xs text-slate-500">sessions</span></div>
                    </div>
                    <div className="flex justify-center gap-6 text-xs"><span className="flex items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Physical <b>{physicalCount}</b></span><span className="flex items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 rounded-sm bg-teal-700" /> Virtual <b>{virtualCount}</b></span></div>
                  </Card>
                </div>
                <Card className="p-5 sm:p-6">
                  <div className="mb-5"><h2 className="font-semibold text-slate-900">Attendance by course</h2><p className="mt-1 text-xs text-slate-500">Total students marked present across filtered sessions</p></div>
                  {courseChartData.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={courseChartData} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="course" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} /><Tooltip cursor={{ fill: '#eff6ff' }} /><Bar dataKey="attendees" name="Students present" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No course activity" detail="Sessions will appear here when they match the selected filters." />}
                </Card>
                <Card className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Recent sessions</h2><p className="mt-1 text-xs text-slate-500">Latest activity in the current report</p></div><button onClick={() => setTab('sessions')} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all</button></div>
                  {filteredSessions.length ? <div className="divide-y divide-slate-100">{filteredSessions.slice(0, 4).map((session) => <SessionRow key={session.sessionId} session={session} onOpen={() => openSession(session)} />)}</div> : <EmptyState title="No sessions match these filters" detail="Adjust the year, course, type, or date range." />}
                </Card>
              </section>
            )}

            {tab === 'sessions' && (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSessions.length ? filteredSessions.map((session) => (
                  <Card key={session.sessionId} className="flex flex-col border-blue-100 p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-xs font-bold uppercase tracking-wide text-blue-700">{session.courseCode || 'Course not assigned'}</p><h2 className="mt-1 line-clamp-2 font-semibold text-slate-900">{session.courseTitle}</h2></div>
                      <SessionTypeBadge type={session.type} />
                    </div>
                    <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={15} /> {formatDate(sessionDate(session))}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                      <div><p className="text-xs text-slate-500">Present</p><p className="mt-1 font-semibold text-slate-900">{session.attendeeCount} students</p></div>
                      <div><p className="text-xs text-slate-500">Attendance rate</p><p className="mt-1 font-semibold text-slate-900">{session.attendanceRate === null ? 'Not available' : `${session.attendanceRate}%`}</p></div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-1 text-xs font-semibold ${session.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{session.status === 'active' ? 'Active' : 'Completed'}</span><FinalizationBadge status={session.finalizationStatus} /></div><span className="text-xs text-slate-500">{session.enrolledCount === null ? 'Roster unavailable' : `${session.enrolledCount} enrolled`}</span></div>
                    <div className="mt-auto flex items-center gap-2 pt-5">
                      <Button aria-label="View session details" title="View details" onClick={() => openSession(session)} className="flex-1 gap-2 border border-blue-200 bg-white text-blue-800 hover:bg-blue-50"><Search size={15} /> Details</Button>
                      <Button aria-label="Download Excel report" title={session.status === 'active' ? 'End the session before downloading' : 'Download Excel'} onClick={() => handleDownload(session)} disabled={downloading === session.sessionId || session.status === 'active'} className="border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Download size={16} /></Button>
                      <Button aria-label="Delete session" title="Delete session" onClick={() => handleDelete(session.sessionId)} disabled={deleting === session.sessionId} className="border border-rose-200 bg-white px-3 text-rose-700 hover:bg-rose-50"><Trash2 size={16} /></Button>
                    </div>
                  </Card>
                )) : <div className="col-span-full"><EmptyState title="No sessions found" detail="Try clearing one or more filters to see your attendance sessions." /></div>}
              </section>
            )}

            {tab === 'students' && (
              <section className="space-y-5">
                <Card className="flex flex-col gap-4 border-blue-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="font-semibold text-slate-900">Student attendance history</h2><p className="mt-1 text-sm text-slate-500">Choose a student to review their attendance across your courses.</p></div>
                  <label className="relative block w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search name or matric number" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                </Card>
                {!selectedStudent ? (
                  <section aria-label="Available students" className="space-y-3">
                    <div><h3 className="font-semibold text-slate-900">{studentQuery ? 'Matching students' : 'Students in your sessions'}</h3><p className="mt-1 text-sm text-slate-500">{studentsLoading ? 'Loading student list…' : studentQuery ? 'Select a student to open their attendance history.' : `${students.length} students available in this report`}</p></div>
                    {studentsLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading students…</div> : students.length ? matchingStudents.length ? (
                      <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        {matchingStudents.map((student) => {
                          const option = student.matric ? `${student.name} · ${student.matric}` : student.name;
                          return <button key={student.userId || student.matric || student.name} type="button" onClick={() => setStudentQuery(option)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-blue-50"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{student.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{student.matric || 'Matric number unavailable'}{student.department ? ` · ${student.department}` : ''}</span></span><span className="shrink-0 text-xs font-semibold text-blue-700">View history</span></button>;
                        })}
                      </div>
                    ) : <EmptyState title="No matching students" detail="Try another name or matric number." /> : <EmptyState title="No students in this report yet" detail="Students appear here when they are enrolled in one of your session courses or have attendance records in your sessions." />}
                  </section>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <KpiCard icon={<Users size={19} />} label="Student" value={selectedStudent.name} detail={selectedStudent.matric || 'Matric number unavailable'} accent="blue" />
                      <KpiCard icon={<CalendarDays size={19} />} label="Sessions present" value={studentPresentCount.toLocaleString()} detail={`${studentHistory.length} matching sessions`} accent="teal" />
                      <KpiCard icon={<Activity size={19} />} label="Attendance rate" value={studentRate === null ? '—' : `${studentRate.toFixed(1)}%`} detail={studentRate === null ? 'No roster-based session history' : 'Based on sessions with a known roster'} accent="orange" />
                    </div>
                    <Card className="p-5 sm:p-6">
                      <div className="mb-4"><h3 className="font-semibold text-slate-900">By course</h3><p className="mt-1 text-xs text-slate-500">Present sessions compared with enrolled sessions that have a roster</p></div>
                      {studentCourseData.length ? <div className="space-y-4">{studentCourseData.map((item) => <div key={item.course}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.course}</span><span className="text-slate-500">{item.present}/{item.total} · {item.rate.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${item.rate}%` }} /></div></div>)}</div> : <EmptyState title="No matching attendance history" detail="This student has no sessions in the current filter selection." />}
                    </Card>
                    <Card className="overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-900">Session timeline</h3></div>
                      {studentHistoryLoading ? <div className="p-6 text-sm text-slate-500">Loading attendance history…</div> : studentHistory.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Course</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Attendance</th></tr></thead><tbody className="divide-y divide-slate-100">{studentHistory.map(({ session, attendee }) => <tr key={session.sessionId}><td className="px-5 py-3 text-slate-600">{formatDate(sessionDate(session))}</td><td className="px-5 py-3"><span className="font-semibold text-slate-800">{session.courseCode || 'Unassigned'}</span><span className="block text-xs text-slate-500">{session.courseTitle}</span></td><td className="px-5 py-3"><SessionTypeBadge type={session.type} /></td><td className="px-5 py-3"><StatusBadge status={attendee.status || 'present'} /></td></tr>)}</tbody></table></div> : <EmptyState title="No sessions found" detail="There is no student history for the current filters." />}
                    </Card>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {selectedSession && <SessionDetail session={selectedSession} loading={sessionDetailLoading} error={sessionDetailError} onClose={closeSession} />}
    </main>
  );
}

function KpiCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: string; detail: string; accent: 'blue' | 'teal' | 'orange' }) {
  const accents = {
    blue: 'bg-[#F6F0FB] text-[#6E27AE]',
    teal: 'bg-[#EAF8EF] text-[#0E9F4D]',
    orange: 'bg-[#FFF4E5] text-[#B76A20]',
  };
  return <Card className="relative overflow-hidden border-[#E7DDF0] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-[#5F526A]">{label}</p><p className="mt-3 truncate text-2xl font-bold text-[#2D1A3A]">{value}</p><p className="mt-1 truncate text-xs text-[#6B6172]">{detail}</p></div><div className={`rounded-md p-2 ${accents[accent]}`}>{icon}</div></div></Card>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block text-xs font-medium text-[#5F526A]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block h-10 w-full rounded-md border border-[#E7DDF0] bg-white px-2 text-sm text-[#2D1A3A] outline-none focus:border-[#8437C8] focus:ring-2 focus:ring-[#E8DDF7]">{children}</select></label>;
}

function SessionTypeBadge({ type }: { type: AttendanceSession['type'] }) {
  return <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${type === 'physical' ? 'bg-[#F6F0FB] text-[#6E27AE]' : 'bg-[#EAF8EF] text-[#0E9F4D]'}`}>{type === 'physical' ? <MapPin size={12} /> : <Video size={12} />}{type === 'physical' ? 'Physical' : 'Virtual'}</span>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-1 text-xs font-semibold capitalize ${status === 'present' ? 'bg-[#EAF8EF] text-[#0E9F4D]' : 'bg-[#FFF1F2] text-[#B42318]'}`}>{status}</span>;
}

function FinalizationBadge({ status }: { status?: AttendanceSession['finalizationStatus'] }) {
  if (status === 'pending' || status === 'processing') {
    return <span className="inline-flex items-center gap-1 rounded bg-[#FFF4E5] px-2 py-1 text-xs font-semibold text-[#B76A20]"><Clock3 size={12} />Finalizing attendance</span>;
  }
  if (status === 'retrying') {
    return <span className="inline-flex items-center gap-1 rounded bg-[#FFF1F2] px-2 py-1 text-xs font-semibold text-[#B42318]"><Activity size={12} />Retry scheduled</span>;
  }
  if (status === 'skipped') {
    return <span className="rounded bg-[#F3F4F6] px-2 py-1 text-xs font-medium text-[#5F526A]" title="A course roster could not be resolved for this session">Roster unavailable</span>;
  }
  return null;
}

function SessionRow({ session, onOpen }: { session: AttendanceSession; onOpen: () => void }) {
  return <button onClick={onOpen} className="flex w-full flex-col gap-3 py-4 text-left transition-colors hover:bg-[#F6F0FB]/80 sm:flex-row sm:items-center sm:justify-between sm:px-2"><div className="flex min-w-0 items-center gap-3"><span className={`rounded-md p-2 ${session.type === 'physical' ? 'bg-[#F6F0FB] text-[#6E27AE]' : 'bg-[#EAF8EF] text-[#0E9F4D]'}`}>{session.type === 'physical' ? <MapPin size={17} /> : <Video size={17} />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#2D1A3A]">{session.courseCode || 'Unassigned'} <span className="font-normal text-[#6B6172]">· {session.courseTitle}</span></p><p className="mt-1 flex items-center gap-1 text-xs text-[#6B6172]"><Clock3 size={12} />{formatDate(sessionDate(session))}</p></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><SessionTypeBadge type={session.type} /><span className="whitespace-nowrap text-sm font-semibold text-[#4F3D5D]">{session.attendeeCount} present</span><span className="text-sm font-medium text-[#6E27AE]">Details</span></div></button>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-dashed border-[#D8C5EA] bg-white/70 px-6 py-12 text-center"><BookOpen className="mx-auto mb-3 text-[#A688D6]" size={25} /><h3 className="font-semibold text-[#2D1A3A]">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-[#6B6172]">{detail}</p></div>;
}

function SessionDetail({ session, loading, error, onClose }: { session: AttendanceSession; loading: boolean; error: string; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const attendees = session.attendees || [];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="session-detail-title" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SessionTypeBadge type={session.type} />
              <span className={`rounded px-2 py-1 text-xs font-semibold ${session.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{session.status}</span>
              <FinalizationBadge status={session.finalizationStatus} />
            </div>
            <h2 id="session-detail-title" className="mt-3 text-xl font-bold text-slate-900">{session.courseCode || 'Session'} · {session.courseTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{formatDate(sessionDate(session))}</p>
          </div>
          <button type="button" aria-label="Close session details" onClick={onClose} className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
        </header>
        <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-5">
          <div><p className="text-xs text-slate-500">Present</p><p className="mt-1 font-bold text-slate-900">{session.attendeeCount}</p></div>
          <div><p className="text-xs text-slate-500">Enrolled</p><p className="mt-1 font-bold text-slate-900">{session.enrolledCount ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Attendance</p><p className="mt-1 font-bold text-slate-900">{session.attendanceRate === null ? '—' : `${session.attendanceRate}%`}</p></div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {error ? <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p> : loading && !session.attendees ? (
            <p className="text-sm text-slate-500">Loading attendee list…</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Attendee list</h3>
                <span className="text-xs text-slate-500">{attendees.length} records</span>
              </div>
              {session.enrolledCount === null && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Enrollment roster is unavailable for this course. Only recorded attendees can be verified.</p>}
              {attendees.length ? (
                <div className="divide-y divide-slate-100">
                  {attendees.map((attendee, index) => (
                    <div key={`${attendee.userId || attendee.matric || attendee.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{attendee.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{attendee.matric || 'Matric unavailable'}{attendee.timestamp ? ` · ${new Date(attendee.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                      </div>
                      <StatusBadge status={attendee.status || 'present'} />
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No attendee records" detail="No attendance entries were recorded for this session." />}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
