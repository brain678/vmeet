'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const testimonials = [
	{
		name: 'Dr. Sarah Johnson',
		role: 'Professor of Computer Science',
		image: '/images/avatar-1.jpeg',
		quote: 'VMeet has transformed how I conduct my online lectures. The AI-powered attendance tracking and HD video quality make teaching seamless and engaging.',
		gradient: 'from-primary to-blue-600',
	},
	{
		name: 'Michael Chen',
		role: 'Student Representative',
		image: '/images/avatar-2.jpeg',
		quote: 'The platform is incredibly intuitive and reliable. With features like automated attendance and crystal-clear video, it feels just like being in a real classroom!',
		gradient: 'from-purple-500 to-pink-600',
	},
	{
		name: 'Prof. Emily Brown',
		role: 'Department Head',
		image: '/images/avatar-3.png',
		quote: 'The comprehensive analytics and attendance tracking have streamlined our administrative tasks significantly. VMeet is a game-changer in virtual education.',
		gradient: 'from-green-500 to-emerald-600',
	},
];

export const TestimonialsSection = () => {
	const [currentIndex, setCurrentIndex] = useState(0);

	const nextTestimonial = () => {
		setCurrentIndex((prev) => (prev + 1) % testimonials.length);
	};

	const prevTestimonial = () => {
		setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
	};

	return (
		<section className="relative py-32 overflow-hidden bg-dark-3">
			{/* Background Elements */}
			<div className="absolute inset-0">
				<div className="absolute w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -top-64 -right-64" />
				<div className="absolute w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl -bottom-64 -left-64" />
			</div>

			<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="text-center mb-16"
				>
					<h2 className="text-4xl md:text-5xl font-bold mb-6">
						<span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
							What Our Users Say
						</span>
					</h2>
					<p className="text-xl text-gray-400 max-w-3xl mx-auto">
						Join thousands of satisfied educators and students who have transformed their virtual learning experience
					</p>
				</motion.div>

				<div className="relative max-w-4xl mx-auto">
					{/* Testimonial Cards */}
					<div className="relative h-[400px]">
						<AnimatePresence mode="wait">
							<motion.div
								key={currentIndex}
								initial={{ opacity: 0, x: 100 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -100 }}
								transition={{ duration: 0.5 }}
								className="absolute inset-0"
							>
								<div className="relative bg-dark-2/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
									{/* Gradient Border */}
									<div className="absolute inset-0 p-0.5">
										<div className={`h-full w-full bg-gradient-to-br ${testimonials[currentIndex].gradient} rounded-2xl opacity-20`} />
									</div>

									<div className="relative">
										{/* Quote Icon */}
										<div className="absolute -top-4 -left-2 text-6xl text-primary/20">
											"
										</div>

										{/* Content */}
										<div className="pt-8">
											<blockquote className="text-xl text-gray-300 leading-relaxed mb-8">
												{testimonials[currentIndex].quote}
											</blockquote>

											<div className="flex items-center gap-4">
												<div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-primary/20">
													<Image
														src={testimonials[currentIndex].image}
														alt={testimonials[currentIndex].name}
														fill
														className="object-cover"
													/>
												</div>
												<div>
													<h3 className="text-xl font-semibold text-white">
														{testimonials[currentIndex].name}
													</h3>
													<p className="text-gray-400">
														{testimonials[currentIndex].role}
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>
							</motion.div>
						</AnimatePresence>
					</div>

					{/* Navigation Buttons */}
					<div className="flex justify-center gap-4 mt-8">
						<button
							onClick={prevTestimonial}
							className="p-2 rounded-full bg-dark-2 border border-gray-800 text-white hover:bg-dark-1 transition-colors"
						>
							<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<button
							onClick={nextTestimonial}
							className="p-2 rounded-full bg-dark-2 border border-gray-800 text-white hover:bg-dark-1 transition-colors"
						>
							<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>

					{/* Indicators */}
					<div className="flex justify-center gap-2 mt-4">
						{testimonials.map((_, index) => (
							<button
								key={index}
								onClick={() => setCurrentIndex(index)}
								className={`w-2 h-2 rounded-full transition-all duration-300 ${
									index === currentIndex
										? 'bg-primary w-6'
										: 'bg-gray-600 hover:bg-gray-500'
								}`}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
