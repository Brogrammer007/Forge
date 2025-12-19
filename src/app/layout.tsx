import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastContainer } from '@/components/ui/Toast';
import { ElectronFixProvider } from '@/components/ElectronFixProvider';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Forge - Professional Image Design Suite',
  description: 'All-in-one image design utility: convert, edit, upscale, vectorize, build grids, and create GIFs. 100% local processing.',
  authors: [{ name: 'Vuk' }],
  creator: 'Vuk',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-new.png', sizes: '256x256', type: 'image/png' },
    ],
    apple: '/icon-new.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <ElectronFixProvider>
          <div className="flex min-h-screen bg-zinc-950">
            <Sidebar />
            <main className="flex-1 ml-64">
              <div className="bg-radial-gradient min-h-screen">
                <div className="bg-grid min-h-screen">
                  {children}
                </div>
              </div>
            </main>
          </div>
          <ToastContainer />
        </ElectronFixProvider>
      </body>
    </html>
  );
}

