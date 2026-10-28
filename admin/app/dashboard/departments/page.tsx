'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { departmentsAPI } from '../../../lib/api';

interface Department {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  description?: string;
  headOfDepartment?: string;
  createdAt?: string;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    headOfDepartment: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      const response = await departmentsAPI.getAll(0, 1000);
      const deptsList = response.data || [];
      setDepartments(
        deptsList.map(d => ({
          ...d,
          id: d.id || d._id
        }))
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load departments';
      setError(errorMsg);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      headOfDepartment: ''
    });
    setShowModal(true);
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingId(dept.id || dept._id || null);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      headOfDepartment: dept.headOfDepartment || ''
    });
    setShowModal(true);
  };

  const handleSaveDepartment = async () => {
    if (!formData.name || !formData.code) {
      setError('Department name and code are required');
      return;
    }

    try {
      setError(null);

      if (editingId) {
        await departmentsAPI.update(editingId, formData);
      } else {
        await departmentsAPI.create(formData);
      }

      await loadData();
      setShowModal(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save department';
      setError(errorMsg);
      console.error('Error saving department:', err);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure? This will affect all associated courses.')) return;

    try {
      setError(null);
      await departmentsAPI.delete(id);
      await loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete department';
      setError(errorMsg);
      console.error('Error deleting department:', err);
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <h1 className="text-2xl font-bold text-gray-900">Manage Departments</h1>
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
            <h2 className="text-3xl font-bold text-gray-900">Academic Departments</h2>
            <p className="text-gray-600 mt-1">Create and manage all university departments</p>
          </div>
          <button
            onClick={handleAddDepartment}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Department</span>
          </button>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.length > 0 ? (
            filteredDepartments.map(dept => (
              <div key={dept.id} className="bg-white rounded-lg shadow-sm hover:shadow-lg transition duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 text-white">
                  <h3 className="text-lg font-bold">{dept.name}</h3>
                  <p className="text-purple-100 text-sm mt-1">Code: {dept.code}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Description</p>
                    <p className="text-gray-900 mt-1">{dept.description || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Head of Department</p>
                    <p className="text-gray-900 mt-1">{dept.headOfDepartment || 'N/A'}</p>
                  </div>
                  <div className="flex space-x-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEditDepartment(dept)}
                      className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 py-2 rounded font-medium text-sm transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDepartment(dept.id || dept._id || '')}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded font-medium text-sm transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">No departments found</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingId ? 'Edit Department' : 'Add New Department'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-purple-100 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Department Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., Computer Science"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                {/* Department Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Department Code *</label>
                  <input
                    type="text"
                    placeholder="e.g., CS"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    maxLength={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  placeholder="Brief description of the department"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                />
              </div>

              {/* Head of Department */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Head of Department</label>
                <input
                  type="text"
                  placeholder="e.g., Prof. John Doe"
                  value={formData.headOfDepartment}
                  onChange={(e) => setFormData({...formData, headOfDepartment: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
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
                onClick={handleSaveDepartment}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
              >
                {editingId ? 'Update Department' : 'Add Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
