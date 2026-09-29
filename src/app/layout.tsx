import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/utils/toast";

export const metadata: Metadata = {
  title: "Gunny Bag Weighing | United Rubber - Unit 1",
  description:
    "Professional Gunny Bag Weighing Management System for United Rubber Unit 1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
