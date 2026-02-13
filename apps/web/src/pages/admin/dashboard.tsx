'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { getDashboardKPIs, type DashboardKPIs } from '@/services/dashboardService';
import { Users, Landmark, PiggyBank, Wallet, TrendingUp, ChevronRight, ChevronDown, ChevronUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

const formatMonto = (n: number, moneda: string) =>
  `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}`;

const MODULES: { href: string; title: string; desc: string; icon: typeof Users; border: string; iconBg: string; modulo: 'inversores' | 'cuentas' | 'plazo_fijo' | 'caja_chica' | 'flujo_fondos' }[] = [
  { href: '/admin/inversores', title: 'Inversores', desc: 'Gestión de inversores y aportes', icon: Users, border: 'border-sky-200', iconBg: 'bg-sky-500', modulo: 'inversores' },
  { href: '/admin/cuentas', title: 'Cuentas', desc: 'Bancos, efectivo y fondos por inversor', icon: Landmark, border: 'border-sky-200', iconBg: 'bg-sky-500', modulo: 'cuentas' },
  { href: '/admin/plazo-fijo', title: 'Plazos fijo', desc: 'Depósitos a plazo, intereses, capitalización', icon: PiggyBank, border: 'border-sky-200', iconBg: 'bg-sky-500', modulo: 'plazo_fijo' },
  { href: '/admin/caja-chica', title: 'Caja chica', desc: 'Movimientos y rendiciones', icon: Wallet, border: 'border-sky-200', iconBg: 'bg-sky-500', modulo: 'caja_chica' },
  { href: '/admin/flujo-fondos', title: 'Flujo de fondos', desc: 'Ingresos, egresos y transferencias', icon: TrendingUp, border: 'border-sky-200', iconBg: 'bg-sky-500', modulo: 'flujo_fondos' },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { canVerModulo, loading: permLoading } = usePermisos();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [error, setError] = useState('');
  const [capitalExpanded, setCapitalExpanded] = useState(false);
  const [interesesExpanded, setInteresesExpanded] = useState(false);
  const [variacionesExpanded, setVariacionesExpanded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (permLoading) return;
    if (!canVerModulo('dashboard')) {
      const first = MODULES.find((m) => canVerModulo(m.modulo));
      if (first) router.replace(first.href);
      else router.replace('/login');
    }
  }, [canVerModulo, permLoading, router]);

  const cargarKPIs = () => {
    if (!user) return;
    setError('');
    getDashboardKPIs()
      .then(setKpis)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al cargar KPIs');
        setKpis(null);
      });
  };

  useEffect(() => {
    if (user) cargarKPIs();
  }, [user]);

  if (loading || permLoading || !user) {
      return (
    <div className="min-h-screen flex items-center justify-center bg-slate-200">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  const capitalTotal = (kpis?.capitalTotalAdeudadoARS ?? 0) + (kpis?.capitalTotalAdeudadoUSD ?? 0);
  const hayCapital = capitalTotal !== 0;

  return (
    <AdminLayout title="Dashboard">
      <div className="max-w-6xl mx-auto space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <button
              onClick={cargarKPIs}
              className="px-4 py-2 bg-amber-200 hover:bg-amber-300 rounded-lg text-sm font-medium"
            >
              Reintentar
            </button>
          </div>
        )}

        {kpis && !error && (kpis.inversores === 0 && kpis.plazosActivos === 0 && kpis.cuentasActivas === 0) && (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-sm">
            <p className="font-medium">No hay datos cargados todavía.</p>
            <p className="mt-1 text-sky-700">
              Creá <Link href="/admin/inversores" className="underline font-medium">inversores</Link>,
              luego <Link href="/admin/cuentas" className="underline font-medium">cuentas</Link> y{' '}
              <Link href="/admin/plazo-fijo" className="underline font-medium">plazos fijo</Link> para ver los KPIs.
              Si ya cargaste datos, revisá la consola del navegador (F12) por errores de Firestore.
            </p>
          </div>
        )}

        {/* Módulos - Acceso rápido */}
        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Módulos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {MODULES.filter((m) => canVerModulo(m.modulo)).map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`group block rounded-xl border-2 ${m.border} bg-slate-100 p-5 sm:p-6 min-h-[140px] sm:min-h-0 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] hover:border-slate-500 touch-manipulation`}
                >
                  <div className="flex flex-col h-full">
                    <div
                      className={`w-14 h-14 rounded-2xl ${m.iconBg} flex items-center justify-center mb-4 shadow-lg`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{m.title}</h3>
                    <p className="text-slate-600 text-sm flex-1">{m.desc}</p>
                    <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-slate-600 group-hover:text-slate-900">
                      Entrar
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Flujo del mes y resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card-kpi-slate">
            <p className="text-slate-500 text-sm font-medium">Aportes del mes (ARS)</p>
            <p className="text-2xl font-bold text-slate-900">{kpis ? formatMonto(kpis.aportesMes, 'ARS') : '—'}</p>
          </div>
          <div className="card-kpi-slate">
            <p className="text-slate-500 text-sm font-medium">Retiros del mes (ARS)</p>
            <p className="text-2xl font-bold text-red-600">{kpis ? formatMonto(kpis.retirosMes, 'ARS') : '—'}</p>
          </div>
        </div>
        <div className="card-kpi-blue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Flujo neto del mes (aportes − retiros)</p>
              <p className={`text-2xl font-bold ${(kpis?.flujoNetoMes ?? 0) >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                {kpis ? formatMonto(kpis.flujoNetoMes, 'ARS') : '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card-kpi-slate">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-medium">Inversores</p>
                <p className="text-2xl font-bold text-slate-800">{kpis?.inversores ?? '—'}</p>
              </div>
            </div>
          </div>
          <div className="card-kpi-slate">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-medium">Cuentas activas</p>
                <p className="text-2xl font-bold text-slate-800">{kpis?.cuentasActivas ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs principales - Capital y deuda */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
          <button
            type="button"
            onClick={() => setCapitalExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
            aria-expanded={capitalExpanded}
            aria-controls="capital-adeudado-content"
          >
            <h2 className="text-lg font-semibold text-slate-700">Capital adeudado a inversores</h2>
            {capitalExpanded ? (
              <ChevronUp size={22} className="text-slate-500 shrink-0" aria-hidden />
            ) : (
              <ChevronDown size={22} className="text-slate-500 shrink-0" aria-hidden />
            )}
          </button>
          <div
            id="capital-adeudado-content"
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0 transition-all duration-200 ${capitalExpanded ? 'block' : 'hidden'}`}
          >
            <div className="card-kpi-blue hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Capital total adeudado (ARS)</p>
                  <p className={`text-2xl font-bold ${(kpis?.capitalTotalAdeudadoARS ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {kpis ? formatMonto(kpis.capitalTotalAdeudadoARS, 'ARS') : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-kpi-blue hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Capital total adeudado (USD)</p>
                  <p className={`text-2xl font-bold ${(kpis?.capitalTotalAdeudadoUSD ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {kpis ? formatMonto(kpis.capitalTotalAdeudadoUSD, 'USD') : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-kpi-slate hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                  <PiggyBank className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Plazos activos</p>
                  <p className="text-2xl font-bold text-slate-800">{kpis?.plazosActivos ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intereses a pagar */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
          <button
            type="button"
            onClick={() => setInteresesExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
            aria-expanded={interesesExpanded}
            aria-controls="intereses-pagar-content"
          >
            <h2 className="text-lg font-semibold text-slate-700">Intereses a pagar</h2>
            {interesesExpanded ? (
              <ChevronUp size={22} className="text-slate-500 shrink-0" aria-hidden />
            ) : (
              <ChevronDown size={22} className="text-slate-500 shrink-0" aria-hidden />
            )}
          </button>
          <div
            id="intereses-pagar-content"
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0 transition-all duration-200 ${interesesExpanded ? 'block' : 'hidden'}`}
          >
            <div className="card-kpi-slate hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Intereses a pagar hoy (ARS)</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {kpis ? formatMonto(kpis.interesesAPagarHoyARS, 'ARS') : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-kpi-slate hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Intereses a pagar hoy (USD)</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {kpis ? formatMonto(kpis.interesesAPagarHoyUSD, 'USD') : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-kpi-slate hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Intereses mes en curso (ARS)</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {kpis ? formatMonto(kpis.interesesAPagarMes, 'ARS') : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-kpi-blue hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Intereses mes en curso (USD)</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {kpis ? formatMonto(kpis.interesesAPagarMesUSD, 'USD') : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-kpi-slate hover:shadow-lg lg:col-span-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-500 text-sm font-medium">Intereses pendientes totales (ARS + USD)</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {kpis
                      ? `${formatMonto(kpis.interesesPendientesTotalARS ?? 0, 'ARS')} / ${formatMonto(kpis.interesesPendientesTotalUSD ?? 0, 'USD')}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Porcentajes y variaciones */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
          <button
            type="button"
            onClick={() => setVariacionesExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
            aria-expanded={variacionesExpanded}
            aria-controls="variaciones-content"
          >
            <h2 className="text-lg font-semibold text-slate-700">Variaciones y composición</h2>
            {variacionesExpanded ? (
              <ChevronUp size={22} className="text-slate-500 shrink-0" aria-hidden />
            ) : (
              <ChevronDown size={22} className="text-slate-500 shrink-0" aria-hidden />
            )}
          </button>
          <div
            id="variaciones-content"
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-0 transition-all duration-200 ${variacionesExpanded ? 'block' : 'hidden'}`}
          >
            <div className="card-kpi-zinc hover:shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium">% capitalización</p>
                  <p className="text-xl font-bold text-slate-900">{kpis ? `${kpis.pctCapitalizacion.toFixed(1)}%` : '—'}</p>
                  <p className="text-xs text-slate-400">Plazos que capitalizan</p>
                </div>
              </div>
            </div>
            <div className="card-kpi-zinc hover:shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium">% a pagar</p>
                  <p className="text-xl font-bold text-slate-900">{kpis ? `${kpis.pctPagar.toFixed(1)}%` : '—'}</p>
                  <p className="text-xs text-slate-400">Plazos que pagan intereses</p>
                </div>
              </div>
            </div>
            <div className="card-kpi-slate hover:shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium">Crecimiento mes</p>
                  <p className="text-xl font-bold text-slate-900">
                    {kpis && hayCapital ? `+${kpis.pctCrecimientoAportes.toFixed(2)}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400">Aportes vs capital</p>
                </div>
              </div>
            </div>
            <div className="card-kpi-slate hover:shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium">Baja de deuda mes</p>
                  <p className="text-xl font-bold text-red-600">
                    {kpis && hayCapital ? `−${kpis.pctBajaRetiros.toFixed(2)}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400">Retiros vs capital</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-seccion p-4">
          <p className="text-slate-500 text-sm">
            Conectado como <span className="font-medium text-slate-700">{user.email}</span>
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
