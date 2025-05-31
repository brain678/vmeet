'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiUsers, FiVideo, FiClock } from 'react-icons/fi';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import { IoStatsChartOutline } from 'react-icons/io5';
import { MdOutlineVerified } from 'react-icons/md';

export const HeroSection = () => {
  const labelVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    },
    hover: {
      scale: 1.05,
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    }
  };

  const sparkleVariants = {
    animate: {
      scale: [1, 1.2, 1],
      rotate: [0, 360],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const gradientVariants = {
    animate: {
      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      transition: {
        duration: 3,
        ease: "linear",
        repeat: Infinity
      }
    }
  };

  const statsCards = [
    {
      icon: <FiUsers className="h-8 w-8 text-primary" />,
      number: "1000+",
      label: "Active Users",
      color: "from-blue-500/20 to-primary/20"
    },
    {
      icon: <FiVideo className="h-8 w-8 text-green-500" />,
      number: "500+",
      label: "Daily Classes",
      color: "from-green-500/20 to-emerald-500/20"
    },
    {
      icon: <IoStatsChartOutline className="h-8 w-8 text-purple-500" />,
      number: "99%",
      label: "Satisfaction",
      color: "from-purple-500/20 to-pink-500/20"
    }
  ];

  const featureCards = [
    {
      icon: <HiOutlineAcademicCap className="h-8 w-8" />,
      title: "Live Classes",
      description: "Interactive real-time sessions with HD video quality",
      color: "primary",
      gradient: "from-primary/20 to-blue-600/20",
      image: "/images/learning-feature-1.svg"
    },
    {
      icon: <MdOutlineVerified className="h-8 w-8" />,
      title: "Smart Attendance",
      description: "Automated tracking with AI-powered recognition",
      color: "secondary",
      gradient: "from-secondary/20 to-purple-600/20",
      image: "/images/learning-feature-2.svg"
    }
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-dark-2 via-dark-3 to-dark-4 overflow-hidden">
      {/* Pattern Background */}
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/images/hero-pattern.svg)', opacity: 0.1 }} />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl -top-32 -right-32 animate-pulse"/>
        <div className="absolute w-[500px] h-[500px] bg-secondary/20 rounded-full blur-3xl -bottom-32 -left-32 animate-pulse"/>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 px-4 py-16 mx-auto max-w-7xl sm:px-6 lg:px-8 min-h-screen">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-8rem)]">
          {/* Left Column - Text Content */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-left space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                variants={labelVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                className="inline-block relative"
              >
                <motion.div
                  className="absolute -inset-0.5 bg-gradient-to-r from-primary via-purple-500 to-secondary rounded-full blur-sm opacity-75"
                  animate={{
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <motion.span
                  variants={gradientVariants}
                  animate="animate"
                  className="relative inline-flex items-center gap-2 bg-gradient-to-r from-primary via-purple-500 to-secondary bg-[length:200%_auto] text-transparent bg-clip-text px-6 py-2 rounded-full text-sm font-bold border border-white/10 shadow-lg shadow-primary/20 backdrop-blur-xl"
                  style={{
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  <motion.span
                    variants={sparkleVariants}
                    animate="animate"
                    className="inline-block"
                  >
                    ✨
                  </motion.span>
                  Virtual Learning Platform
                  <motion.span
                    variants={sparkleVariants}
                    animate="animate"
                    className="inline-block"
                  >
                    ✨
                  </motion.span>
                </motion.span>
              </motion.div>
              
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl mb-6">
                <span className="block bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
                  Transform Your Virtual Learning Experience
                </span>
              </h1>
            </div>
            
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
              Experience education reimagined for the digital age with our cutting-edge virtual classroom platform. Join thousands of students and educators in creating engaging, interactive learning experiences.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/sign-up" 
                className="group flex items-center justify-center rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-primary/30"
              >
                Get Started
                <motion.svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </motion.svg>
              </Link>
              <Link 
                href="/sign-in" 
                className="flex items-center justify-center rounded-lg border-2 border-gray-500 px-8 py-4 text-lg font-semibold text-white hover:bg-white/10 transition-all duration-300"
              >
                Sign In
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8">
              {statsCards.map((stat, index) => (
                <motion.div 
                  key={index}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="relative overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-20 rounded-xl`} />
                  <div className="relative text-center p-6 rounded-xl backdrop-blur-sm border border-white/10">
                    <div className="flex-center mb-4">
                      {stat.icon}
                    </div>
                    <h3 className="text-3xl font-bold text-white">{stat.number}</h3>
                    <p className="text-gray-300 mt-1 font-medium">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Features */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/images/virtual-class.svg"
                alt="Virtual classroom interface"
                fill
                className="object-cover"
                priority
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-dark-4/80 via-transparent to-transparent" />
            </div>

            {/* Feature Cards */}
            <div className="absolute -bottom-32 left-0 right-0 grid grid-cols-2 gap-6">
              {featureCards.map((feature, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  className={`group relative overflow-hidden bg-dark-2/90 backdrop-blur-lg p-6 rounded-xl border border-gray-800 hover:border-${feature.color}/50 transition-all duration-300 shadow-lg`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
                  <div className="relative space-y-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 h-14 w-14 bg-${feature.color}/20 rounded-2xl flex items-center justify-center group-hover:bg-${feature.color}/30 transition-colors duration-300 p-3`}>
                        <div className={`text-${feature.color}`}>
                          {feature.icon}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-lg font-semibold text-white group-hover:text-${feature.color} transition-colors duration-300 mb-2`}>
                          {feature.title}
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    <div className="relative h-36 w-full rounded-lg overflow-hidden">
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        fill
                        className="object-cover transform group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex gap-4">
        <motion.a
          href="#features"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-white/50 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.a>
      </div>
    </div>
  );
}
