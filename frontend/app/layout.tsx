import type { Metadata } from "next";
import { Geist } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PilotPhD",
  description: "Your personal PhD application assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fafafa] text-gray-900">
        <NavBar />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6 md:py-10">
          {children}
        </main>
      </body>
    </html>
  )
}
