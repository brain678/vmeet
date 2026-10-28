import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VMeet Admin Dashboard",
  description: "Administrative Dashboard for VMeet University Meeting Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
