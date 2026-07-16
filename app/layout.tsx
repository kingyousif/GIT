import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import '@/app/globals.css';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Endoscopy & Colonoscopy Management System',
  description: 'Production-ready local endoscopy unit management system built with Next.js.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
