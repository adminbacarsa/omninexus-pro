'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { getInversor, updateInversor } from '@/services/inversorService';
import { listPlazosFijo } from '@/services/plazoFijoService';
import { listMovimientosFondo, listCuentasPorInversor } from '@/services/flujoFondosService';
import type { Inversor, TipoInversor, EstadoInversor } from '@/types/inversor';
import type { PlazoFijo } from '@/types/plazoFijo';
import type { MovimientoFondo, CuentaFondo } from '@/types/flujoFondos';

const TIPOS: { value: TipoInversor; label: string }[] = [
  { value: 'persona_fisica', label: 'Persona física' },
  { value: 'persona_juridica', label: 'Persona jurídica' },
];

const ESTADOS: { value: EstadoInversor; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'pendiente_documentacion', label: 'Pendiente documentación' },
];

const formatMonto = (n: number, moneda: string) =>
  `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0'}`;

const formatearCodigoPF = (index: number) => `PF-${String(index).padStart(7, '0')}`;

function getIdFromQuery(query: Record<string, string | string[] | undefined>): string {
  const raw = query.id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
  return '';
}

export default function InversorDashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [id, setId] = useState('');
  const { user } = useAuth();
  const { hasPermiso, canVerModulo } = usePermisos();
  const [inversor, setInversor] = useState<Inversor | null>(null);
  const [cuentas, setCuentas] = useState<CuentaFondo[]>([]);
  const [plazosFijo, setPlazosFijo] = useState<PlazoFijo[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFondo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEditar, setModalEditar] = useState(false);
  const [form, setForm] = useState<Partial<Inversor>>({});
  const [saving, setSaving] = useState(false);

  // Obtener id solo en cliente para evitar hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const idFromRouter = router.isReady ? getIdFromQuery(router.query) : '';
    const idFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id')?.trim() ?? '' : '';
    setId(idFromRouter || idFromUrl);
  }, [mounted, router.isReady, router.query]);

  useEffect(() => {
    if (!canVerModulo('inversores')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    if (!mounted || !id) return;
    const load = async () => {
      setLoading(true);
      try {
        const inv = await getInversor(id);
        if (!inv) {
          setInversor(null);
          setLoading(false);
          return;
        }
        setInversor(inv);
        if (inv) setForm({ ...inv });

        let cuentasInv: CuentaFondo[] = [];
        let pfs: PlazoFijo[] = [];
        let movs: MovimientoFondo[] = [];
        try {
          [cuentasInv, pfs, movs] = await Promise.all([
            listCuentasPorInversor(id),
            listPlazosFijo({ inversorId: id }),
            listMovimientosFondo({ inversorId: id }),
          ]);
        } catch (e) {
          console.warn('Error cargando cuentas, plazos fijo o movimientos:', e);
        }
        setCuentas(cuentasInv);
        setPlazosFijo(pfs);
        setMovimientos(movs);
      } catch (e) {
        console.error('Error cargando inversor:', e);
        toast.error('Error al cargar');
        setInversor(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mounted, id]);

  const nombreDisplay = (inv: Inversor) =>
    inv.tipo === 'persona_juridica' ? inv.razonSocial || inv.nombre : `${inv.nombre} ${inv.apellido || ''}`.trim();

  const capitalPlazosFijo = plazosFijo
    .filter((pf) => pf.estado === 'activo')
    .reduce((s, pf) => s + (pf.capitalActual ?? pf.capitalInicial ?? 0), 0);

  const plazosActivos = plazosFijo.filter((pf) => pf.estado === 'activo').length;
  const plazosVencidos = plazosFijo.filter((pf) => pf.estado === 'vencido').length;

  const interesesPagados = movimientos
    .filter((m) => m.categoria === 'Interés plazo fijo')
    .reduce((s, m) => s + (m.monto ?? 0), 0);

  const aportesRecibidos = movimientos
    .filter((m) => m.categoria === 'Aporte inversor')
    .reduce((s, m) => s + (m.monto ?? 0), 0);

  const retirosRealizados = movimientos
    .filter((m) => m.categoria === 'Retiro inversor')
    .reduce((s, m) => s + (m.monto ?? 0), 0);

  const saldoCuentas = cuentas.reduce((s, c) => s + (c.saldoActual ?? 0), 0);

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermiso('inversores', 'editar')) return;
    if (!inversor?.id || saving) return;
    setSaving(true);
    try {
      await updateInversor(inversor.id, {
        nombre: form.nombre ?? '',
        apellido: form.apellido,
        razonSocial: form.razonSocial,
        email: form.email ?? '',
        telefono: form.telefono,
        documento: form.documento,
        tipo: form.tipo ?? 'persona_fisica',
        estado: form.estado ?? 'activo',
      }, user?.uid);
      toast.success('Inversor actualizado');
      setInversor({ ...inversor, ...form });
      setModalEditar(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <AdminLayout title="Inversor" backHref="/admin/inversores" backLabel="Inversores">
        <div className="max-w-6xl mx-auto p-6">
          <Link href="/admin/inversores" className="inline-flex items-center gap-2 text-blue-700 hover:underline font-medium py-2">← Volver a inversores</Link>
          <p className="mt-4 text-slate-600">Seleccioná un inversor.</p>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!inversor) {
    return (
      <AdminLayout title="Inversor">
        <div className="max-w-6xl mx-auto p-6">
          <Link href="/admin/inversores" className="text-blue-700 hover:underline font-medium">← Volver a inversores</Link>
          <p className="mt-4 text-slate-600">Inversor no encontrado.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={nombreDisplay(inversor)} backHref="/admin/inversores" backLabel="Inversores">
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
          inversor.estado === 'activo' ? 'bg-green-100 text-green-800' :
          inversor.estado === 'inactivo' ? 'bg-slate-200' : 'bg-amber-100 text-amber-800'
          }`}>
            {ESTADOS.find((e) => e.value === inversor.estado)?.label ?? inversor.estado}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasPermiso('inversores', 'editar') && (
            <button onClick={() => setModalEditar(true)} className="px-4 py-2.5 border border-slate-400 rounded-xl hover:bg-slate-200 text-slate-700 text-sm font-medium">Editar</button>
          )}
          {hasPermiso('plazo_fijo', 'crear') && (
            <Link href={`/admin/plazo-fijo?inversor=${id}`} className="px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 text-sm font-medium shadow-sm">+ Nuevo plazo fijo</Link>
          )}
        </div>
      </header>

      <div className="card-datos p-5">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Datos del inversor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><span className="text-slate-500">Email</span><p className="font-medium">{inversor.email}</p></div>
          {inversor.telefono && <div><span className="text-slate-500">Teléfono</span><p className="font-medium">{inversor.telefono}</p></div>}
          {inversor.documento && <div><span className="text-slate-500">Documento</span><p className="font-medium">{inversor.documento}</p></div>}
          <div><span className="text-slate-500">Tipo</span><p className="font-medium">{TIPOS.find((t) => t.value === inversor.tipo)?.label}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-kpi-blue">
          <h3 className="text-xs font-medium text-blue-800 uppercase tracking-wider">Capital en plazos fijo</h3>
          <p className="text-2xl font-bold text-blue-700 mt-1">{capitalPlazosFijo > 0 ? formatMonto(capitalPlazosFijo, 'ARS') : '—'}</p>
          <p className="text-xs text-slate-600 mt-1">{plazosActivos} plazos activos</p>
        </div>
        <div className="card-kpi-slate">
          <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wider">Plazos fijo activos</h3>
          <p className="text-2xl font-bold text-slate-800 mt-1">{plazosActivos}</p>
          {plazosVencidos > 0 && <p className="text-xs text-amber-700 mt-1">{plazosVencidos} vencidos</p>}
        </div>
        <div className="card-kpi-emerald">
          <h3 className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Intereses pagados</h3>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{interesesPagados > 0 ? formatMonto(interesesPagados, 'ARS') : '—'}</p>
          <p className="text-xs text-slate-600 mt-1">Acreditados en cuenta</p>
        </div>
        <div className="card-kpi-zinc">
          <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wider">Aportes / Retiros</h3>
          <p className="text-lg font-bold text-slate-800 mt-1">+{formatMonto(aportesRecibidos, 'ARS')} / −{formatMonto(retirosRealizados, 'ARS')}</p>
        </div>
      </div>

      {/* Cuentas del inversor */}
      <div className="card-seccion overflow-hidden">
        <div className="p-4 border-b border-slate-400 bg-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Cuentas del inversor</h2>
          {hasPermiso('flujo_fondos', 'crear') && (
            <Link href="/admin/flujo-fondos" className="text-blue-700 hover:underline font-medium text-sm">Crear cuenta</Link>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {cuentas.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>Sin cuentas asignadas.</p>
              <p className="text-sm mt-2">Creá una cuenta en Flujo de fondos y asignale este inversor.</p>
              <Link href="/admin/flujo-fondos" className="inline-block mt-3 text-blue-700 hover:underline font-medium text-sm">Ir a Flujo de fondos →</Link>
            </div>
          ) : (
            cuentas.map((c) => (
              <Link key={c.id} href={`/admin/flujo-fondos?cuentaId=${c.id}`} className="block p-4 hover:bg-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{c.nombre}</span>
                    <span className="ml-2 text-slate-500 text-sm">{c.tipo}</span>
                  </div>
                  <span className="font-medium">{formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{c.moneda}</div>
              </Link>
            ))
          )}
        </div>
        {cuentas.length > 0 && (
          <div className="p-4 border-t border-slate-400 bg-slate-100">
            <p className="text-sm font-medium text-slate-700">Total en cuentas: {formatMonto(saldoCuentas, 'ARS')}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link href={`/admin/plazo-fijo?inversor=${id}`} className="block p-4 bg-slate-100 rounded-xl border border-slate-400 hover:border-blue-500 hover:shadow-md transition">
          <h3 className="font-semibold text-slate-800">Plazos fijo</h3>
          <p className="text-sm text-slate-600 mt-1">
            Ver y gestionar {plazosFijo.length} plazo{plazosFijo.length !== 1 ? 's' : ''} fijo · ordenados por fecha
          </p>
        </Link>
        <Link href="/admin/flujo-fondos" className="block p-4 bg-slate-100 rounded-xl border border-slate-400 hover:border-blue-500 hover:shadow-md transition">
          <h3 className="font-semibold text-slate-800">Flujo de fondos</h3>
          <p className="text-sm text-slate-600 mt-1">Aportes, retiros, transferencias</p>
        </Link>
      </div>

      <div className="card-seccion overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-400 bg-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Plazos fijo</h2>
          <Link href={`/admin/plazo-fijo?inversor=${id}`} className="text-blue-700 hover:underline font-medium text-sm">Ver todos</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {plazosFijo.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Sin plazos fijo</div>
          ) : (
            [...plazosFijo]
              .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
              .slice(0, 5)
              .map((pf, idx) => (
              <Link key={pf.id} href={`/admin/plazo-fijo?inversor=${id}`} className="block p-4 hover:bg-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-blue-700 font-mono text-xs mr-2">{formatearCodigoPF(idx + 1)}</span>
                    <span className="font-medium">{formatMonto(pf.capitalActual ?? pf.capitalInicial ?? 0, pf.moneda)}</span>
                    <span className="ml-2 text-slate-500 text-sm">{pf.tasaAnual}% · {pf.plazoDias} días</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${pf.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-slate-200'}`}>{pf.estado}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{pf.fechaInicio} → {pf.fechaVencimiento}</div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="card-seccion overflow-hidden">
        <div className="p-4 border-b border-slate-400 bg-slate-100"><h2 className="font-semibold text-slate-800">Movimientos recientes</h2></div>
        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {movimientos.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Sin movimientos</div>
          ) : (
            movimientos.slice(0, 15).map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className={`font-medium ${m.categoria === 'Interés plazo fijo' || m.categoria === 'Aporte inversor' ? 'text-green-700' : 'text-amber-700'}`}>
                    {m.categoria === 'Interés plazo fijo' || m.categoria === 'Aporte inversor' ? '+' : '−'}
                    {formatMonto(m.monto, m.moneda ?? 'ARS')}
                  </span>
                  <span className="ml-2 text-slate-500 text-sm">{m.fecha}</span>
                  <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-xs">{m.categoria}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !saving && setModalEditar(false)}>
          <div className="bg-slate-100 rounded-xl shadow-xl border border-slate-400 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Editar inversor</h2>
            <form onSubmit={handleEditar} className="space-y-4">
              {inversor.tipo === 'persona_juridica' ? (
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Razón social</label><input type="text" value={form.razonSocial ?? ''} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              ) : (
                <>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label><input type="text" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label><input type="text" value={form.apellido ?? ''} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                </>
              )}
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label><input type="text" value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoInversor })} className="w-full px-4 py-2 border rounded-lg">{ESTADOS.map((e) => (<option key={e.value} value={e.value}>{e.label}</option>))}</select></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar'}</button>
                <button type="button" onClick={() => setModalEditar(false)} disabled={saving} className="py-2.5 px-4 border border-slate-400 rounded-lg hover:bg-slate-200 text-slate-700">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
