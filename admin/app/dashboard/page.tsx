'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminSessionsAPI, statsAPI } from '../../lib/api';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Stats {
  totalCourses: number;
  totalDepartments: number;
  totalLevels: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalDepartments: 0,
    totalLevels: 0
  });
  const [activeSessionCount, setActiveSessionCount] = useState(0);

  useEffect(() => {
    // Check if admin is logged in
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
      router.push('/');
      return;
    }

    try {
      const parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
      loadStats();
      adminSessionsAPI.list('active').then((result) => setActiveSessionCount(result.activeCount)).catch(() => {});
    } catch (err) {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadStats = async () => {
    try {
      const response = await statsAPI.getCourseStats();
      if (response.data) {
        setStats(response.data as Stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await adminSessionsAPI.logout();
    } catch {
      // Clear the browser state even if the backend cannot be reached.
    }
    localStorage.removeItem('admin');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  const actionCards = [
    {
      id: 'sessions',
      title: 'Attendance Sessions',
      description: 'Monitor live physical and virtual classes and manage active sessions',
      icon: '●',
      color: 'from-teal-600 to-cyan-700',
      href: '/dashboard/sessions',
      count: activeSessionCount
    },
    {
      id: 'courses',
      title: 'Manage Courses',
      description: 'Add, edit, and manage university courses by department and level',
      icon: '📚',
      color: 'from-blue-500 to-blue-600',
      href: '/dashboard/courses',
      count: stats.totalCourses
    },
    {
      id: 'departments',
      title: 'Departments',
      description: 'Create and manage academic departments',
      icon: '🏢',
      color: 'from-purple-500 to-purple-600',
      href: '/dashboard/departments',
      count: stats.totalDepartments
    },
    {
      id: 'levels',
      title: 'Academic Levels',
      description: 'Configure degree levels (100, 200, 300, 400, etc.)',
      icon: '🎓',
      color: 'from-green-500 to-green-600',
      href: '/dashboard/levels',
      count: stats.totalLevels
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage admin users and their permissions',
      icon: '👥',
      color: 'from-orange-500 to-orange-600',
      href: '/dashboard/users',
      count: 0
    },
    {
      id: 'settings',
      title: 'System Settings',
      description: 'Configure system-wide settings and preferences',
      icon: '⚙️',
      color: 'from-red-500 to-red-600',
      href: '/dashboard/settings',
      count: 0
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">VMeet Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Welcome back</p>
                <p className="text-sm font-semibold text-gray-900">{admin.name}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                {admin.name.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="ml-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 shadow-sm hover:shadow-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 mb-12 text-white">
          <h2 className="text-4xl font-bold mb-3">Welcome to VMeet Admin Portal</h2>
          <p className="text-blue-100 text-lg">
            Manage your university&apos;s academic structure, courses, and system settings efficiently.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {/* Card 1 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600 hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Courses</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalCourses}</p>
              </div>
              <span className="text-3xl">📚</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-600 hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Departments</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalDepartments}</p>
              </div>
              <span className="text-3xl">🏢</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600 hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Academic Levels</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalLevels}</p>
              </div>
              <span className="text-3xl">🎓</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-600 hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Admin Users</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">1</p>
              </div>
              <span className="text-3xl">👤</span>
            </div>
          </div>
        </div>

        {/* Action Cards Section */}
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {actionCards.map((card) => (
              <Link key={card.id} href={card.href}>
                <div className="bg-white rounded-lg shadow-sm hover:shadow-xl transition duration-300 overflow-hidden h-full cursor-pointer group">
                  {/* Card Header with Gradient */}
                  <div className={`bg-gradient-to-r ${card.color} p-6 text-white`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold">{card.title}</h3>
                        <p className="text-sm opacity-90 mt-1">{card.description}</p>
                      </div>
                      <span className="text-4xl group-hover:scale-110 transition duration-300">{card.icon}</span>
                    </div>
                  </div>
                  
                  {/* Card Body */}
                  <div className="p-6">
                    <div className="flex justify-between items-center">
                      <span className="text-3xl font-bold text-gray-900">{card.count}</span>
                      <span className="text-blue-600 group-hover:translate-x-1 transition duration-300">
                        →
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-4">Click to manage {card.title.toLowerCase()}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="mt-12 bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Getting Started</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">1</div>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">Set Up Departments</h4>
                <p className="mt-2 text-gray-600">Create your university departments first</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">2</div>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">Define Academic Levels</h4>
                <p className="mt-2 text-gray-600">Configure degree levels (100, 200, 300, 400)</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">3</div>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">Add Courses</h4>
                <p className="mt-2 text-gray-600">Create courses linked to departments and levels</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
