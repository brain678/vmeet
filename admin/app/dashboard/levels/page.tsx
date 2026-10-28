'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { levelsAPI } from '../../../lib/api';

interface Level {
  id?: string;
  _id?: string;
  name: string;
  code: number;
  description?: string;
  yearOfStudy: number;
  createdAt?: string;
}

export default function LevelsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    yearOfStudy: 1
  });
  const [editingId, setEditingId] = useState<string | null>(null);

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
      const response = await levelsAPI.getAll(0, 1000);
      const levelsList = response.data || [];
      setLevels(
        levelsList.map(l => ({
          ...l,
          id: l.id || l._id
        }))
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load levels';
      setError(errorMsg);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLevel = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      yearOfStudy: 1
    });
    setShowModal(true);
  };

  const handleEditLevel = (level: Level) => {
    setEditingId(level.id || level._id || null);
    setFormData({
      name: level.name,
      code: level.code.toString(),
      description: level.description || '',
      yearOfStudy: level.yearOfStudy
    });
    setShowModal(true);
  };

  const handleSaveLevel = async () => {
    if (!formData.name || !formData.code) {
      setError('Level name and code are required');
      return;
    }

    try {
      setError(null);

      const levelData = {
        name: formData.name,
        code: parseInt(formData.code),
        description: formData.description,
        yearOfStudy: formData.yearOfStudy
      };

      if (editingId) {
        await levelsAPI.update(editingId, levelData);
      } else {
        await levelsAPI.create(levelData);
      }

      await loadData();
      setShowModal(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save level';
      setError(errorMsg);
      console.error('Error saving level:', err);
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (!confirm('Are you sure? This will affect all associated courses.')) return;

    try {
      setError(null);
      await levelsAPI.delete(id);
      await loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete level';
      setError(errorMsg);
      console.error('Error deleting level:', err);
    }
  };

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
              <h1 className="text-2xl font-bold text-gray-900">Manage Levels</h1>
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
            <h2 className="text-3xl font-bold text-gray-900">Academic Levels</h2>
            <p className="text-gray-600 mt-1">Manage degree levels and years of study</p>
          </div>
          <button
            onClick={handleAddLevel}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Level</span>
          </button>
        </div>

        {/* Levels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {levels.length > 0 ? (
            levels.map(level => (
              <div key={level.id} className="bg-white rounded-lg shadow-sm hover:shadow-lg transition duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold">{level.code}</h3>
                      <p className="text-green-100 mt-1">{level.name}</p>
                    </div>
                    <div className="bg-green-400 bg-opacity-30 px-3 py-1 rounded-full text-sm font-semibold">
                      Year {level.yearOfStudy}
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Description</p>
                    <p className="text-gray-900">{level.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">Level Code</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{level.code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">Year of Study</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">Year {level.yearOfStudy}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEditLevel(level)}
                      className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-2 rounded font-medium text-sm transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteLevel(level.id || level._id || '')}
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
              <p className="text-gray-500 text-lg">No levels found</p>
            </div>
          )}
        </div>

        {/* Quick Reference */}
        <div className="mt-12 bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Standard Academic Structure</h3>
          <p className="text-gray-600 mb-6">Most universities follow this standard structure:</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { code: 100, year: 1, name: '100 Level' },
              { code: 200, year: 2, name: '200 Level' },
              { code: 300, year: 3, name: '300 Level' },
              { code: 400, year: 4, name: '400 Level' }
            ].map((item, idx) => (
              <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{item.code}</p>
                <p className="text-sm text-gray-600 mt-2">Year {item.year}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingId ? 'Edit Academic Level' : 'Add New Academic Level'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-green-100 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Level Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Level Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., 100 Level (First Year)"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                {/* Level Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Level Code *</label>
                  <input
                    type="number"
                    placeholder="e.g., 100"
                    step="100"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              {/* Year of Study */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Year of Study</label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({...formData, yearOfStudy: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value={1}>First Year</option>
                  <option value={2}>Second Year</option>
                  <option value={3}>Third Year</option>
                  <option value={4}>Fourth Year</option>
                  <option value={5}>Fifth Year</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  placeholder="Brief description of this level"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                />
              </div>

              {/* Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Tip:</strong> Level codes should follow the pattern (100, 200, 300, 400) for standard academic structures.
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
                onClick={handleSaveLevel}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
              >
                {editingId ? 'Update Level' : 'Add Level'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
