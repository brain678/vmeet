import { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { ColorModeScript } from "@chakra-ui/react";
import { Toaster } from "@/components/ui/toaster";
import { ChakraProvider } from "@/providers/ChakraProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Virtual_class",
  description: "Student Class App",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <ClerkProvider
        appearance={{
          layout: {
            socialButtonsVariant: "iconButton",
            shimmer: true,
          },
          variables: {
            colorPrimary: "#0E78F9",
            colorText: "#fff",
            colorBackground: "#1C1F2E",
            colorInputBackground: "#252A41",
            colorInputText: "#fff",
            colorTextOnPrimaryBackground: "#fff",
          },
        }}
      >          <body className={inter.className}>
            <ChakraProvider>
              {children}
              <Toaster />
            </ChakraProvider>
          </body>
      </ClerkProvider>
    </html>
  );
}
