'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { coursesAPI, departmentsAPI, levelsAPI } from '../../../lib/api';

interface Department {
  id?: string;
  _id?: string;
  name: string;
  code: string;
}

interface Level {
  id?: string;
  _id?: string;
  name: string;
  code: number;
}

interface Course {
  id?: string;
  _id?: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  levelId: string;
  levelCode?: number;
  credits: number;
  createdAt?: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    departmentId: '',
    levelId: '',
    credits: 3,
    description: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'title' | 'dept' | 'level'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
      router.push('/');
      return;
    }
    
    setIsAdmin(true);
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [coursesRes, deptsRes, levelsRes] = await Promise.all([
        coursesAPI.getAll(0, 1000),
        departmentsAPI.getAll(0, 1000),
        levelsAPI.getAll(0, 1000)
      ]);

      const coursesList = coursesRes.data || [];
      const deptsList = deptsRes.data || [];
      const levelsList = levelsRes.data || [];

      console.log('Loaded courses:', coursesList.length);
      console.log('Loaded departments:', deptsList.length);
      console.log('Loaded levels:', levelsList.length);
      console.log('Sample course:', coursesList[0]);
      console.log('Sample department:', deptsList[0]);
      console.log('Sample level:', levelsList[0]);

      // Normalize IDs and populate department/level names
      const normalizedCourses = coursesList.map(c => {
        // Try to find department
        let deptInfo = null;
        if (c.departmentId) {
          deptInfo = deptsList.find(d => 
            (d.id || d._id) === c.departmentId || 
            String(d.id || d._id) === String(c.departmentId)
          );
        }
        
        // Try to find level
        let levelInfo = null;
        if (c.levelId) {
          levelInfo = levelsList.find(l => 
            (l.id || l._id) === c.levelId || 
            String(l.id || l._id) === String(c.levelId)
          );
        }
        
        return {
          ...c,
          id: c.id || c._id,
          departmentId: c.departmentId,
          levelId: c.levelId,
          departmentName: c.departmentName || deptInfo?.name || 'Unknown',
          levelCode: levelInfo?.code || c.levelCode || 100
        };
      });

      console.log('Normalized courses sample:', normalizedCourses[0]);
      setCourses(normalizedCourses);
      setDepartments(
        deptsList.map(d => ({
          ...d,
          id: d.id || d._id
        }))
      );
      setLevels(
        levelsList.map(l => ({
          ...l,
          id: l.id || l._id
        }))
      );

      console.log('Normalized courses:', normalizedCourses.length);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMsg);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = () => {
    setEditingId(null);
    setFormData({
      code: '',
      title: '',
      departmentId: '',
      levelId: '',
      credits: 3,
      description: ''
    });
    setShowModal(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingId(course.id || course._id || null);
    setFormData({
      code: course.code,
      title: course.title,
      departmentId: course.departmentId,
      levelId: course.levelId,
      credits: course.credits,
      description: ''
    });
    setShowModal(true);
  };

  const handleSaveCourse = async () => {
    if (!formData.code || !formData.title || !formData.departmentId || !formData.levelId) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setError(null);

      if (editingId) {
        await coursesAPI.update(editingId, {
          code: formData.code,
          title: formData.title,
          departmentId: formData.departmentId,
          levelId: formData.levelId,
          credits: formData.credits,
          description: formData.description
        });
      } else {
        await coursesAPI.create({
          code: formData.code,
          title: formData.title,
          departmentId: formData.departmentId,
          levelId: formData.levelId,
          credits: formData.credits,
          description: formData.description
        });
      }

      await loadData();
      setShowModal(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save course';
      setError(errorMsg);
      console.error('Error saving course:', err);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      setError(null);
      await coursesAPI.delete(id);
      await loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete course';
      setError(errorMsg);
      console.error('Error deleting course:', err);
    }
  };

  const filteredCourses = courses.filter(course => {
    // Search filter - case insensitive, trim whitespace
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesSearch = !searchLower || 
      course.code.toLowerCase().includes(searchLower) ||
      course.title.toLowerCase().includes(searchLower) ||
      (course.departmentName && course.departmentName.toLowerCase().includes(searchLower));
    
    // Department filter - match by departmentId
    const matchesDept = !filterDept || (course.departmentId && course.departmentId === filterDept);
    
    // Level filter - match by levelId or levelCode
    let matchesLevel = !filterLevel;
    if (filterLevel) {
      if (course.levelId) {
        matchesLevel = course.levelId === filterLevel;
      } else {
        // Fallback: try matching by code if no levelId
        const selectedLevel = levels.find(l => (l.id || l._id) === filterLevel);
        if (selectedLevel && course.levelCode) {
          matchesLevel = course.levelCode === selectedLevel.code;
        }
      }
    }
    
    return matchesSearch && matchesDept && matchesLevel;
  });

  // Sort filtered courses
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'code':
        compareValue = a.code.localeCompare(b.code);
        break;
      case 'title':
        compareValue = a.title.localeCompare(b.title);
        break;
      case 'dept':
        const deptA = a.departmentName || 'Unknown';
        const deptB = b.departmentName || 'Unknown';
        compareValue = deptA.localeCompare(deptB);
        break;
      case 'level':
        const levelA = a.levelCode || 100;
        const levelB = b.levelCode || 100;
        compareValue = levelA - levelB;
        break;
      default:
        compareValue = 0;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDept, filterLevel, sortBy, sortOrder]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedCourses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCourses = sortedCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold">
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Manage Courses</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6 flex justify-between items-center">
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">
              ×
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">University Courses</h2>
            <p className="text-gray-600 mt-1">Manage all courses by department and academic level</p>
          </div>
          <button
            onClick={handleAddCourse}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add New Course</span>
          </button>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters & Sorting</h3>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterDept('');
                setFilterLevel('');
                setSortBy('code');
                setSortOrder('asc');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium text-sm transition"
            >
              Reset Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Code, title, or dept..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              {searchTerm && (
                <p className="text-xs text-gray-500 mt-1">
                  Found {filteredCourses.filter(c => 
                    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.departmentName && c.departmentName.toLowerCase().includes(searchTerm.toLowerCase()))
                  ).length} matches
                </p>
              )}
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">All Levels</option>
                {levels.map(level => (
                  <option key={level.id} value={level.id}>{level.name}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'code' | 'title' | 'dept' | 'level')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="code">Course Code</option>
                <option value="title">Course Title</option>
                <option value="dept">Department</option>
                <option value="level">Academic Level</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="asc">Ascending (A-Z)</option>
                <option value="desc">Descending (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm || filterDept || filterLevel) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Active Filters:</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Search: "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="ml-2 hover:text-blue-600">
                      ×
                    </button>
                  </span>
                )}
                {filterDept && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    Dept: {departments.find(d => d.id === filterDept)?.name}
                    <button onClick={() => setFilterDept('')} className="ml-2 hover:text-purple-600">
                      ×
                    </button>
                  </span>
                )}
                {filterLevel && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Level: {levels.find(l => l.id === filterLevel)?.name}
                    <button onClick={() => setFilterLevel('')} className="ml-2 hover:text-green-600">
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Courses Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">
                Showing <strong>{paginatedCourses.length}</strong> of <strong>{sortedCourses.length}</strong> courses
              </p>
              {(filterDept || filterLevel || searchTerm) && (
                <p className="text-xs text-gray-500 mt-1">
                  Filtered from <strong>{courses.length}</strong> total courses
                </p>
              )}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Sorted by:</span> {sortBy === 'code' && 'Course Code'} {sortBy === 'title' && 'Title'} {sortBy === 'dept' && 'Department'} {sortBy === 'level' && 'Level'} ({sortOrder === 'asc' ? '↑' : '↓'})
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Level</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Credits</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedCourses.length > 0 ? (
                  paginatedCourses.map(course => (
                    <tr key={course.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-blue-600">{course.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-900">{course.title}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                          {course.departmentName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          {course.levelCode} Level
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                        {course.credits} Credits
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleEditCourse(course)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded font-medium text-sm transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(course.id || course._id || '')}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded font-medium text-sm transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12">
                      <div className="text-center">
                        <p className="text-gray-500 font-medium mb-2">No courses found</p>
                        <p className="text-sm text-gray-400 mb-4">
                          {searchTerm && !filterDept && !filterLevel && `No courses match "${searchTerm}"`}
                          {filterDept && !searchTerm && !filterLevel && `No courses in selected department`}
                          {filterLevel && !searchTerm && !filterDept && `No courses at selected level`}
                          {(searchTerm && filterDept) || (searchTerm && filterLevel) || (filterDept && filterLevel) || (searchTerm && filterDept && filterLevel) ? `No courses match your current filters` : `No courses available`}
                        </p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setFilterDept('');
                            setFilterLevel('');
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredCourses.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`
                    px-4 py-2 rounded-lg font-semibold text-sm transition duration-200
                    flex items-center space-x-1
                    ${currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                    }
                  `}
                >
                  <span>←</span>
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`
                    px-4 py-2 rounded-lg font-semibold text-sm transition duration-200
                    flex items-center space-x-1
                    ${currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                    }
                  `}
                >
                  <span>Next</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex justify-between items-center border-b border-blue-700">
              <h3 className="text-xl font-bold">
                {editingId ? 'Edit Course' : 'Add New Course'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-blue-100 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Course Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course Code *</label>
                  <input
                    type="text"
                    placeholder="e.g., CS101"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Credits */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={formData.credits}
                    onChange={(e) => setFormData({...formData, credits: parseInt(e.target.value) || 3})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Course Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Course Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Introduction to Computer Science"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Department *</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Level *</label>
                  <select
                    value={formData.levelId}
                    onChange={(e) => setFormData({...formData, levelId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Select Level</option>
                    {levels.map(level => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  placeholder="Enter course description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Make sure you have created the required department and academic level before adding a course.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
              >
                {editingId ? 'Update Course' : 'Add Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
