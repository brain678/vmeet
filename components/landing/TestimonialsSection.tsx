'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Dr. Sarah Johnson',
    role: 'Professor of Computer Science',
    image: '/images/avatar-1.jpeg',
    quote: 'VMeet has transformed how I conduct my online lectures. The AI-powered attendance tracking and HD video quality make teaching seamless and engaging.',
  },
  {
    name: 'Michael Chen',
    role: 'Student Representative',
    image: '/images/avatar-2.jpeg',
    quote: 'The platform is incredibly intuitive and reliable. With features like automated attendance and crystal-clear video, it feels just like being in a real classroom!',
  },
  {
    name: 'Prof. Emily Brown',
    role: 'Department Head',
    image: '/images/avatar-3.png',
    quote: 'The comprehensive analytics and attendance tracking have streamlined our administrative tasks significantly. VMeet is a game-changer in virtual education.',
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="bg-sky-3 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-600">
            What Our Users Say
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Join thousands of satisfied educators and students who have transformed their virtual learning experience
          </h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-3xl border border-primary/20 bg-sky-1 p-8 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-primary/20">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
              <blockquote className="mt-6 text-base leading-8 text-slate-600">{testimonial.quote}</blockquote>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};
