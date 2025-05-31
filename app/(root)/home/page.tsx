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

  const {
    currentImageIndex,
    shuffledImages,
    currentImage,
    nextImage,
    previousImage,
    togglePause,
    isPaused,
    goToImage,
    totalImages
  } = useBackgroundSlider(originalBackgroundImages);

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
    <section className="flex size-full flex-col gap-5 text-white">
      <div className="relative h-[303px] w-full rounded-[20px] overflow-hidden group">
        <AnimatePresence initial={false} mode="wait">
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
            
            {/* Navigation arrows */}
            {shuffledImages.length > 1 && (
              <>
                <button
                  onClick={previousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                
                {/* Pause/Play button */}
                <button
                  onClick={togglePause}
                  className="absolute bottom-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={isPaused ? "Resume slideshow" : "Pause slideshow"}
                >
                  {isPaused ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                  )}
                </button>
              </>
            )}
            
            <div className="relative flex h-full flex-col justify-between max-md:px-5 max-md:py-8 lg:p-11">
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="glassmorphism max-w-[273px] rounded-lg py-2 px-4 backdrop-blur-md bg-white/10"
              >
                <h2 className="text-center text-base font-normal">
                  Upcoming Class at: 12:30 PM
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
        
        {/* Navigation dots */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 z-10">
          {shuffledImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`h-2 transition-all ${
                index === currentImageIndex 
                  ? 'w-6 bg-white rounded-full' 
                  : 'w-2 bg-white/50 rounded-full hover:bg-white/70'
              }`}
              aria-label={`Switch to background ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div>
        <MeetingTypeList />
      </div>
    </section>
  );
};

export default Home;
