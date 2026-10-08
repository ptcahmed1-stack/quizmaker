import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "QuizMaker", template: "%s · QuizMaker" },
  description: "Create, publish and share interactive online quizzes with your students. No app or student account required.",
  applicationName: "QuizMaker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
