'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HiOutlineVideoCamera } from 'react-icons/hi';
import { FiUserCheck, FiCalendar, FiBarChart2, FiShield } from 'react-icons/fi';

export const FeaturesSection = () => {
  const features = [
    {
      icon: <HiOutlineVideoCamera className="h-6 w-6 text-primary" />,
      title: 'HD Video Conferencing',
      description: 'Reliable audio and video for lectures, group work, and presentations.',
    },
    {
      icon: <FiUserCheck className="h-6 w-6 text-primary" />,
      title: 'AI-Powered Attendance',
      description: 'Facial verification and location checks for secure, accurate sessions.',
    },
    {
      icon: <FiCalendar className="h-6 w-6 text-primary" />,
      title: 'Smart Scheduling & Auto-Start',
      description: 'Set sessions once and let VMeet handle the rest with automated timing.',
    },
    {
      icon: <FiBarChart2 className="h-6 w-6 text-primary" />,
      title: 'Analytics Dashboard',
      description: 'See attendance, engagement, and session performance in one place.',
    },
    {
      icon: <FiShield className="h-6 w-6 text-primary" />,
      title: 'Secure Role-Based Access',
      description: 'Distinct experiences for students, lecturers, and administrators.',
    },
  ];

  return (
    <section className="bg-sky-3 py-24" id="features">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
          >
            Core Platform Features
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-base leading-7 text-slate-600"
          >
            Everything a university needs for modern hybrid classroom management, attendance, video, and reporting.
          </motion.p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
              whileHover={{ y: -6 }}
              className="rounded-3xl border border-primary/20 bg-sky-1 p-7 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-2 shadow-sm">
                {feature.icon}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
