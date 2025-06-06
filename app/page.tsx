import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { FAQSection } from '@/components/landing/FAQSection'

export default async function Home() {
  const { userId } = await auth()
  
  if (userId) {
    redirect('/home')
  }

  return (
    <main className="bg-dark-2">
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
    </main>
  )
}
