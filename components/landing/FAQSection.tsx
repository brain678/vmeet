'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    question: 'How does the AI-powered attendance system work?',
    answer:
      'Our attendance system uses advanced facial recognition technology combined with location verification to accurately track student presence. It’s secure, reliable, and requires minimal setup — just upload a reference photo and you’re ready to go.',
  },
  {
    question: 'What are the technical requirements for using VMeet?',
    answer:
      'VMeet works on any modern web browser with a webcam and microphone. We recommend a stable internet connection (minimum 1Mbps) for the best experience. No additional software installation is required.',
  },
  {
    question: 'How secure is the platform?',
    answer:
      'VMeet employs enterprise-grade security measures including end-to-end encryption for video calls, secure data storage, and strict authentication protocols. All facial recognition data is encrypted and stored securely.',
  },
  {
    question: 'Can I access class recordings and attendance reports?',
    answer:
      'Yes! All classes are automatically recorded and stored securely. Educators can access comprehensive attendance reports, engagement analytics, and session recordings through their dashboard.',
  },
  {
    question: 'Is there a limit on class size or duration?',
    answer:
      'VMeet supports up to 100 participants per session with no time limits. Custom plans are available for institutions needing larger capacity.',
  },
];

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-sky-3 py-24" id="faq">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-600">
            Frequently Asked Questions
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Get answers to common questions about VMeet’s features and capabilities
          </h2>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="overflow-hidden rounded-3xl border border-primary/20 bg-sky-1"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-left text-lg font-semibold text-slate-900">{faq.question}</span>
                <span className={`transition-transform duration-200 ${openIndex === index ? 'rotate-180' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="px-6 pb-6"
                  >
                    <p className="text-base leading-7 text-slate-600">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-16 rounded-3xl border border-primary/20 bg-sky-1 p-8 text-center shadow-sm"
        >
          <p className="text-lg font-semibold text-slate-900">Still have questions? We’re here to help!</p>
          <a
            href="mailto:support@vmeet.com"
            className="mt-6 inline-flex rounded-full border border-primary bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-blue-1"
          >
            Contact Support
          </a>
        </motion.div>
      </div>
    </section>
  );
};
