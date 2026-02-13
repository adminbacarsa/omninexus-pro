'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { listInversores } from '@/services/inversorService';
import { listCuentasActivas } from '@/services/flujoFondosService';
import {
  listPlazosFijo,
  createPlazoFijo,
  getPlazoFijo,
  listMovimientosPlazoFijo,
  listFechasPago,
  registrarAporte,
  registrarRetiro,
  pagarInteres,
  capitalizarInteres,
  cancelarPlazoFijo,
  estaVencido,
  agregarDias,
  diasEntre,
} from '@/services/plazoFijoService';
import type { Inversor } from '@/types/inversor';
import type {
  PlazoFijo,
  MovimientoPlazoFijo,
  FechaPagoPF,
  FrecuenciaPago,
  AplicacionIntereses,
  TipoInteres,
} from '@/types/plazoFijo';
import type { CuentaFondo } from '@/types/flujoFondos';

const FRECUENCIAS: { value: FrecuenciaPago; label: string }[] = [
  { value: 'vencimiento', label: 'Al vencimiento' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
];

const APLICACION: { value: AplicacionIntereses; label: string }[] = [
  { value: 'pagar', label: 'Pagar (acreditar en cuenta cliente)' },
  { value: 'capitalizar', label: 'Capitalizar (sumar al capital)' },
];

const TIPOS_INTERES: { value: TipoInteres; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'compuesto', label: 'Compuesto' },
];

const PLAZOS_PREDEF = [30, 60, 90, 180, 365, 730]; // 365 = 12 meses, 730 = 2 años

const formatMonto = (n: number, moneda: string) =>
  `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0'}`;

const formatearCodigoPF = (index: number) => `PF-${String(index).padStart(7, '0')}`;

