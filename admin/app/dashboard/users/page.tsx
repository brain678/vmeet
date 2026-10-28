'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  department?: string;
  isRestricted: boolean;
  registeredAt?: string;
  lastUpdated?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'lecturer' | 'admin'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    // Check if admin is logged in
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
      router.push('/');
      return;
    }

    // Reset to page 1 when search term changes
    setCurrentPage(1);
  }, [router, searchTerm]);

  useEffect(() => {
    loadUsers();
  }, [currentPage, filterRole, searchTerm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('skip', String((currentPage - 1) * itemsPerPage));
      params.append('limit', String(itemsPerPage));
      
      if (filterRole !== 'all') {
        params.append('role', filterRole);
      }
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(
        `http://localhost:8000/get-all-users?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.data || []);
      setTotalUsers(data.total || 0);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // For client-side filtering as fallback (in case backend doesn't support search param)
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.trim().toLowerCase();
    
    // If no search term, return all users
    if (!searchLower) return true;
    
    // Search across all relevant fields
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.userId.toLowerCase().includes(searchLower) ||
      (user.department && user.department.toLowerCase().includes(searchLower)) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(totalUsers / itemsPerPage);

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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">User Management</h1>
          <p className="text-gray-400">Manage all users in the system</p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search Users</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Name, email, ID, role, or dept..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-300 font-bold"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              {searchTerm && (
                <p className="text-xs text-gray-400 mt-1">
                  Found {filteredUsers.length} match{filteredUsers.length !== 1 ? 'es' : ''}
                </p>
              )}
            </div>

            {/* Filter by Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Role</label>
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="lecturer">Lecturers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Stats */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Statistics</label>
              <div className="bg-gray-700 rounded-lg px-4 py-2 text-white">
                <p className="text-sm">Total Users: <span className="font-bold">{totalUsers}</span></p>
                <p className="text-sm">Page {currentPage} of {totalPages || 1}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
            <div className="mb-4">
              <p className="text-gray-400 font-medium mb-2">No users found</p>
              <p className="text-sm text-gray-500 mb-4">
                {searchTerm
                  ? `No users match "${searchTerm}". Try searching by name, email, ID, role, or department.`
                  : filterRole !== 'all'
                  ? `No ${filterRole}s found.`
                  : 'No users available.'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Name</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Role</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Department</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={user._id}
                      className={`border-b border-gray-700 hover:bg-gray-700/30 transition ${
                        index % 2 === 0 ? 'bg-gray-800/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-white font-medium">{user.name}</td>
                      <td className="px-6 py-4 text-gray-300">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{user.department || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            user.isRestricted
                              ? 'bg-red-600/30 text-red-300'
                              : 'bg-green-600/30 text-green-300'
                          }`}
                        >
                          {user.isRestricted ? 'Restricted' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/users/${user.userId}`}
                          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-900 px-6 py-4 border-t border-gray-700">
                <div className="flex justify-between items-center gap-4">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition"
                  >
                    ← Previous
                  </button>

                  <div className="flex gap-2 flex-wrap justify-center">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      // Show first page, last page, current page, and pages adjacent to current
                      const isVisible = pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1;
                      
                      if (!isVisible && i > 0 && i < totalPages - 1) {
                        return null;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded-lg transition ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition"
                  >
                    Next →
                  </button>
                </div>
                <div className="text-center mt-3 text-xs text-gray-400">
                  Page {currentPage} of {totalPages} • Showing {filteredUsers.length} of {totalUsers} users
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
