'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiUsers, FiVideo, FiClock } from 'react-icons/fi';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import { IoStatsChartOutline } from 'react-icons/io5';
import { MdOutlineVerified } from 'react-icons/md';

export const HeroSection = () => {
  const [dimensions, setDimensions] = useState({ width: 1024, height: 768 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });
    setIsMounted(true);

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const stats = [
    { icon: <FiUsers className="h-8 w-8" />, number: "1000+", label: "Active Users" },
    { icon: <FiVideo className="h-8 w-8" />, number: "500+", label: "Daily Classes" },
    { icon: <IoStatsChartOutline className="h-8 w-8" />, number: "99%", label: "Satisfaction" }
  ];

  return (
    <div className="relative min-h-screen bg-gradient-radial from-dark-2 via-dark-3 to-dark-4 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] -top-64 -right-64 animate-pulse-slow"/>
        <div className="absolute w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[100px] -bottom-32 -left-32 animate-pulse-slow delay-1000"/>
      </div>

      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden">
        {isMounted && [...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-primary/20 rounded-full"
            initial={{ 
              x: Math.random() * dimensions.width,
              y: Math.random() * dimensions.height
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-20 min-h-screen flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto mb-16"
        >
          {/* Enhanced Logo Section */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: "spring",
              stiffness: 100,
              damping: 10,
              delay: 0.2 
            }}
            className="relative flex flex-col items-center mb-12"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-full blur-lg animate-pulse-slow" />
            <Image
              src="/images/logo.png"
              width={160}
              height={160}
              alt="VM Logo"
              className="relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
              priority
            />
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full px-6 py-2 mb-6"
          >
            <span className="animate-pulse">✨</span>
            <span className="text-white/80 font-medium">Next Generation Virtual Learning</span>
            <span className="animate-pulse">✨</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-primary/50 to-secondary bg-clip-text text-transparent">
            Transform Your Virtual Learning Experience
          </h1>
          
          <p className="text-xl text-gray-300 leading-relaxed mb-12">
            Experience education reimagined with our AI-powered virtual classroom platform. 
            Join thousands of educators and students in creating engaging, interactive learning experiences.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/sign-up" 
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-xl hover:shadow-primary/30 transition-all duration-300"
              >
                Get Started Free
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/sign-in" 
                className="inline-flex items-center gap-2 bg-dark-2/50 border border-gray-700 rounded-xl px-8 py-4 text-lg font-semibold text-white hover:bg-dark-2/80 transition-all duration-300"
              >
                Sign In
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.2 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100" />
              <div className="relative bg-dark-2/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primary mb-4">
                  {stat.icon}
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">{stat.number}</h3>
                <p className="text-gray-400">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
