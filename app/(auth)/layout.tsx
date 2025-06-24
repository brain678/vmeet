import * as React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0F1828] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
