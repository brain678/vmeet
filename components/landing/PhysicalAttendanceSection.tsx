'use client';

import { motion } from 'framer-motion';
import { FiCheckCircle, FiClock, FiDownload, FiMapPin, FiShield } from 'react-icons/fi';

export const PhysicalAttendanceSection = () => {
  const items = [
    {
      icon: <FiShield className="h-6 w-6 text-primary" />,
      title: 'Face Verification',
      description: 'AI-powered identity verification with liveness detection for secure student check-in.',
    },
    {
      icon: <FiMapPin className="h-6 w-6 text-primary" />,
      title: 'Geofenced Sessions',
      description: 'Attendance is allowed only within a lecturer-defined location boundary.',
    },
    {
      icon: <FiClock className="h-6 w-6 text-primary" />,
      title: 'Time-Limited Attendance',
      description: 'Sessions automatically open and close within a controlled attendance window.',
    },
    {
      icon: <FiCheckCircle className="h-6 w-6 text-primary" />,
      title: 'Real-Time Attendance Dashboard',
      description: 'Live student counts and instant status updates for every session.',
    },
    {
      icon: <FiDownload className="h-6 w-6 text-primary" />,
      title: 'Report Export',
      description: 'Download attendance records in Excel format for academic reporting.',
    },
  ];

  return (
    <section className="bg-sky-3 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="space-y-6"
          >
            <div className="rounded-3xl border border-primary/20 bg-sky-1 p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Physical Attendance</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Secure, modern attendance built for university classrooms.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                A polished two-column view that pairs location-aware check-in with live session reporting for lecturers and administrators.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item, index) => (
                <div key={index} className="rounded-3xl border border-primary/20 bg-sky-1 p-6 shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-2 text-primary shadow-sm">
                    {item.icon}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="rounded-[2rem] border border-primary/20 bg-sky-1 p-8 shadow-[0_30px_60px_rgba(15,23,42,0.08)]"
          >
            <div className="rounded-[1.75rem] border border-primary/20 bg-sky-1 p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">Live session</p>
                  <p className="mt-1 text-sm text-slate-500">Attendance status overview</p>
                </div>
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Active
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-sky-1 p-5 shadow-sm ring-1 ring-primary/20">
                  <p className="text-sm uppercase tracking-[0.24em] text-primary">Students present</p>
                  <p className="mt-4 text-4xl font-semibold text-slate-900">32</p>
                </div>
                <div className="rounded-3xl bg-sky-1 p-5 shadow-sm ring-1 ring-primary/20">
                  <p className="text-sm uppercase tracking-[0.24em] text-primary">Session time</p>
                  <p className="mt-4 text-4xl font-semibold text-slate-900">45m</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-primary/20 bg-sky-1 p-5">
                <p className="text-sm font-semibold text-primary">Location validation</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-primary/20">
                    <p className="text-xs uppercase tracking-[0.24em] text-primary">Campus zone</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Engineering Hall</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-primary/20">
                    <p className="text-xs uppercase tracking-[0.24em] text-primary">Radius</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">120m</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
