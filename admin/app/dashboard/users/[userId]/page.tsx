'use client'

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface UserDetail {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  department?: string;
  level?: string;
  matricNumber?: string;
  isRestricted: boolean;
  registeredAt?: string;
  lastUpdated?: string;
  isRegistered?: boolean;
  activeSessions?: number;
  totalSessions?: number;
  attendanceCount?: number;
  courses?: Array<{
    _id: string;
    code: string;
    title: string;
  }>;
}

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    // Check if admin is logged in
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
      router.push('/');
      return;
    }

    loadUserDetails();
  }, [router, userId]);

  const loadUserDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:8000/get-user-role?userId=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json();
      setUser({
        _id: data._id || userId,
        userId: data.userId || userId,
        name: data.name || 'Unknown',
        email: data.email || 'N/A',
        role: data.role || 'student',
        department: data.department || 'N/A',
        level: data.level || 'N/A',
        matricNumber: data.matricNumber || 'N/A',
        isRestricted: data.isRestricted || false,
        registeredAt: data.registeredAt,
        lastUpdated: data.lastUpdated,
        isRegistered: data.isRegistered,
        activeSessions: data.roleData?.activeSessions || 0,
        totalSessions: data.roleData?.totalSessions || 0,
        attendanceCount: data.roleData?.attendanceCount || 0,
        courses: data.courses || [],
      });
    } catch (error) {
      console.error('Error loading user details:', error);
      alert('Failed to load user details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestrictUser = async () => {
    if (!user) return;

    try {
      setActionLoading(true);
      const response = await fetch(
        `http://localhost:8000/admin/restrict-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.userId,
            restrict: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to restrict user');
      }

      setUser({ ...user, isRestricted: true });
      alert('User has been restricted successfully');
    } catch (error) {
      console.error('Error restricting user:', error);
      alert('Failed to restrict user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnrestrictUser = async () => {
    if (!user) return;

    try {
      setActionLoading(true);
      const response = await fetch(
        `http://localhost:8000/admin/restrict-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.userId,
            restrict: false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unrestrict user');
      }

      setUser({ ...user, isRestricted: false });
      alert('User has been unrestricted successfully');
    } catch (error) {
      console.error('Error unresricting user:', error);
      alert('Failed to unrestrict user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    try {
      setActionLoading(true);
      const response = await fetch(
        `http://localhost:8000/admin/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.userId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      alert('User has been deleted successfully');
      router.push('/dashboard/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    } finally {
      setActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400">Loading user details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400">User not found</p>
          </div>
          <div className="mt-6">
            <Link
              href="/dashboard/users"
              className="inline-block bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              ← Back to Users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-600 text-white';
      case 'lecturer':
        return 'bg-green-600 text-white';
      case 'student':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">User Details</h1>
          <p className="text-gray-400">View and manage user information</p>
        </div>

        {/* User Information Card */}
        <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700 mb-6">
          {/* User Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{user.name}</h2>
              <p className="text-gray-400 mb-3">{user.email}</p>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.isRestricted
                      ? 'bg-red-600/30 text-red-300'
                      : 'bg-green-600/30 text-green-300'
                  }`}
                >
                  {user.isRestricted ? 'Restricted' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-t border-gray-700 pt-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User ID</p>
              <p className="text-white mt-1">{user.userId}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</p>
              <p className="text-white mt-1">{user.department}</p>
            </div>

            {user.role === 'student' && (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Matric Number</p>
                  <p className="text-white mt-1">{user.matricNumber}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Level</p>
                  <p className="text-white mt-1">{user.level}</p>
                </div>
              </>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Registered</p>
              <p className="text-white mt-1">{user.isRegistered ? 'Yes' : 'No'}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Registered At</p>
              <p className="text-white mt-1">
                {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>

            {user.role === 'student' && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classes Attended</p>
                <p className="text-white mt-1">{user.attendanceCount || 0}</p>
              </div>
            )}

            {user.role === 'lecturer' && (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Sessions</p>
                  <p className="text-white mt-1">{user.activeSessions || 0}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sessions</p>
                  <p className="text-white mt-1">{user.totalSessions || 0}</p>
                </div>
              </>
            )}
          </div>

          {/* Courses Section */}
          {user.courses && user.courses.length > 0 && (
            <div className="border-t border-gray-700 pt-6 mb-8">
              <h3 className="text-xl font-bold text-white mb-4">Assigned Courses</h3>
              <div className="grid grid-cols-1 gap-3">
                {user.courses.map((course) => (
                  <div key={course._id} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
                    <p className="text-white font-semibold">{course.code}</p>
                    <p className="text-gray-300 text-sm">{course.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t border-gray-700 pt-6 flex gap-3 flex-wrap">
            {user.isRestricted ? (
              <button
                onClick={handleUnrestrictUser}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                {actionLoading ? 'Processing...' : 'Unrestrict User'}
              </button>
            ) : (
              <button
                onClick={handleRestrictUser}
                disabled={actionLoading}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                {actionLoading ? 'Processing...' : 'Restrict User'}
              </button>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Delete User
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-3">Confirm Delete</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete <span className="font-semibold">{user.name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                >
                  {actionLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <Link
            href="/dashboard/users"
            className="inline-block bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            ← Back to Users
          </Link>
        </div>
      </div>
    </div>
  );
}
