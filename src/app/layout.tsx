import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FSRS Cards | 智慧記憶卡',
  description: '使用 FSRS 演算法的智慧間隔重複記憶卡應用，支援 LaTeX 公式、Markdown 格式與 AI 自動生成卡片',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FSRS Cards',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a12',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ToastProvider>
          <PWARegistry />
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}

// 註冊 Service Worker 的組件
function PWARegistry() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(
                function(registration) {
                  console.log('Service Worker registration successful');
                },
                function(err) {
                  console.log('Service Worker registration failed: ', err);
                }
              );
            });
          }
        `,
      }}
    />
  );
}
