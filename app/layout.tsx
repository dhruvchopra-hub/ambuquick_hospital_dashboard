import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AmbuQuick Hospital Dashboard',
  description: 'Hospital Partner Dashboard for AmbuQuick ambulance services',
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
