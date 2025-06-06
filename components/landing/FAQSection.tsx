'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
	{
		question: 'How does the AI-powered attendance system work?',
		answer:
			'Our attendance system uses advanced facial recognition technology combined with location verification to accurately track student presence. It\'s secure, reliable, and requires minimal setup - just upload a reference photo and you\'re ready to go.',
		gradient: 'from-primary to-blue-600',
	},
	{
		question: 'What are the technical requirements for using VMeet?',
		answer:
			'VMeet works on any modern web browser with a webcam and microphone. We recommend a stable internet connection (minimum 1Mbps) for the best experience. No additional software installation is required.',
		gradient: 'from-purple-500 to-pink-600',
	},
	{
		question: 'How secure is the platform?',
		answer:
			'VMeet employs enterprise-grade security measures including end-to-end encryption for video calls, secure data storage, and strict authentication protocols. All facial recognition data is encrypted and stored securely.',
		gradient: 'from-green-500 to-emerald-600',
	},
	{
		question: 'Can I access class recordings and attendance reports?',
		answer:
			'Yes! All classes are automatically recorded and stored securely. Educators can access comprehensive attendance reports, engagement analytics, and session recordings through their dashboard.',
		gradient: 'from-orange-500 to-red-600',
	},
	{
		question: 'Is there a limit on class size or duration?',
		answer:
			'VMeet supports up to 100 participants per session with no time limits. Custom plans are available for institutions needing larger capacity.',
		gradient: 'from-yellow-500 to-amber-600',
	},
];

export const FAQSection = () => {
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	return (
		<section className="relative py-32 bg-dark-2" id="faq">
			{/* Background Elements */}
			<div className="absolute inset-0">
				<div className="absolute w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl top-0 left-0" />
				<div className="absolute w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl bottom-0 right-0" />
			</div>

			<div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="text-center mb-16"
				>
					<h2 className="text-4xl md:text-5xl font-bold mb-6">
						<span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
							Frequently Asked Questions
						</span>
					</h2>
					<p className="text-xl text-gray-400 max-w-3xl mx-auto">
						Get answers to common questions about VMeet&apos;s features and
						capabilities
					</p>
				</motion.div>

				<div className="space-y-4">
					{faqs.map((faq, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: index * 0.1 }}
							className="relative group"
						>
							<button
								onClick={() =>
									setOpenIndex(openIndex === index ? null : index)
								}
								className="w-full text-left"
							>
								<div className="relative bg-dark-1 rounded-2xl p-6 cursor-pointer">
									{/* Gradient Border */}
									<div className="absolute inset-0 p-0.5">
										<div
											className={`h-full w-full bg-gradient-to-br ${faq.gradient} rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
										/>
									</div>

									<div className="relative flex justify-between items-center gap-4">
										<h3 className="text-xl font-semibold text-white group-hover:text-primary transition-colors">
											{faq.question}
										</h3>
										<span
											className={`transform transition-transform duration-300 ${
												openIndex === index ? 'rotate-180' : ''
											}`}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-6 w-6 text-gray-400"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</span>
									</div>

									<AnimatePresence>
										{openIndex === index && (
											<motion.div
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: 'auto', opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												transition={{ duration: 0.3 }}
												className="overflow-hidden"
											>
												<p className="mt-4 text-gray-400 leading-relaxed">
													{faq.answer}
												</p>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							</button>
						</motion.div>
					))}
				</div>

				{/* Contact CTA */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ delay: 0.5 }}
					className="mt-16 text-center"
				>
					<p className="text-gray-400 mb-6">
						Still have questions? We&apos;re here to help!
					</p>
					<a
						href="mailto:support@vmeet.com"
						className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1"
					>
						Contact Support
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-5 w-5"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
							<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
						</svg>
					</a>
				</motion.div>
			</div>
		</section>
	);
};