export default function PlazoFijoPage() {
  const router = useRouter();
  const { inversor: inversorQuery } = router.query;
  const { user } = useAuth();
  const { hasPermiso, canVerModulo } = usePermisos();
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [cuentas, setCuentas] = useState<CuentaFondo[]>([]);
  const [plazos, setPlazos] = useState<PlazoFijo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inversorFiltro, setInversorFiltro] = useState('');
  const [modal, setModal] = useState<'crear' | null>(null);
  const [pfSeleccionado, setPfSeleccionado] = useState<PlazoFijo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoPlazoFijo[]>([]);
  const [fechasPago, setFechasPago] = useState<FechaPagoPF[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    inversorId: '',
    capitalInicial: 0,
    moneda: 'ARS' as 'ARS' | 'USD',
    tasaAnual: 0,
    tipoInteres: 'simple' as TipoInteres,
    plazoDias: 30,
    fechaInicio: new Date().toISOString().slice(0, 10),
    frecuenciaPago: 'mensual' as FrecuenciaPago,
    aplicacionIntereses: 'pagar' as AplicacionIntereses,
    renovacionAutomatica: false,
    cuentaFondoId: '',
    cuentaOrigenId: '',
    observacion: '',
  });

  const [modalAccion, setModalAccion] = useState<'aporte' | 'retiro' | 'pagar' | 'capitalizar' | null>(null);
  const [fechaPagoSeleccionada, setFechaPagoSeleccionada] = useState<FechaPagoPF | null>(null);
  const [formAccion, setFormAccion] = useState({ monto: 0, fecha: '', referencia: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [inv, pfs] = await Promise.all([
        listInversores(),
        listPlazosFijo(inversorFiltro ? { inversorId: inversorFiltro } : undefined),
      ]);
      setInversores(inv);
      setPlazos(pfs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const loadCuentas = async () => {
    const c = await listCuentasActivas();
    setCuentas(c);
  };

  useEffect(() => {
    if (!canVerModulo('plazo_fijo')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    if (typeof inversorQuery === 'string') setInversorFiltro(inversorQuery);
  }, [inversorQuery]);

  useEffect(() => {
    load();
    loadCuentas();
  }, []);

  useEffect(() => {
    load();
  }, [inversorFiltro]);

  useEffect(() => {
    if (!pfSeleccionado?.id) return;
    (async () => {
      try {
        const [mov, fechas] = await Promise.all([
          listMovimientosPlazoFijo(pfSeleccionado.id!),
          listFechasPago(pfSeleccionado.id!),
        ]);
        setMovimientos(mov);
        setFechasPago(fechas);
      } catch {
        setMovimientos([]);
        setFechasPago([]);
      }
    })();
  }, [pfSeleccionado?.id]);


  const abrirCrear = () => {
    loadCuentas();
    setForm({
      inversorId: inversorFiltro || '',
      capitalInicial: 0,
      moneda: 'ARS',
      tasaAnual: 0,
      tipoInteres: 'simple',
      plazoDias: 30,
      fechaInicio: new Date().toISOString().slice(0, 10),
      frecuenciaPago: 'mensual',
      aplicacionIntereses: 'pagar',
      renovacionAutomatica: false,
      cuentaFondoId: '',
      cuentaOrigenId: '',
      observacion: '',
    });
    setModal('crear');
    setError('');
  };

  const cuentasDelInversor = form.inversorId
    ? cuentas.filter((c) => c.inversorId === form.inversorId && (c.moneda ?? 'ARS') === form.moneda)
    : [];
  const cuentaOrigenSeleccionada = cuentasDelInversor.find((c) => c.id === form.cuentaOrigenId);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!hasPermiso('plazo_fijo', 'crear')) return;
    if (!form.inversorId) {
      setError('Seleccioná un inversor');
      toast.error('Seleccioná un inversor');
      return;
    }
    if (form.capitalInicial <= 0 || form.tasaAnual <= 0 || form.plazoDias <= 0) {
      setError('Capital, tasa y plazo son obligatorios y mayores a 0');
      toast.error('Revisá los valores');
      return;
    }
    if (form.aplicacionIntereses === 'pagar' && !form.cuentaFondoId) {
      setError('Si aplicás pagar intereses, la cuenta del cliente es obligatoria');
      toast.error('Seleccioná cuenta del cliente');
      return;
    }
    if (form.cuentaOrigenId && (cuentaOrigenSeleccionada?.saldoActual ?? 0) < form.capitalInicial) {
      setError('Saldo insuficiente en la cuenta seleccionada');
      toast.error('Saldo insuficiente en la cuenta');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createPlazoFijo(
        {
          inversorId: form.inversorId,
          capitalInicial: form.capitalInicial,
          moneda: form.moneda,
          tasaAnual: form.tasaAnual,
          tipoInteres: form.tipoInteres,
          plazoDias: form.plazoDias,
          fechaInicio: form.fechaInicio,
          frecuenciaPago: form.frecuenciaPago,
          aplicacionIntereses: form.aplicacionIntereses,
          renovacionAutomatica: form.renovacionAutomatica,
          cuentaFondoId: form.cuentaFondoId || undefined,
          observacion: form.observacion.trim() || undefined,
          estado: 'activo',
        },
        user?.uid,
        form.cuentaOrigenId || undefined
      );
      toast.success('Plazo fijo creado');
      setModal(null);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const abrirAporte = () => {
    setFormAccion({
      monto: 0,
      fecha: new Date().toISOString().slice(0, 10),
      referencia: '',
    });
    setModalAccion('aporte');
  };

  const abrirRetiro = () => {
    setFormAccion({
      monto: 0,
      fecha: new Date().toISOString().slice(0, 10),
      referencia: '',
    });
    setModalAccion('retiro');
  };

  const abrirPagar = (fp: FechaPagoPF) => {
    setFechaPagoSeleccionada(fp);
    setFormAccion({
      monto: fp.interesEstimado ?? 0,
      fecha: new Date().toISOString().slice(0, 10),
      referencia: '',
    });
    setModalAccion('pagar');
  };

  const abrirCapitalizar = (fp: FechaPagoPF) => {
    setFechaPagoSeleccionada(fp);
    setFormAccion({
      monto: fp.interesEstimado ?? 0,
      fecha: new Date().toISOString().slice(0, 10),
      referencia: '',
    });
    setModalAccion('capitalizar');
  };

  const handleCancelar = async () => {
    if (!pfSeleccionado?.id) return;
    const capital = pfSeleccionado.capitalActual ?? pfSeleccionado.capitalInicial ?? 0;
    const msg = pfSeleccionado.cuentaFondoId
      ? `¿Cancelar este plazo fijo? Se devolverán ${formatMonto(capital, pfSeleccionado.moneda)} a la cuenta del inversor.`
      : `¿Cancelar este plazo fijo? El capital (${formatMonto(capital, pfSeleccionado.moneda)}) no se transferirá a ninguna cuenta (no hay cuenta asignada).`;
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      await cancelarPlazoFijo(
        pfSeleccionado.id,
        new Date().toISOString().slice(0, 10),
        'Cancelación por super admin',
        user?.uid
      );
      toast.success('Plazo fijo cancelado');
      setPfSeleccionado(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setSaving(false);
    }
  };

  const handleAccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfSeleccionado?.id || saving) return;
    if (modalAccion === 'pagar' && !hasPermiso('plazo_fijo', 'pagar_interes')) return;
    if (modalAccion === 'capitalizar' && !hasPermiso('plazo_fijo', 'capitalizar')) return;
    if ((modalAccion === 'aporte' || modalAccion === 'retiro') && !hasPermiso('plazo_fijo', 'editar')) return;
    if (formAccion.monto <= 0) {
      toast.error('Monto debe ser mayor a 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (modalAccion === 'aporte') {
        await registrarAporte(
          pfSeleccionado.id,
          formAccion.monto,
          formAccion.fecha,
          formAccion.referencia || undefined,
          user?.uid
        );
        toast.success('Aporte registrado');
      } else if (modalAccion === 'retiro') {
        await registrarRetiro(
          pfSeleccionado.id,
          formAccion.monto,
          formAccion.fecha,
          formAccion.referencia || undefined,
          user?.uid
        );
        toast.success('Retiro registrado');
      } else if (modalAccion === 'pagar' && fechaPagoSeleccionada?.id) {
        await pagarInteres(
          pfSeleccionado.id,
          fechaPagoSeleccionada.id,
          formAccion.monto,
          formAccion.fecha,
          formAccion.referencia || undefined,
          user?.uid
        );
        toast.success('Interés pagado y acreditado en cuenta del cliente');
      } else if (modalAccion === 'capitalizar' && fechaPagoSeleccionada?.id) {
        await capitalizarInteres(
          pfSeleccionado.id,
          fechaPagoSeleccionada.id,
          formAccion.monto,
          formAccion.fecha,
          user?.uid
        );
        toast.success('Interés capitalizado');
      }
      setModalAccion(null);
      setFechaPagoSeleccionada(null);
      load();
      const pf = await getPlazoFijo(pfSeleccionado.id);
      setPfSeleccionado(pf ?? null);
      const [mov, fechas] = await Promise.all([
        listMovimientosPlazoFijo(pfSeleccionado.id),
        listFechasPago(pfSeleccionado.id),
      ]);
      setMovimientos(mov);
      setFechasPago(fechas);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const nombreInversor = (id: string) =>
    inversores.find((i) => i.id === id)?.nombre ||
    inversores.find((i) => i.id === id)?.razonSocial ||
    id;

  const backHref = inversorFiltro ? `/admin/inversor-dashboard?id=${inversorFiltro}` : '/admin/dashboard';
  const backLabel = inversorFiltro ? 'Inversor' : 'Dashboard';

  return (
    <AdminLayout title="Plazos fijo" backHref={backHref} backLabel={backLabel}>
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
        <div></div>
        {hasPermiso('plazo_fijo', 'crear') && (
          <button
            onClick={abrirCrear}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 text-sm font-medium shadow-sm touch-manipulation"
          >
            + Nuevo plazo fijo
          </button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Filtrar por inversor</label>
          <select
            value={inversorFiltro}
            onChange={(e) => setInversorFiltro(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">Todos</option>
            {inversores.map((i) => (
              <option key={i.id} value={i.id}>
                {i.tipo === 'persona_juridica' ? i.razonSocial || i.nombre : `${i.nombre} ${i.apellido || ''}`.trim()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800">Plazos fijo</h2>
              <p className="text-xs text-slate-500 mt-1">{plazos.length} registro{plazos.length !== 1 ? 's' : ''} · ordenados por fecha de inicio</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
              {plazos.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No hay plazos fijo. Creá uno.</div>
              ) : (
                [...plazos]
                  .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
                  .map((pf, idx) => (
                  <div
                    key={pf.id}
                    onClick={() => setPfSeleccionado(pfSeleccionado?.id === pf.id ? null : pf)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                      pfSeleccionado?.id === pf.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="font-medium text-slate-800">
                      <span className="text-blue-700 font-mono text-sm mr-2">{formatearCodigoPF(idx + 1)}</span>
                      {nombreInversor(pf.inversorId)} — {formatMonto(pf.capitalActual ?? pf.capitalInicial, pf.moneda)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {pf.tasaAnual}% {pf.tipoInteres} · {pf.plazoDias} días · {pf.fechaInicio} → {pf.fechaVencimiento}
                    </div>
                    <span
                      className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs ${
                        pf.estado === 'activo'
                          ? 'bg-green-100 text-green-800'
                          : pf.estado === 'vencido'
                          ? 'bg-amber-100 text-amber-800'
                          : pf.estado === 'cancelado' || pf.estado === 'cerrado'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {pf.estado}
                    </span>
                    {pf.observacion && (
                      <p className="text-xs text-slate-500 mt-1">{pf.observacion}</p>
                    )}
                  </div>
                  ))
              )}
            </div>
          </div>

          {/* Detalle */}
          {pfSeleccionado && (
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5">
                <h2 className="font-semibold text-slate-800 mb-2">
                  <span className="text-blue-700 font-mono text-sm mr-2">
                    {formatearCodigoPF(
                      Math.max(1, [...plazos].sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')).findIndex((p) => p.id === pfSeleccionado.id) + 1)
                    )}
                  </span>
                  {nombreInversor(pfSeleccionado.inversorId)} — Capital: {formatMonto(pfSeleccionado.capitalActual ?? 0, pfSeleccionado.moneda)}
                </h2>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>Inicio: {pfSeleccionado.fechaInicio} · Vencimiento: {pfSeleccionado.fechaVencimiento}</p>
                  <p>
                    {pfSeleccionado.tasaAnual}% {pfSeleccionado.tipoInteres} · {pfSeleccionado.frecuenciaPago} ·{' '}
                    {pfSeleccionado.aplicacionIntereses}
                  </p>
                  {pfSeleccionado.renovacionAutomatica && (
                    <span className="text-amber-700">Renovación automática</span>
                  )}
                  {estaVencido(pfSeleccionado) && !pfSeleccionado.renovacionAutomatica && (
                    <span className="block mt-2 text-amber-700 font-medium text-sm">
                      ⚠ Plazo vencido · No renovación automática — Capital disponible para retiro
                    </span>
                  )}
                </div>
                {estaVencido(pfSeleccionado) && pfSeleccionado.estado !== 'cerrado' && (pfSeleccionado.capitalActual ?? 0) > 0 && hasPermiso('plazo_fijo', 'editar') && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={abrirRetiro} className="px-4 py-3 min-h-[44px] bg-amber-600 text-white rounded-xl text-sm font-medium touch-manipulation">
                      − Retiro de capital
                    </button>
                  </div>
                )}
                {!estaVencido(pfSeleccionado) && pfSeleccionado.estado === 'activo' && hasPermiso('plazo_fijo', 'editar') && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={abrirAporte} className="px-4 py-3 min-h-[44px] bg-green-600 text-white rounded-xl text-sm font-medium touch-manipulation">
                      + Aporte
                    </button>
                    <p className="text-xs text-slate-500 mt-2">El retiro estará disponible a partir del {pfSeleccionado.fechaVencimiento} (vencimiento)</p>
                  </div>
                )}
                {(pfSeleccionado.estado === 'activo' || pfSeleccionado.estado === 'vencido') && (pfSeleccionado.capitalActual ?? 0) > 0 && hasPermiso('plazo_fijo', 'eliminar') && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={handleCancelar}
                      className="px-4 py-3 min-h-[44px] bg-red-100 text-red-700 border border-red-300 rounded-xl text-sm font-medium hover:bg-red-200 touch-manipulation"
                    >
                      Cancelar plazo fijo
                    </button>
                    <p className="text-xs text-slate-500 mt-1 w-full">
                      Devuelve el capital a la cuenta del inversor y marca el plazo como cancelado. Requiere permiso de eliminación.
                    </p>
                  </div>
                )}
              </div>

              {/* Fechas de pago */}
              <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Fechas de pago</h3>
                {fechasPago.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sin fechas</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {fechasPago.map((fp) => (
                      <div
                        key={fp.id}
                        className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                      >
                        <div>
                          <span className="font-medium">{fp.fechaProgramada}</span>
                          <span className="ml-2 text-slate-600">
                            {formatMonto(fp.interesEstimado ?? 0, pfSeleccionado.moneda)}
                          </span>
                          <span
                            className={`ml-2 px-2 py-0.5 rounded text-xs ${
                              fp.estado === 'pendiente'
                                ? 'bg-slate-100'
                                : fp.estado === 'pagado'
                                ? 'bg-green-100 text-green-800'
                                : fp.estado === 'capitalizado'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200'
                            }`}
                          >
                            {fp.estado}
                          </span>
                        </div>
                        {fp.estado === 'pendiente' && pfSeleccionado.estado === 'activo' && (
                          <div className="flex flex-wrap gap-2">
                            {pfSeleccionado.aplicacionIntereses === 'pagar' && hasPermiso('plazo_fijo', 'pagar_interes') && (
                              <button
                                onClick={() => abrirPagar(fp)}
                                className="py-2 px-3 min-h-[40px] text-green-600 bg-green-50 hover:bg-green-100 rounded-lg text-sm font-medium touch-manipulation"
                              >
                                Pagar
                              </button>
                            )}
                            {hasPermiso('plazo_fijo', 'capitalizar') && (
                              <button
                                onClick={() => abrirCapitalizar(fp)}
                                className="py-2 px-3 min-h-[40px] text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium touch-manipulation"
                              >
                                Capitalizar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Movimientos */}
              <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Movimientos</h3>
                {movimientos.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sin movimientos</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {movimientos.map((m) => (
                      <div key={m.id} className="text-sm py-2 border-b border-slate-100 last:border-0">
                        <span className="font-medium">{m.fecha}</span>
                        <span className="ml-2">{m.tipo}</span>
                        <span
                          className={`ml-2 ${
                            m.tipo === 'aporte' || m.tipo === 'capitalizacion_interes'
                              ? 'text-green-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {m.tipo === 'aporte' || m.tipo === 'capitalizacion_interes' ? '+' : '−'}
                          {formatMonto(m.monto, m.moneda)}
                        </span>
                        <span className="ml-2 text-slate-500">→ {formatMonto(m.capitalResultante, m.moneda)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal crear */}
      {modal === 'crear' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => !saving && setModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4">Nuevo plazo fijo</h2>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inversor *</label>
                <select
                  value={form.inversorId}
                  onChange={(e) => setForm({ ...form, inversorId: e.target.value, cuentaOrigenId: '', cuentaFondoId: '' })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {inversores.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.tipo === 'persona_juridica' ? i.razonSocial || i.nombre : `${i.nombre} ${i.apellido || ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              {form.inversorId && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Cuentas de este inversor en {form.moneda}:
                  </p>
                  {cuentasDelInversor.length === 0 ? (
                    <p className="text-amber-700 text-sm">
                      No hay cuentas asignadas a este inversor en {form.moneda}. Creá una en{' '}
                      <Link href="/admin/flujo-fondos" className="underline font-medium" target="_blank" rel="noopener">
                        Flujo de fondos
                      </Link>{' '}
                      y asignala al inversor (campo «Inversor» al crear/editar la cuenta). Cerrando y volviendo a abrir el modal se actualizará la lista.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm text-slate-600">
                      {cuentasDelInversor.map((c) => (
                        <li key={c.id} className="flex justify-between">
                          <span>{c.nombre}</span>
                          <span className="font-medium text-slate-800">{formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')}</span>
                        </li>
                      ))}
                      <li className="flex justify-between pt-1 mt-1 border-t border-slate-200 font-semibold">
                        <span>Total disponible</span>
                        <span className="text-slate-800">
                          {formatMonto(
                            cuentasDelInversor.reduce((s, c) => s + (c.saldoActual ?? 0), 0),
                            form.moneda
                          )}
                        </span>
                      </li>
                    </ul>
                  )}
                  {cuentasDelInversor.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const total = cuentasDelInversor.reduce((s, c) => s + (c.saldoActual ?? 0), 0);
                        if (total > 0) setForm({ ...form, capitalInicial: total });
                      }}
                      className="mt-2 text-xs text-indigo-600 hover:underline font-medium"
                    >
                      Usar total disponible como capital
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Capital inicial *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.capitalInicial || ''}
                    onChange={(e) => setForm({ ...form, capitalInicial: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                  <select
                    value={form.moneda}
                    onChange={(e) => setForm({ ...form, moneda: e.target.value as 'ARS' | 'USD', cuentaOrigenId: '', cuentaFondoId: '' })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              {form.inversorId && cuentasDelInversor.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta de origen del capital (opcional)</label>
                  <p className="text-xs text-slate-500 mb-2">
                    Si elegís una cuenta, el capital se debitará de ella al crear el plazo fijo.
                  </p>
                  <div className="flex gap-2 items-end">
                    <select
                      value={form.cuentaOrigenId}
                      onChange={(e) => setForm({ ...form, cuentaOrigenId: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="">Ninguna (capital manual)</option>
                      {cuentasDelInversor.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} — Saldo: {formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')}
                        </option>
                      ))}
                    </select>
                    {cuentaOrigenSeleccionada && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            capitalInicial: cuentaOrigenSeleccionada.saldoActual ?? 0,
                          })
                        }
                        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        Usar saldo completo
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tasa anual (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.tasaAnual || ''}
                    onChange={(e) => setForm({ ...form, tasaAnual: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo interés</label>
                  <select
                    value={form.tipoInteres}
                    onChange={(e) => setForm({ ...form, tipoInteres: e.target.value as TipoInteres })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    {TIPOS_INTERES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Plazo (días) *</label>
                  <select
                    value={form.plazoDias}
                    onChange={(e) => setForm({ ...form, plazoDias: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    {PLAZOS_PREDEF.map((d) => (
                      <option key={d} value={d}>
                        {d === 365 ? '365 días (12 meses)' : d === 730 ? '730 días (2 años)' : `${d} días`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio *</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha vencimiento</label>
                  <input
                    type="date"
                    value={agregarDias(form.fechaInicio, form.plazoDias)}
                    onChange={(e) => {
                      const fechaVenc = e.target.value;
                      const dias = diasEntre(form.fechaInicio, fechaVenc);
                      if (dias > 0) setForm({ ...form, plazoDias: dias });
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                  <p className="text-xs text-slate-500 mt-1">Podés elegir fecha fin directamente (ajusta el plazo)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia pago</label>
                  <select
                    value={form.frecuenciaPago}
                    onChange={(e) => setForm({ ...form, frecuenciaPago: e.target.value as FrecuenciaPago })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    {FRECUENCIAS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Aplicación intereses</label>
                  <select
                    value={form.aplicacionIntereses}
                    onChange={(e) => setForm({ ...form, aplicacionIntereses: e.target.value as AplicacionIntereses })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    {APLICACION.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.aplicacionIntereses === 'pagar' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta del cliente *</label>
                  {cuentasDelInversor.length === 0 ? (
                    <p className="text-amber-700 text-sm py-2">
                      Creá una cuenta para este inversor en{' '}
                      <Link href="/admin/flujo-fondos" className="underline">
                        Flujo de fondos
                      </Link>{' '}
                      (misma moneda) para poder acreditar intereses.
                    </p>
                  ) : (
                    <>
                      <select
                        value={form.cuentaFondoId}
                        onChange={(e) => setForm({ ...form, cuentaFondoId: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        required
                      >
                        <option value="">Seleccionar cuenta...</option>
                        {cuentasDelInversor.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} — Saldo: {formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Los intereses pagados se acreditarán aquí</p>
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.renovacionAutomatica}
                    onChange={(e) => setForm({ ...form, renovacionAutomatica: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Renovación automática</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observación</label>
                <input
                  type="text"
                  value={form.observacion}
                  onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="Ej: Renovación PF, convenio especial..."
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || (form.aplicacionIntereses === 'pagar' && cuentasDelInversor.length === 0)}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Crear plazo fijo'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={saving}
                  className="py-2.5 px-4 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal aporte/retiro/pagar/capitalizar */}
      {modalAccion && pfSeleccionado && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => !saving && setModalAccion(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modalAccion === 'aporte' && 'Registrar aporte'}
              {modalAccion === 'retiro' && 'Registrar retiro'}
              {modalAccion === 'pagar' && 'Pagar interés (acreditar en cuenta)'}
              {modalAccion === 'capitalizar' && 'Capitalizar interés'}
            </h2>
            <form onSubmit={handleAccion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAccion.monto || ''}
                  onChange={(e) => setFormAccion({ ...formAccion, monto: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                />
                {modalAccion === 'retiro' && (
                  <p className="text-xs text-slate-500 mt-1">
                      Capital disponible: {formatMonto(pfSeleccionado.capitalActual ?? 0, pfSeleccionado.moneda)}
                    </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={formAccion.fecha}
                  onChange={(e) => setFormAccion({ ...formAccion, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              {(modalAccion === 'aporte' || modalAccion === 'pagar') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referencia</label>
                  <input
                    type="text"
                    value={formAccion.referencia}
                    onChange={(e) => setFormAccion({ ...formAccion, referencia: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    placeholder="Nº transferencia, etc."
                  />
                </div>
              )}
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalAccion(null)}
                  disabled={saving}
                  className="py-2.5 px-4 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
