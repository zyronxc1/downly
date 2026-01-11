import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Downly - Media Downloader',
  description: 'Download and convert media files from popular platforms',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
