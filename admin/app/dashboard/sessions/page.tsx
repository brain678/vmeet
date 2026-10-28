'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, CalendarClock, MapPin, RefreshCw, Video, X } from 'lucide-react';
import { adminSessionsAPI, type AdminSession, type AdminSessionAttendee } from '../../../lib/api';

type StatusFilter = 'all' | 'active' | 'completed';
type TypeFilter = 'all' | 'physical' | 'virtual';

function formatDate(value: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminSessionsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);
  const [attendees, setAttendees] = useState<AdminSessionAttendee[]>([]);
  const [attendeesTruncated, setAttendeesTruncated] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSessions = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const response = await adminSessionsAPI.list(statusFilter);
      setSessions(response.data || []);
      setActiveCount(response.activeCount || 0);
      setCompletedCount(response.completedCount || 0);
      setError('');
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : 'Unable to load attendance sessions.';
      if (/admin session expired|401|authentication/i.test(detail)) {
        localStorage.removeItem('admin');
        router.replace('/');
        return;
      }
      setError(detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, statusFilter]);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('admin');
    if (!storedAdmin) {
      router.replace('/');
      return;
    }
    try {
      const parsed = JSON.parse(storedAdmin);
      setAdmin({ name: parsed.name || 'Admin', email: parsed.email || '' });
    } catch {
      localStorage.removeItem('admin');
      router.replace('/');
      return;
    }

    adminSessionsAPI.verify().catch(() => {
      localStorage.removeItem('admin');
      router.replace('/');
    });
    loadSessions();
    const interval = window.setInterval(() => loadSessions(), 15000);
    return () => window.clearInterval(interval);
  }, [loadSessions, router]);

  const visibleSessions = useMemo(() => sessions.filter((session) => {
    if (typeFilter !== 'all' && session.type !== typeFilter) return false;
    const normalized = search.trim().toLowerCase();
    return !normalized || [session.courseCode, session.courseTitle, session.hostName, session.hostId, session.sessionId]
      .some((value) => value?.toLowerCase().includes(normalized));
  }), [sessions, typeFilter, search]);

  const openDetails = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSelectedSession(null);
    setAttendees([]);
    try {
      const detail = await adminSessionsAPI.detail(sessionId);
      setSelectedSession(detail.session);
      setAttendees(detail.attendees || []);
      setAttendeesTruncated(detail.attendeesTruncated);
    } catch (detailError) {
      setMessage(detailError instanceof Error ? detailError.message : 'Could not load session details.');
    }
  };

  const endSession = async (session: AdminSession) => {
    if (!window.confirm(`End the active ${session.type} session for ${session.courseCode || session.courseTitle}? Students will no longer be able to mark attendance.`)) return;
    setEndingSessionId(session.sessionId);
    setMessage('');
    try {
      const response = await adminSessionsAPI.end(session.sessionId);
      setMessage(response.message || 'Session ended. Attendance finalization is queued.');
      await loadSessions(true);
      if (selectedSessionId === session.sessionId) await openDetails(session.sessionId);
    } catch (endError) {
      setMessage(endError instanceof Error ? endError.message : 'Could not end session.');
    } finally {
      setEndingSessionId('');
    }
  };

  const handleLogout = async () => {
    try {
      await adminSessionsAPI.logout();
    } catch {
      // Local logout still clears the browser session if the backend is unavailable.
    }
    localStorage.removeItem('admin');
    router.replace('/');
  };

  if (!admin) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Checking admin access…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-900">VMeet Admin</Link>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <h1 className="truncate text-sm font-semibold text-slate-800">Attendance sessions</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">{admin.name}</span>
            <button onClick={() => loadSessions(true)} disabled={refreshing} aria-label="Refresh sessions" title="Refresh sessions" className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
            <button onClick={handleLogout} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Log out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">Operations</p><h2 className="mt-1 text-2xl font-bold">Attendance sessions</h2><p className="mt-1 text-sm text-slate-500">Monitor live classes and inspect their attendance records.</p></div>
          <div className="flex gap-3">
            <Metric label="Active now" value={activeCount} tone="emerald" />
            <Metric label="Completed" value={completedCount} tone="blue" />
          </div>
        </section>

        {message && <div role="status" className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={16} /></button></div>}
        {error && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="block text-xs font-semibold text-slate-600">Search sessions<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course, lecturer, or session ID" className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <Filter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={['all', 'active', 'completed']} />
          <Filter label="Type" value={typeFilter} onChange={(value) => setTypeFilter(value as TypeFilter)} options={['all', 'physical', 'virtual']} />
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
            <div><h3 className="text-sm font-semibold">Session list</h3><p className="mt-0.5 text-xs text-slate-500">Auto-refreshes every 15 seconds</p></div>
            <span className="text-xs text-slate-500">{visibleSessions.length} shown</span>
          </div>
          {loading ? <div className="space-y-3 p-5">{[0, 1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded bg-slate-100" />)}</div> : visibleSessions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3 font-semibold">Course / Session</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Host</th><th className="px-5 py-3 font-semibold">Started</th><th className="px-5 py-3 font-semibold">Present</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSessions.map((session) => <tr key={session.sessionId} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3"><p className="font-semibold text-slate-900">{session.courseCode || 'Unassigned'} · {session.courseTitle}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{session.sessionId}</p></td>
                    <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${session.type === 'physical' ? 'bg-blue-50 text-blue-800' : 'bg-violet-50 text-violet-800'}`}>{session.type === 'physical' ? <MapPin size={13} /> : <Video size={13} />}{session.type}</span></td>
                    <td className="px-5 py-3 text-slate-600">{session.hostName || session.hostId || 'Unknown'}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(session.startTime)}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">{session.attendeeCount}</td>
                    <td className="px-5 py-3"><div className="flex flex-col items-start gap-1"><span className={`rounded px-2 py-1 text-xs font-semibold ${session.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{session.status}</span><FinalizationStatus status={session.finalizationStatus} /></div></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><button onClick={() => openDetails(session.sessionId)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Details</button>{session.status === 'active' && <button onClick={() => endSession(session)} disabled={endingSessionId === session.sessionId} className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{endingSessionId === session.sessionId ? 'Ending…' : 'End session'}</button>}</div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : <div className="px-5 py-14 text-center"><Activity className="mx-auto text-slate-400" size={26} /><p className="mt-3 font-semibold text-slate-800">No sessions found</p><p className="mt-1 text-sm text-slate-500">Try another status, type, or search term.</p></div>}
        </section>
      </div>

      {selectedSessionId && <SessionDrawer session={selectedSession} attendees={attendees} truncated={attendeesTruncated} loading={!selectedSession} onClose={() => { setSelectedSessionId(''); setSelectedSession(null); }} />}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'blue' }) {
  return <div className={`min-w-28 rounded-lg border px-4 py-3 ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}><p className="text-xs font-medium text-slate-600">{label}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${tone === 'emerald' ? 'text-emerald-800' : 'text-blue-800'}`}>{value}</p></div>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block text-xs font-semibold capitalize text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 min-w-36 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{options.map((option) => <option key={option} value={option}>{option === 'all' ? `All ${label.toLowerCase()}` : option}</option>)}</select></label>;
}

function FinalizationStatus({ status }: { status: string }) {
  if (status === 'pending' || status === 'processing') return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><CalendarClock size={12} />Finalizing</span>;
  if (status === 'retrying') return <span className="inline-flex items-center gap-1 text-xs text-rose-700"><Activity size={12} />Retrying</span>;
  if (status === 'skipped') return <span className="text-xs text-slate-500">Roster unavailable</span>;
  return null;
}

function SessionDrawer({ session, attendees, truncated, loading, onClose }: { session: AdminSession | null; attendees: AdminSessionAttendee[]; truncated: boolean; loading: boolean; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Session details" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-5"><div><p className="text-xs font-bold uppercase text-blue-700">Session details</p><h2 className="mt-1 text-lg font-bold text-slate-900">{session?.courseCode || 'Session'} · {session?.courseTitle || 'Loading…'}</h2><p className="mt-1 font-mono text-xs text-slate-500">{session?.sessionId}</p></div><button onClick={onClose} aria-label="Close details" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>{session && <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-5"><Metric label="Present" value={session.attendeeCount} tone="emerald" /><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">Type</p><p className="mt-1 text-sm font-semibold capitalize">{session.type}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">Status</p><p className="mt-1 text-sm font-semibold capitalize">{session.status}</p></div></div>}<div className="flex-1 overflow-y-auto p-5">{truncated && <p className="mb-3 rounded bg-amber-50 p-3 text-xs text-amber-800">Showing the first 5,000 attendee records.</p>}{loading ? <p className="text-sm text-slate-500">Loading attendee records…</p> : attendees.length ? <div className="divide-y divide-slate-100">{attendees.map((attendee, index) => <div key={`${attendee.userId}-${index}`} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{attendee.name || 'Unknown student'}</p><p className="mt-0.5 text-xs text-slate-500">{attendee.matric || 'Matric unavailable'}{attendee.timestamp ? ` · ${formatDate(attendee.timestamp)}` : ''}</p></div><span className={`rounded px-2 py-1 text-xs font-semibold capitalize ${attendee.attendanceStatus === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{attendee.attendanceStatus}</span></div>)}</div> : <p className="py-10 text-center text-sm text-slate-500">No attendee records.</p>}</div></section></div>;
}
