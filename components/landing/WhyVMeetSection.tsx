'use client';

import { motion } from 'framer-motion';

export const WhyVMeetSection = () => {
  const benefits = [
    'Accurate and fraud-resistant attendance',
    'Seamless physical check-in with digital intelligence',
    'Fully automated session lifecycle',
    'Designed for lecturers and university students',
  ];

  return (
    <section className="bg-sky-3 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">
            Why VMeet
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            A dependable platform for academic collaboration.
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base leading-8 text-slate-600">
            VMeet is built to meet the needs of universities with a polished, reliable experience that centers secure attendance and classroom efficiency.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-3xl border border-primary/20 bg-sky-1 p-6 text-center shadow-sm"
            >
              <p className="text-base font-semibold text-slate-900">{benefit}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-primary/20 bg-sky-1 p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-primary">
            Trusted by academic institutions for secure attendance, simplified classroom workflows, and transparent reporting.
          </p>
        </div>
      </div>
    </section>
  );
};
