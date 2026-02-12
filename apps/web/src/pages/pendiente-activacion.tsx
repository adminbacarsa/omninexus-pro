'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { UserClock, LogOut } from 'lucide-react';

export default function PendienteActivacionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { systemUser, loading: permLoading, activo } = usePermisos();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (!permLoading && user && activo) {
      router.replace('/admin/dashboard');
    }
  }, [user, authLoading, permLoading, activo, router]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    window.location.href = '/login';
  };

  if (authLoading || permLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <UserClock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          Cuenta pendiente de activación
        </h1>
        <p className="text-slate-600 mb-6">
          Tu acceso a la plataforma debe ser activado por un Super Administrador.
          Una vez que te asignen permisos, podrás acceder a OmniNexus Pro.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          Sesión iniciada como{' '}
          <span className="font-medium text-slate-700">{user?.email ?? systemUser?.email}</span>
        </p>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
