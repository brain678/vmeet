import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { HeroSection } from '@/components/landing/HeroSection'

export default async function Home() {
  const { userId } = await auth()
  
  if (userId) {
    redirect('/home')
  }

  return <HeroSection />
}
