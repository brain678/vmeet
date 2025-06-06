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
    <div className="min-h-screen bg-[#0F1828] flex flex-col">
      {/* Navbar - at the top */}
      <div className="sticky top-0 z-50 w-full bg-[#0F1828] border-b border-gray-800">
        <Navbar />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - under navbar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          <ChakraProvider>
            <StreamVideoProvider>{children}</StreamVideoProvider>
          </ChakraProvider>
        </div>
      </div>
    </div>
  );
}

export default RootLayout;
