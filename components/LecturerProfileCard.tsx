'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BACKEND_URL } from '@/constants/config';

interface LecturerData {
  name: string;
  email: string;
  department: string;
  profilePicture?: string;
  courses?: Array<{
    _id?: string;
    id?: string;
    name: string;
    code: string;
  }>;
}

interface LecturerProfileCardProps {
  className?: string;
}

const LecturerProfileCard = ({ className }: LecturerProfileCardProps) => {
  const router = useRouter();
  const { user } = useUser();
  const [lecturerData, setLecturerData] = useState<LecturerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchLecturerData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to load lecturer profile');
        }

        const data = await response.json();
        if (data.role === 'lecturer' && data.roleData) {
          setLecturerData({
            name: data.name || user.firstName || 'Lecturer',
            email: data.email || user.emailAddresses?.[0]?.emailAddress || '',
            department: data.department || 'N/A',
            profilePicture: user.imageUrl || '',
            courses: data.courses || [],
          });
        }
      } catch (error) {
        console.error('Error fetching lecturer data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLecturerData();
  }, [user?.id, user?.firstName, user?.emailAddresses, user?.imageUrl]);

  if (loading) {
    return (
      <div className={cn(
        'bg-indigo-600/20 px-4 py-6 flex flex-col justify-between h-[260px] rounded-[14px] cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1',
        className
      )}>
        <div className="flex-center glassmorphism size-12 rounded-[10px] bg-gray-600/50" />
        <div className="flex flex-col gap-2">
          <div className="h-8 bg-gray-600/50 rounded w-2/3" />
          <div className="h-6 bg-gray-600/50 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!lecturerData) {
    return null;
  }

  return (
    <section
      className={cn(
        'bg-indigo-600/20 px-4 py-6 flex flex-col justify-between h-[260px] rounded-[14px] cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1',
        className
      )}
      onClick={() => router.push('/lecturer-profile')}
    >
      {/* Profile Picture */}
      <div className="flex items-center justify-center mb-2">
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-400 shadow-lg">
          {lecturerData.profilePicture && !imageError ? (
            <Image
              src={lecturerData.profilePicture}
              alt={lecturerData.name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {lecturerData.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Profile Info */}
      <div className="flex flex-col gap-1 flex-1">
        <h1 className="text-xl font-bold text-white text-center">{lecturerData.name}</h1>
        <p className="text-sm text-gray-300 text-center truncate">{lecturerData.email}</p>
        <p className="text-xs text-gray-400 text-center">{lecturerData.department}</p>
        
        {/* Course Count */}
        {lecturerData.courses && lecturerData.courses.length > 0 && (
          <p className="text-xs text-indigo-300 text-center mt-1">
            {lecturerData.courses.length} course{lecturerData.courses.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* View Profile Button */}
      <button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm">
        View Profile
      </button>
    </section>
  );
};

export default LecturerProfileCard;
