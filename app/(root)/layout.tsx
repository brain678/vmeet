"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import StreamVideoProvider from "@/providers/StreamClientProvider";
import { ChakraProvider } from "@/providers/ChakraProvider";

function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMeetingRoute = pathname?.includes("/meeting/");
  const isAttendanceRoute = pathname === "/home/attendance";

  if (isMeetingRoute) {
    return (
      <main className="min-h-screen w-full bg-[#0F1828]">
        <ChakraProvider>
          <StreamVideoProvider>{children}</StreamVideoProvider>
        </ChakraProvider>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5EFFB] text-[#18121F]">
      <div className="fixed inset-y-0 left-0 z-50 w-[240px] max-md:hidden">
        <Sidebar />
      </div>
      <div className="absolute right-0 top-3 z-50 w-full pointer-events-none md:top-0">
        <div className="pointer-events-auto">
          <Navbar />
        </div>
      </div>
      <main className="min-h-screen min-w-0 pl-[240px] max-md:pt-20 max-md:pl-0 md:pt-0">
        <div className="min-h-screen overflow-x-hidden overflow-y-auto">
          <ChakraProvider>
            {isAttendanceRoute ? children : <StreamVideoProvider>{children}</StreamVideoProvider>}
          </ChakraProvider>
        </div>
      </main>
    </div>
  );
}

export default RootLayout;
