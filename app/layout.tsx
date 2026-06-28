import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth';
import { SonexAuthProvider } from '@/lib/sonexAuth';

export const metadata: Metadata = {
  title: 'FleetCommand TMS — Transportation Management System',
  description: 'Commercial all-in-one automated TMS. Maximize net profit, minimize manual input, and dispatch remotely with AI-powered tools.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-navy text-white antialiased">
        <SonexAuthProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#0D1F3C',
                  color: '#E2E8F0',
                  border: '1px solid #1A2F4A',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
                },
                success: {
                  iconTheme: { primary: '#10B981', secondary: '#0D1F3C' },
                },
                error: {
                  iconTheme: { primary: '#EF4444', secondary: '#0D1F3C' },
                },
              }}
            />
          </AuthProvider>
        </SonexAuthProvider>
      </body>
    </html>
  );
}
