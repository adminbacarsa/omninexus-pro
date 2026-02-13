'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';

/** Redirige según estado de autenticación y activación. */
export default function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = router.pathname;
  const { user, loading: authLoading } = useAuth();
  const { activo, loading: permLoading } = usePermisos();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (pathname !== '/login' && pathname !== '/') {
        router.replace('/login');
      }
      return;
    }

    if (permLoading) return;

    if (!activo) {
      if (pathname !== '/pendiente-activacion') {
        router.replace('/pendiente-activacion');
      }
      return;
    }

    if (activo && pathname === '/pendiente-activacion') {
      router.replace('/admin/dashboard');
    }
  }, [user, authLoading, permLoading, activo, pathname, router]);

  return <>{children}</>;
}
