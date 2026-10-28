'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiShield, FiMapPin } from 'react-icons/fi';

export const HeroSection = () => {
  return (
    <section className="bg-sky-3 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="mb-10 flex items-center justify-center sm:justify-start">
            <div className="inline-flex items-center gap-3 rounded-full bg-sky-2 px-4 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary/20">
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white/95">
                <Image
                  src="/images/logo.png"
                  alt="VMeet logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-base font-semibold text-primary">VMeet</span>
            </div>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Transform Virtual Learning with Secure Physical Attendance
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            A complete AI-powered classroom platform with face-based check-in, geofence validation, real-time attendance tracking, and automated session management.
          </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition duration-200 hover:bg-blue-1"
              >
                Try Physical Attendance
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-sky-2 px-6 py-3 text-base font-semibold text-primary shadow-sm transition duration-200 hover:border-primary hover:bg-sky-3"
              >
                Explore Features
              </a>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-sky-1 p-6 shadow-sm ring-1 ring-primary/20">
                <div className="flex items-center gap-3 text-primary">
                  <FiShield className="h-5 w-5" />
                  <p className="text-sm font-semibold text-slate-900">Secure face verification</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">Built for academic integrity and student identity assurance.</p>
              </div>

              <div className="rounded-3xl bg-sky-1 p-6 shadow-sm ring-1 ring-primary/20">
                <div className="flex items-center gap-3 text-primary">
                  <FiMapPin className="h-5 w-5" />
                  <p className="text-sm font-semibold text-slate-900">Geofence-enabled check-ins</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">Attendance only counts within lecturer-defined campus zones.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-[2rem] border border-primary/20 bg-sky-1 shadow-[0_30px_60px_rgba(15,23,42,0.08)]">
              <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.24em]">Physical Attendance</p>
                <p className="mt-4 text-sm leading-6 text-slate-100/90">Face verification + location validation in one streamlined check-in.</p>
              </div>
              <div className="p-6">
                <Image
                  src="/images/attendance-illustration.png"
                  alt="Attendance flow illustration"
                  width={540}
                  height={420}
                  className="h-auto w-full rounded-[1.5rem] object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
