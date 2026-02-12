import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '@/context/AuthContext';
import { PermisosProvider } from '@/context/PermisosContext';
import { Toaster } from 'sonner';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <PermisosProvider>
      <Head>
        <title>OmniNexus Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </Head>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
        }}
      />
      <Component {...pageProps} />
      </PermisosProvider>
    </AuthProvider>
  );
}
