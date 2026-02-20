import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import ClientLayout from '@/components/ClientLayout' // Import the wrapper
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans', // Define variable for Tailwind
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

// Correct Next.js 14+ Viewport export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming on mobile inputs (App-like feel)
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  title: 'Jewellery ERP System',
  description: 'Serialized jewellery inventory management and POS system',
  icons: {
    icon: '/favicon.ico', // Ensure you have a favicon
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-gray-50 text-slate-900">
         {/* All client logic is handled here */}
         <ClientLayout>
            {children}
         </ClientLayout>
      </body>
    </html>
  )
}