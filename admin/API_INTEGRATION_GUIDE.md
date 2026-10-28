# API Integration Guide for Admin Dashboard

## Overview
This guide provides instructions for integrating the VMeet Admin Dashboard with your backend API.

## Current State
The dashboard currently uses **mock data** in React state. All data is lost on page refresh.

## Integration Steps

### 1. Create API Routes

Create API route handlers in `admin/app/api/` directory:

#### Courses API (`admin/app/api/courses/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch all courses
export async function GET() {
  try {
    const response = await fetch('http://your-backend.com/api/courses');
    const courses = await response.json();
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

// POST - Create new course
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const response = await fetch('http://your-backend.com/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const newCourse = await response.json();
    return NextResponse.json(newCourse);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}

// PUT - Update course
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const response = await fetch(`http://your-backend.com/api/courses/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const updated = await response.json();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}

// DELETE - Delete course
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const response = await fetch(`http://your-backend.com/api/courses/${id}`, {
      method: 'DELETE'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}
```

### 2. Update Course Management Page

Modify `admin/app/dashboard/courses/page.tsx` to use API:

```typescript
'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ... existing imports and interfaces

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch courses
  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/courses');
      if (!response.ok) throw new Error('Failed to fetch courses');
      const data = await response.json();
      setCourses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Create course
  const handleSaveCourse = async () => {
    if (!formData.code || !formData.title || !formData.department || !formData.level) {
      alert('Please fill all fields');
      return;
    }

    try {
      const endpoint = editingId ? '/api/courses' : '/api/courses';
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId && { id: editingId }),
          ...formData
        })
      });

      if (!response.ok) throw new Error('Failed to save course');
      
      await fetchCourses();
      setShowModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course');
    }
  };

  // Delete course
  const handleDeleteCourse = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const response = await fetch('/api/courses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!response.ok) throw new Error('Failed to delete course');
      
      await fetchCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course');
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchCourses();
  }, []);

  // ... rest of component
}
```

### 3. Create a Shared API Client

Create `admin/lib/api-client.ts`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = {
  // Courses
  courses: {
    getAll: () => fetch(`${API_BASE_URL}/courses`).then(r => r.json()),
    create: (data: any) => 
      fetch(`${API_BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    update: (id: string, data: any) =>
      fetch(`${API_BASE_URL}/courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    delete: (id: string) =>
      fetch(`${API_BASE_URL}/courses/${id}`, { method: 'DELETE' }).then(r => r.json())
  },

  // Departments
  departments: {
    getAll: () => fetch(`${API_BASE_URL}/departments`).then(r => r.json()),
    create: (data: any) =>
      fetch(`${API_BASE_URL}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    update: (id: string, data: any) =>
      fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    delete: (id: string) =>
      fetch(`${API_BASE_URL}/departments/${id}`, { method: 'DELETE' }).then(r => r.json())
  },

  // Levels
  levels: {
    getAll: () => fetch(`${API_BASE_URL}/levels`).then(r => r.json()),
    create: (data: any) =>
      fetch(`${API_BASE_URL}/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    update: (id: string, data: any) =>
      fetch(`${API_BASE_URL}/levels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    delete: (id: string) =>
      fetch(`${API_BASE_URL}/levels/${id}`, { method: 'DELETE' }).then(r => r.json())
  }
};
```

### 4. Environment Configuration

Create `.env.local` in admin directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 5. Backend Requirements

Your backend API should provide these endpoints:

#### Courses Endpoints
```
GET    /api/courses              - List all courses
POST   /api/courses              - Create course
PUT    /api/courses/{id}         - Update course
DELETE /api/courses/{id}         - Delete course
```

**Request/Response Format:**
```json
{
  "id": "string",
  "code": "string (e.g., CS101)",
  "title": "string",
  "department": "string (department name)",
  "level": "string (100, 200, 300, 400)",
  "credits": "number (1-6)",
  "createdAt": "ISO string"
}
```

#### Departments Endpoints
```
GET    /api/departments          - List all departments
POST   /api/departments          - Create department
PUT    /api/departments/{id}     - Update department
DELETE /api/departments/{id}     - Delete department
```

**Request/Response Format:**
```json
{
  "id": "string",
  "name": "string",
  "code": "string (e.g., CS)",
  "description": "string",
  "headOfDepartment": "string",
  "createdAt": "ISO string"
}
```

#### Levels Endpoints
```
GET    /api/levels               - List all levels
POST   /api/levels               - Create level
PUT    /api/levels/{id}          - Update level
DELETE /api/levels/{id}          - Delete level
```

**Request/Response Format:**
```json
{
  "id": "string",
  "name": "string",
  "code": "number (100, 200, 300, 400)",
  "description": "string",
  "yearOfStudy": "number (1-5)",
  "createdAt": "ISO string"
}
```

## Error Handling

Add error handling to all pages:

```typescript
const [error, setError] = useState<string | null>(null);

// In your JSX:
{error && (
  <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
    <p>{error}</p>
    <button 
      onClick={() => setError(null)}
      className="text-red-600 hover:text-red-800 mt-2"
    >
      Dismiss
    </button>
  </div>
)}
```

## Testing

Test the API integration with sample data:

1. **Create Department**
   - Name: Computer Science
   - Code: CS
   - Head: Prof. John Doe

2. **Create Level**
   - Name: 100 Level
   - Code: 100
   - Year: 1

3. **Create Course**
   - Code: CS101
   - Title: Intro to CS
   - Department: Computer Science
   - Level: 100
   - Credits: 3

## Troubleshooting

**Issue**: CORS errors
- Add CORS headers to your backend
- Use proxy if needed

**Issue**: Data not persisting
- Verify backend is storing to database
- Check network requests in browser DevTools

**Issue**: Slow performance
- Add pagination for large datasets
- Implement caching strategies
- Use database indexes

## Next Steps

1. Set up backend API endpoints
2. Configure environment variables
3. Replace mock data with API calls
4. Implement error handling
5. Add loading states
6. Test thoroughly
7. Deploy to production
