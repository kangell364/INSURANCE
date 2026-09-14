import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Texas Insurance Exam Prep',
    template: '%s · Texas Insurance Exam Prep',
  },
  description:
    'Structured preparation for Texas insurance licensing examinations, ' +
    'beginning with the Texas General Lines Property & Casualty exam.',
  // Student pages must never be indexed; individual marketing pages opt back
  // in. Defaulting to noindex is the safer direction to get wrong.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12243f',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}
