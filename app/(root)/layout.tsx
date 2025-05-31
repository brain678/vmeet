'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import StreamVideoProvider from '@/providers/StreamClientProvider';

function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMeetingRoute = pathname?.includes('/meeting/');

  if (isMeetingRoute) {
    return (
      <main className="min-h-screen w-full bg-[#0F1828]">
        <StreamVideoProvider>{children}</StreamVideoProvider>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-[#0F1828]">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-1 flex-col pt-[72px]">
        {/* Navbar */}
        <Navbar />
        <StreamVideoProvider>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {children}
          </div>
        </StreamVideoProvider>
      </div>
    </main>
  );
}

export default RootLayout;
