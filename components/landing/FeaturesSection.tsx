'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HiOutlineVideoCamera, HiOutlineDocumentReport } from 'react-icons/hi';
import { IoStatsChartOutline } from 'react-icons/io5';
import { BsCalendarCheck, BsShieldCheck } from 'react-icons/bs';
import Image from 'next/image';
import Link from 'next/link';

export const FeaturesSection = () => {
  const features = [
    {
      icon: <HiOutlineVideoCamera className="w-8 h-8" />,
      title: "HD Video Conferencing",
      description: "Crystal clear video and audio quality for seamless virtual classroom experience",
      gradient: "from-blue-500 to-cyan-500",
      demo: "/images/learning-feature-1.svg"
    },
    {
      icon: <BsShieldCheck className="w-8 h-8" />,
      title: "AI-Powered Attendance",
      description: "Automated facial recognition and location-based tracking for accurate attendance monitoring",
      gradient: "from-purple-500 to-pink-500",
      demo: "/images/learning-feature-2.svg"
    },
    {
      icon: <IoStatsChartOutline className="w-8 h-8" />,
      title: "Analytics Dashboard",
      description: "Comprehensive insights into student engagement, attendance patterns, and class performance",
      gradient: "from-orange-500 to-red-500",
      demo: "/images/learning-feature-1.svg"
    },
    {
      icon: <BsCalendarCheck className="w-8 h-8" />,
      title: "Smart Scheduling",
      description: "Effortless class scheduling with calendar integration and automated notifications",
      gradient: "from-green-500 to-emerald-500",
      demo: "/images/learning-feature-2.svg"
    }
  ];

  return (
    <section className="relative py-32 bg-dark-2" id="features">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-3/50 to-dark-2" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
                Powerful Features
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Experience the next generation of virtual learning with our comprehensive suite of features
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              whileHover={{ y: -5 }}
              className="group relative bg-dark-1 rounded-2xl overflow-hidden"
            >
              {/* Gradient Border */}
              <div className="absolute inset-0 p-0.5">
                <div className={`h-full w-full bg-gradient-to-br ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
              
              {/* Content */}
              <div className="relative bg-dark-1 rounded-2xl p-8">
                <div className="flex items-start gap-6 mb-6">
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${feature.gradient} bg-opacity-10`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-white mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>

                {/* Feature Demo/Screenshot */}
                <div className="relative h-48 rounded-xl overflow-hidden">
                  <Image
                    src={feature.demo}
                    alt={feature.title}
                    fill
                    className="object-contain transform group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Gradient Overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-tr ${feature.gradient} opacity-20 group-hover:opacity-30 transition-opacity duration-300`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-20"
        >
          <Link 
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1"
          >
            Try All Features Free
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
