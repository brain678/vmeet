'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import MeetingTypeList from '@/components/MeetingTypeList';
import { backgroundImages as originalBackgroundImages } from '@/constants/backgroundImages';
import { useBackgroundSlider } from '@/hooks/useBackgroundSlider';
import HomeCard from '@/components/HomeCard';
import { useRouter } from 'next/navigation';

const Home = () => {
  const now = new Date();
  const router = useRouter();
  const { user } = useUser();
  const [timeState, setTimeState] = useState({
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(now)
  });
  const [isLecturer, setIsLecturer] = useState(false);

  const { currentImageIndex, currentImage } = useBackgroundSlider(originalBackgroundImages);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimeState({
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(now)
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-user-role?userId=${user?.id}`);
        const data = await response.json();
        setIsLecturer(data.role === 'lecturer');
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };
    
    if (user?.id) {
      checkUserRole();
    }
  }, [user?.id]);

  return (
    <section className="flex size-full flex-col py-6 text-white">
      <div className="relative h-[300px] w-full overflow-hidden rounded-[14px] group">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImageIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Image
              src={currentImage.url}
              alt={currentImage.alt}
              fill
              className="object-cover"
              priority={currentImageIndex === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            />
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/30" />
            
            <div className="relative flex h-full flex-col justify-between max-md:px-5 max-md:py-8 lg:p-11">
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="glassmorphism max-w-[273px] rounded-lg py-2 px-4 backdrop-blur-md bg-white/10"
              >
                <h2 className="text-center text-base font-normal">
                
                No Sheduled Class 
                </h2>
              </motion.div>
              <div className="flex flex-col gap-2">
                <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-4xl font-extrabold lg:text-7xl text-shadow-lg"
                >
                  {timeState.time}
                </motion.h1>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-lg font-medium text-sky-1 lg:text-2xl text-shadow"
                >
                  {timeState.date}
                </motion.p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-8 w-full max-w-[1800px] mx-auto px-6">
        <MeetingTypeList />
      </div>
    </section>
  );
};

export default Home;
