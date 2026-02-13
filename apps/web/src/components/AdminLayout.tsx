'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  LayoutDashboard,
  Users,
  Landmark,
  PiggyBank,
  Wallet,
  TrendingUp,
  FileText,
  Menu,
  X,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  UserCog,
  BookOpen,
} from 'lucide-react';
import BackButton from './BackButton';
import { usePermisos } from '@/context/PermisosContext';
import type { Modulo } from '@/types/permisos';

const STORAGE_KEY = 'omninexus-sidebar-visible';

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; modulo: Modulo }[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
  { href: '/admin/inversores', label: 'Inversores', icon: Users, modulo: 'inversores' },
  { href: '/admin/cuentas', label: 'Cuentas', icon: Landmark, modulo: 'cuentas' },
  { href: '/admin/plazo-fijo', label: 'Plazos fijo', icon: PiggyBank, modulo: 'plazo_fijo' },
  { href: '/admin/caja-chica', label: 'Caja chica', icon: Wallet, modulo: 'caja_chica' },
  { href: '/admin/flujo-fondos', label: 'Flujo de fondos', icon: TrendingUp, modulo: 'flujo_fondos' },
  { href: '/admin/auditoria', label: 'Auditoría', icon: FileText, modulo: 'auditoria' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: UserCog, modulo: 'usuarios' },
];

export default function AdminLayout({
  children,
  title,
  backHref,
  backLabel,
}: {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { canVerModulo } = usePermisos();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = router.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setSidebarVisible(stored === 'true');
  }, [mounted]);

  const setSidebarVisibleAndSave = (v: boolean) => {
    setSidebarVisible(v);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(v));
  };

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mounted]);

  const showMenuButton = !isDesktop || !sidebarVisible;
  const sidebarPinned = isDesktop && sidebarVisible;
  const sidebarShowing = sidebarPinned || sidebarOpen;

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Overlay cuando el panel se abre como overlay */}
      {sidebarOpen && !sidebarPinned && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 text-slate-200 transform transition-transform duration-200 ease-out ${
          sidebarShowing ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarPinned ? 'lg:static lg:translate-x-0' : ''}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-slate-600">
            <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold text-lg text-white shrink-0 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center shrink-0">
                <LayoutDashboard size={18} />
              </div>
              <span className="truncate">OmniNexus</span>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              {sidebarPinned && (
                <button
                  onClick={() => setSidebarVisibleAndSave(false)}
                  className="hidden lg:flex p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white touch-manipulation"
                  aria-label="Ocultar panel"
                  title="Ocultar panel"
                >
                  <PanelLeftClose size={20} />
                </button>
              )}
              {!sidebarPinned && isDesktop && (
                <button
                  onClick={() => { setSidebarVisibleAndSave(true); setSidebarOpen(false); }}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white touch-manipulation"
                  aria-label="Mostrar panel siempre"
                  title="Mostrar panel"
                >
                  <PanelLeft size={20} />
                </button>
              )}
              {!sidebarPinned && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 touch-manipulation"
                  aria-label="Cerrar menú"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV.filter((item) => canVerModulo(item.modulo)).map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + '/') ||
                (item.href === '/admin/inversores' && pathname.includes('inversor-dashboard'));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 min-h-[48px] sm:min-h-0 sm:py-2.5 rounded-lg transition-colors touch-manipulation ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto opacity-70" />}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-700 space-y-1">
            <Link
              href="/admin/manual"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 w-full px-3 py-3 min-h-[48px] sm:min-h-0 sm:py-2.5 rounded-lg transition-colors touch-manipulation ${
                pathname === '/admin/manual' ? 'bg-blue-700 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <BookOpen size={20} />
              <span>Manual de uso</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-3 min-h-[48px] sm:min-h-0 sm:py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-manipulation"
            >
              <LogOut size={20} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 bg-slate-100 border-b border-slate-400 shadow-sm safe-area-inset">
          {showMenuButton && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-700 touch-manipulation"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
          )}
          {(backHref || backLabel) && (
            <BackButton href={backHref} label={backLabel ?? 'Volver'} className="-ml-1 sm:ml-0" />
          )}
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex-1 min-w-0 truncate">{title || 'Dashboard'}</h1>
        </header>
        <div className="flex-1 p-4 sm:p-6 overflow-auto pb-[env(safe-area-inset-bottom)] sm:pb-6">{children}</div>
      </main>
    </div>
  );
}
