'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import Link from 'next/link';
import {
  listCuentasFondo,
  listCuentasActivas,
  listMovimientosFondo,
  createMovimientoFondo,
  deleteMovimientoFondo,
  getFlujoFondosKPIs,
  agregarMovimientosPorMes,
  agregarMovimientosPorCategoria,
  agregarSaldosPorCuenta,
  agregarMovimientosParaTimeline,
  createOperacionCambioDivisas,
} from '@/services/flujoFondosService';
import type { FlujoFondosKPIs } from '@/services/flujoFondosService';
import { listInversores } from '@/services/inversorService';
import { listCajasChica, listMovimientosCaja, listMovimientosCajaPorPeriodo, deleteMovimientoCaja } from '@/services/cajaChicaService';
import type { CuentaFondo, MovimientoFondo } from '@/types/flujoFondos';
import type { CajaChica, MovimientoCaja } from '@/types/cajaChica';
import type { Inversor } from '@/types/inversor';
import {
  CATEGORIAS_INGRESO,
  CATEGORIAS_EGRESO_OPERATIVO,
  CATEGORIAS_EGRESO_SUBCAJA,
  CATEGORIAS_EGRESO_FINANCIERO,
} from '@/types/flujoFondos';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type TipoMovForm = 'entrada' | 'salida' | 'transferencia';

export default function FlujoFondosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermiso, canVerModulo, getCajasChicaPermitidas } = usePermisos();
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [cuentas, setCuentas] = useState<CuentaFondo[]>([]);
  const [cuentasActivas, setCuentasActivas] = useState<CuentaFondo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMov, setModalMov] = useState<TipoMovForm | null>(null);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaFondo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoFondo[]>([]);
  const [formMov, setFormMov] = useState<Partial<MovimientoFondo>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState<FlujoFondosKPIs | null>(null);
  const [movimientosPeriodo, setMovimientosPeriodo] = useState<MovimientoFondo[]>([]);
  const [movimientosCajaPeriodo, setMovimientosCajaPeriodo] = useState<MovimientoCaja[]>([]);
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'año'>('mes');
  const [cajasExpandido, setCajasExpandido] = useState(false);
  const [flujoExpandido, setFlujoExpandido] = useState(true);
  const [cajas, setCajas] = useState<CajaChica[]>([]);
  const [cajaSeleccionada, setCajaSeleccionada] = useState<CajaChica | null>(null);
  const [movimientosCaja, setMovimientosCaja] = useState<MovimientoCaja[]>([]);
  const [modalCambioDivisas, setModalCambioDivisas] = useState<'compra_usd' | 'venta_usd' | null>(null);
  const [formCambio, setFormCambio] = useState({
    cuentaOrigenId: '',
    cuentaDestinoId: '',
    montoOrigen: 0,
    montoDestino: 0,
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
  });

  const getRangoFechas = () => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    const desde = new Date(hoy);

    if (periodoFiltro === 'hoy') {
      return { desde: hoyStr, hasta: hoyStr };
    }
    if (periodoFiltro === 'semana') {
      desde.setDate(desde.getDate() - 6);
      return { desde: desde.toISOString().slice(0, 10), hasta: hoyStr };
    }
    if (periodoFiltro === 'mes') {
      desde.setDate(desde.getDate() - 29);
      return { desde: desde.toISOString().slice(0, 10), hasta: hoyStr };
    }
    if (periodoFiltro === 'trimestre') {
      desde.setMonth(desde.getMonth() - 3);
      return { desde: desde.toISOString().slice(0, 10), hasta: hoyStr };
    }
    if (periodoFiltro === 'semestre') {
      desde.setMonth(desde.getMonth() - 6);
      return { desde: desde.toISOString().slice(0, 10), hasta: hoyStr };
    }
    // año
    desde.setFullYear(desde.getFullYear() - 1);
    return { desde: desde.toISOString().slice(0, 10), hasta: hoyStr };
  };

  const loadCuentas = async () => {
    setLoading(true);
    try {
      const [inv, all, activas, cajasData] = await Promise.all([
        listInversores(),
        listCuentasFondo(),
        listCuentasActivas(),
        canVerModulo('caja_chica') ? listCajasChica() : Promise.resolve([]),
      ]);
      setInversores(inv);
      setCuentas(all);
      setCuentasActivas(activas);
      setCajas(cajasData);
      setCajaSeleccionada((prev) => (prev?.id ? cajasData.find((c) => c.id === prev.id) ?? prev : prev));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadMovimientos = async () => {
    if (!cuentaSeleccionada?.id) return;
    try {
      const data = await listMovimientosFondo({
        cuentaOrigenId: cuentaSeleccionada.id,
      });
      const dataDest = await listMovimientosFondo({
        cuentaDestinoId: cuentaSeleccionada.id,
      });
      const merged = [...data, ...dataDest].sort(
        (a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')
      );
      const seen = new Set<string>();
      setMovimientos(merged.filter((m) => {
        if (!m.id) return true;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }));
    } catch {
      setMovimientos([]);
    }
  };

  const loadStats = async () => {
    try {
      const { desde, hasta } = getRangoFechas();
      const [movs, movsCaja] = await Promise.all([
        listMovimientosFondo({ desde, hasta }),
        canVerModulo('caja_chica') ? listMovimientosCajaPorPeriodo(cajas, desde, hasta) : Promise.resolve([]),
      ]);
      setMovimientosPeriodo(movs);
      setMovimientosCajaPeriodo(movsCaja);
    } catch {
      setMovimientosPeriodo([]);
      setMovimientosCajaPeriodo([]);
    }
  };

  useEffect(() => {
    if (!canVerModulo('flujo_fondos')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    loadCuentas();
  }, []);

  // Al llegar con ?cuentaId=xxx (ej. desde dashboard del inversor), seleccionar esa cuenta y expandir
  useEffect(() => {
    if (!router.isReady || !cuentas.length) return;
    const cuentaId = typeof router.query.cuentaId === 'string' ? router.query.cuentaId.trim() : '';
    if (cuentaId) {
      const c = cuentas.find((x) => x.id === cuentaId);
      if (c) setCuentaSeleccionada(c);
    }
  }, [router.isReady, router.query.cuentaId, cuentas]);

  useEffect(() => {
    loadStats();
  }, [periodoFiltro, cajas.length]);

  useEffect(() => {
    if (cuentas.length > 0 || movimientosPeriodo.length > 0 || movimientosCajaPeriodo.length > 0) {
      getFlujoFondosKPIs(cuentas, movimientosPeriodo, movimientosCajaPeriodo).then(setKpis);
    } else {
      setKpis(null);
    }
  }, [cuentas, movimientosPeriodo, movimientosCajaPeriodo]);

  useEffect(() => {
    loadMovimientos();
  }, [cuentaSeleccionada?.id]);

  const loadMovimientosCaja = async () => {
    if (!cajaSeleccionada?.id) return;
    try {
      const data = await listMovimientosCaja(cajaSeleccionada.id);
      setMovimientosCaja(data);
    } catch {
      setMovimientosCaja([]);
    }
  };

  useEffect(() => {
    if (cajaSeleccionada?.id) {
      loadMovimientosCaja();
    } else {
      setMovimientosCaja([]);
    }
  }, [cajaSeleccionada?.id]);

  const abrirMov = (tipo: TipoMovForm, cuenta?: CuentaFondo, categoriaPredefinida?: string) => {
    const c = cuenta ?? cuentaSeleccionada;
    const ahora = new Date().toISOString().slice(0, 10);
    const monedaBase = c?.moneda ?? 'ARS';
    if (tipo === 'entrada') {
      setFormMov({
        cuentaDestinoId: c?.id ?? '',
        cuentaOrigenId: null,
        monto: 0,
        moneda: monedaBase,
        fecha: ahora,
        categoria: categoriaPredefinida ?? 'Cobranza clientes',
        descripcion: '',
      });
    } else if (tipo === 'salida') {
      setFormMov({
        cuentaOrigenId: c?.id ?? '',
        cuentaDestinoId: null,
        monto: 0,
        moneda: monedaBase,
        fecha: ahora,
        categoria: categoriaPredefinida ?? 'Proveedores / Mercadería',
        descripcion: '',
      });
    } else {
      setFormMov({
        cuentaOrigenId: c?.id ?? '',
        cuentaDestinoId: c?.id ? '' : undefined,
        monto: 0,
        moneda: monedaBase,
        fecha: ahora,
        categoria: categoriaPredefinida ?? 'Transferencia entre cuentas',
        descripcion: '',
      });
    }
    if (c) setCuentaSeleccionada(c);
    setModalMov(tipo);
    setError('');
  };

  const cerrarModalMov = () => {
    setModalMov(null);
    setFormMov({});
    setError('');
  };

  const handleSubmitMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!hasPermiso('flujo_fondos', 'crear')) return;
    if (!formMov.monto || formMov.monto <= 0) {
      setError('Monto debe ser mayor a 0');
      toast.error('Monto debe ser mayor a 0');
      return;
    }
    if (modalMov === 'entrada' && !formMov.cuentaDestinoId?.trim()) {
      setError('Seleccioná la cuenta destino');
      toast.error('Seleccioná la cuenta destino');
      return;
    }
    if (modalMov === 'salida' && !formMov.cuentaOrigenId?.trim()) {
      setError('Seleccioná la cuenta origen');
      toast.error('Seleccioná la cuenta origen');
      return;
    }
    if (modalMov === 'transferencia') {
      if (!formMov.cuentaDestinoId?.trim()) {
        setError('Seleccioná cuenta destino');
        toast.error('Seleccioná cuenta destino');
        return;
      }
      if (formMov.cuentaOrigenId === formMov.cuentaDestinoId) {
        setError('Origen y destino no pueden ser la misma cuenta');
        toast.error('Origen y destino no pueden ser la misma cuenta');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await createMovimientoFondo(
        {
          cuentaOrigenId: formMov.cuentaOrigenId || undefined,
          cuentaDestinoId: formMov.cuentaDestinoId || undefined,
          monto: Number(formMov.monto),
          moneda: formMov.moneda ?? 'ARS',
          fecha: formMov.fecha ?? new Date().toISOString().slice(0, 10),
          categoria: formMov.categoria ?? 'Otros operativos',
          descripcion: formMov.descripcion?.trim() || undefined,
          referencia: formMov.referencia?.trim() || undefined,
        },
        user?.uid
      );
      toast.success('Movimiento registrado');
      cerrarModalMov();
      loadCuentas();
      loadMovimientos();
      loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMov = async (m: MovimientoFondo) => {
    if (!m.id) return;
    if (!hasPermiso('flujo_fondos', 'eliminar')) return;
    if (!confirm('¿Eliminar este movimiento?')) return;
    try {
      await deleteMovimientoFondo(m.id, m, user?.uid);
      toast.success('Movimiento eliminado');
      loadCuentas();
      loadMovimientos();
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleDeleteMovCaja = async (m: MovimientoCaja) => {
    if (!m.id || !cajaSeleccionada?.id) return;
    if (!hasPermiso('caja_chica', 'eliminar')) return;
    if (!confirm('¿Eliminar este movimiento de la caja?')) return;
    try {
      await deleteMovimientoCaja(m.id, cajaSeleccionada.id, user?.uid);
      toast.success('Movimiento eliminado');
      loadCuentas();
      loadMovimientosCaja();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const formatMonto = (n: number, moneda: string) =>
    `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR') : '0'}`;

  const handleSubmitCambioDivisas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCambioDivisas || saving) return;
    if (!formCambio.cuentaOrigenId || !formCambio.cuentaDestinoId) {
      toast.error('Seleccioná ambas cuentas');
      return;
    }
    if (formCambio.montoOrigen <= 0 || formCambio.montoDestino <= 0) {
      toast.error('Los montos deben ser mayores a 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createOperacionCambioDivisas(
        {
          tipo: modalCambioDivisas,
          cuentaOrigenId: formCambio.cuentaOrigenId,
          cuentaDestinoId: formCambio.cuentaDestinoId,
          montoOrigen: formCambio.montoOrigen,
          montoDestino: formCambio.montoDestino,
          fecha: formCambio.fecha,
          descripcion: formCambio.descripcion.trim() || undefined,
        },
        user?.uid
      );
      toast.success(modalCambioDivisas === 'compra_usd' ? 'Compra de USD registrada' : 'Venta de USD registrada');
      setModalCambioDivisas(null);
      loadCuentas();
      loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const { desde: rangoDesde, hasta: rangoHasta } = getRangoFechas();
  const chartTimeline = agregarMovimientosParaTimeline(
    movimientosPeriodo,
    movimientosCajaPeriodo,
    periodoFiltro,
    rangoDesde,
    rangoHasta
  );
  const chartMensual = agregarMovimientosPorMes(movimientosPeriodo, movimientosCajaPeriodo);
  const chartCategorias = agregarMovimientosPorCategoria(movimientosPeriodo, movimientosCajaPeriodo);
  const chartCategoriasPie = chartCategorias.flatMap((r) => {
    const out: { categoria: string; monto: number; moneda: string }[] = [];
    const ars = r.montoARS ?? 0;
    const usd = r.montoUSD ?? 0;
    if (ars !== 0) out.push({ categoria: `${r.categoria} (ARS)`, monto: ars, moneda: 'ARS' });
    if (usd !== 0) out.push({ categoria: `${r.categoria} (USD)`, monto: usd, moneda: 'USD' });
    return out;
  });
  const chartCuentas = agregarSaldosPorCuenta(cuentas);
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  const chartIngresosEgresos = chartTimeline.length !== 0
    ? [
        { name: 'Ingresos', value: chartTimeline.reduce((s, r) => s + (r.ingresos ?? 0), 0), color: '#22c55e' },
        { name: 'Egresos', value: chartTimeline.reduce((s, r) => s + (r.egresos ?? 0), 0), color: '#f59e0b' },
      ].filter((d) => d.value !== 0)
    : [];

  const permitidas = getCajasChicaPermitidas();
  const cajasFiltradas = permitidas === null ? cajas : cajas.filter((c) => c.id && permitidas.includes(c.id));

  const cuentasARS = cuentasActivas.filter((c) => (c.moneda ?? 'ARS') === 'ARS');
  const cuentasUSD = cuentasActivas.filter((c) => (c.moneda ?? '') === 'USD');

  const abrirCambioDivisas = (tipo: 'compra_usd' | 'venta_usd') => {
    setModalCambioDivisas(tipo);
    setFormCambio({
      cuentaOrigenId: tipo === 'compra_usd' ? (cuentasARS[0]?.id ?? '') : (cuentasUSD[0]?.id ?? ''),
      cuentaDestinoId: tipo === 'compra_usd' ? (cuentasUSD[0]?.id ?? '') : (cuentasARS[0]?.id ?? ''),
      montoOrigen: 0,
      montoDestino: 0,
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: '',
    });
    setError('');
  };

  return (
    <AdminLayout title="Flujo de fondos" backHref="/admin/dashboard" backLabel="Dashboard">
      <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-slate-600">Período:</label>
          <select
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value as 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'año')}
            className="px-3 py-2 border border-slate-400 rounded-xl bg-slate-50 text-sm"
          >
            <option value="hoy">Hoy</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
            <option value="trimestre">Trimestre</option>
            <option value="semestre">Semestre</option>
            <option value="año">Año</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasPermiso('flujo_fondos', 'crear') && (
            <>
              <button
                onClick={() => abrirMov('entrada', undefined)}
                disabled={loading || cuentasActivas.length === 0}
                className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold transition shadow-sm touch-manipulation flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span> Cargar movimiento
              </button>
              <Link
                href="/admin/cuentas"
                className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-slate-100 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-200 text-sm font-medium transition touch-manipulation inline-flex items-center justify-center"
              >
                Gestionar cuentas
              </Link>
              {cuentasARS.length > 0 && cuentasUSD.length > 0 && (
                <>
                  <button
                    onClick={() => abrirCambioDivisas('compra_usd')}
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-violet-100 text-violet-700 border border-violet-300 rounded-xl hover:bg-violet-200 disabled:opacity-60 text-sm font-medium transition touch-manipulation"
                  >
                    Compra USD
                  </button>
                  <button
                    onClick={() => abrirCambioDivisas('venta_usd')}
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-xl hover:bg-indigo-200 disabled:opacity-60 text-sm font-medium transition touch-manipulation"
                  >
                    Venta USD
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>

      <div className="card-seccion p-3 text-sm text-slate-600">
        <strong className="text-slate-700">Flujo de fondos:</strong> Saldo inicial + Ingresos (cobranzas, aportes) − Egresos operativos (proveedores, sueldos, impuestos) − Rendiciones sub-cajas = Flujo neto. Seleccioná una cuenta y usá <strong>+ Entrada</strong> o <strong>- Salida</strong> para registrar.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="card-kpi-blue p-4">
          <p className="text-slate-500 text-xs font-medium uppercase">Total saldos ARS</p>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {kpis ? formatMonto(kpis.totalSaldos, 'ARS') : '—'}
          </p>
        </div>
        <div className="card-kpi-blue p-4">
          <p className="text-slate-500 text-xs font-medium uppercase">Total saldos USD</p>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {kpis ? formatMonto(kpis.totalSaldosUSD, 'USD') : '—'}
          </p>
        </div>
        <div className="card-kpi-emerald p-4">
          <p className="text-slate-500 text-xs font-medium uppercase">Ingresos (período)</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">
            {kpis ? formatMonto(kpis.ingresosPeriodo, 'ARS') : '—'}
          </p>
        </div>
        <div className="card-kpi-slate p-4">
          <p className="text-slate-500 text-xs font-medium uppercase">Egresos (período)</p>
          <p className="text-xl font-bold text-amber-700 mt-1">
            {kpis ? formatMonto(kpis.egresosPeriodo, 'ARS') : '—'}
          </p>
        </div>
        <div className="card-kpi-slate p-4">
          <p className="text-slate-500 text-xs font-medium uppercase">Cuentas / Movimientos</p>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {kpis ? `${kpis.cantCuentasActivas} / ${kpis.cantMovimientosPeriodo}` : '—'}
          </p>
        </div>
      </div>

      {/* Timeline horizontal - flujo en el tiempo (responde al selector de período) */}
      {chartTimeline.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 text-sm lg:text-base">
              Flujo de fondos en el tiempo{periodoFiltro === 'hoy' ? ' (hoy)' : periodoFiltro === 'semana' ? ' (semana)' : periodoFiltro === 'mes' ? ' (mes)' : periodoFiltro === 'trimestre' ? ' (trimestre)' : periodoFiltro === 'semestre' ? ' (semestre)' : ' (año)'}
            </h2>
          </div>
          <div className="p-4 sm:p-6 overflow-x-auto">
            <div className="flex flex-nowrap gap-0 min-w-max" style={{ minWidth: Math.max(480, chartTimeline.length * 110) }}>
              {chartTimeline.map((item, i) => {
                const abajo = i % 2 === 1;
                const color = ['#f97316', '#14b8a6', '#eab308', '#0d9488', '#64748b'][i % 5];
                const fmt = (n: number) =>
                  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
                return (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-[90px]">
                    {/* Contenido arriba */}
                    <div className="h-14 flex flex-col items-center justify-end">
                      {abajo ? (
                        <span className="font-bold text-base" style={{ color }}>{item.mesCorto}</span>
                      ) : (
                        <p className="text-xs text-slate-600 text-center px-1 line-clamp-2">Ing {fmt(item.ingresos ?? 0)} · Egr {fmt(item.egresos ?? 0)}</p>
                      )}
                    </div>
                    <div className="w-px h-2 bg-slate-300" />
                    {/* Círculo + barra (cada segmento aporta su parte de la barra) */}
                    <div
                      className="w-full h-2 flex items-center justify-center relative"
                      style={{ backgroundColor: color }}
                    >
                      <div className="absolute w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white shadow-sm" style={{ borderColor: color }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="w-px h-2 bg-slate-300" />
                    {/* Contenido abajo */}
                    <div className="h-14 flex flex-col items-center justify-start pt-1">
                      {abajo ? (
                        <>
                          <p className="text-xs text-slate-600 text-center px-1 line-clamp-2">Ing {fmt(item.ingresos ?? 0)} · Egr {fmt(item.egresos ?? 0)}</p>
                          <span className="text-xs text-slate-500 mt-0.5">Neto: {fmt(item.neto ?? 0)}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-base" style={{ color }}>{item.mesCorto}</span>
                          <span className="text-xs text-slate-500 mt-0.5">Neto: {fmt(item.neto ?? 0)}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 justify-center pt-4 mt-2 border-t border-slate-200 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Ingresos</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Egresos</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> Neto</span>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos - 3 en una sola fila */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 text-sm lg:text-base">Ingresos vs Egresos (período)</h2>
          </div>
          <div className="p-4 h-64">
            {chartIngresosEgresos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartIngresosEgresos}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                  >
                    {chartIngresosEgresos.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString('es-AR')} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'Ingresos' ? 'Ing' : 'Egr')} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sin datos en el período</div>
            )}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 text-sm lg:text-base">Saldos por cuenta</h2>
          </div>
          <div className="p-4 h-64">
            {chartCuentas.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartCuentas}
                    dataKey="saldo"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ nombre, saldo }) => `${(nombre?.length ?? 0) > 10 ? (nombre ?? '').slice(0, 9) + '…' : nombre}: ${saldo.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                  >
                    {chartCuentas.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString('es-AR')} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => ((v?.length ?? 0) > 12 ? (v ?? '').slice(0, 11) + '…' : v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sin cuentas con saldo</div>
            )}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 text-sm lg:text-base">Por categoría</h2>
          </div>
          <div className="p-4 h-64">
            {chartCategoriasPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartCategoriasPie}
                    dataKey="monto"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ categoria, monto }) => `${(categoria?.length ?? 0) > 15 ? (categoria ?? '').slice(0, 14) + '…' : categoria}: ${monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                  >
                    {chartCategoriasPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString('es-AR')} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => {
                      const s = String(v).replace(/ \(ARS\)$| \(USD\)$/i, '').replace(/^Caja: /, '');
                      return s.length > 14 ? s.slice(0, 13) + '…' : s;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sin movimientos en el período</div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabla del flujo - principal, visible siempre */}
          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setFlujoExpandido(!flujoExpandido)}
              className="card-header w-full flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/50 transition-colors"
            >
              <h2 className="font-semibold text-slate-800">Flujo del período</h2>
              <span className="text-slate-500">{flujoExpandido ? '▼' : '▶'}</span>
            </button>
            {flujoExpandido && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Concepto</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700 min-w-[100px]">ARS</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700 min-w-[100px]">USD</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis && (
                      <>
                        <tr className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-slate-700">Saldo inicial</td>
                          <td className="py-3 px-4 text-right font-medium">{(kpis.totalSaldos - kpis.netoPeriodoARS).toLocaleString('es-AR')}</td>
                          <td className="py-3 px-4 text-right font-medium">{(kpis.totalSaldosUSD - kpis.netoPeriodoUSD).toLocaleString('es-AR')}</td>
                          <td className="py-3 px-4"></td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-emerald-50/50">
                          <td className="py-2 px-4 font-medium text-emerald-800">+ Ingresos</td>
                          <td className="py-2 px-4 text-right font-medium text-emerald-700">{kpis.ingresosPeriodoARS.toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4 text-right font-medium text-emerald-700">{kpis.ingresosPeriodoUSD.toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4">
                            {hasPermiso('flujo_fondos', 'crear') && (
                              <button type="button" onClick={() => abrirMov('entrada')} className="text-xs text-emerald-600 hover:underline">+ cargar</button>
                            )}
                          </td>
                        </tr>
                        {chartCategorias.filter((r) => CATEGORIAS_INGRESO.includes(r.categoria)).map((r) => (
                          <tr key={r.categoria} className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => hasPermiso('flujo_fondos', 'crear') && abrirMov('entrada', undefined, r.categoria)}>
                            <td className="py-2 px-4 pl-8 text-slate-600">· {r.categoria}</td>
                            <td className="py-2 px-4 text-right">{(r.montoARS ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4 text-right">{(r.montoUSD ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4"></td>
                          </tr>
                        ))}
                        {chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'ingreso').length > 0 && (
                          <>
                            <tr className="border-b border-slate-200 bg-emerald-50/30">
                              <td className="py-2 px-4 font-medium text-emerald-700">+ Ingresos caja</td>
                              <td className="py-2 px-4 text-right font-medium text-emerald-600">
                                {chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'ingreso').reduce((s, r) => s + (r.montoARS ?? 0), 0).toLocaleString('es-AR')}
                              </td>
                              <td className="py-2 px-4 text-right font-medium text-emerald-600">
                                {chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'ingreso').reduce((s, r) => s + (r.montoUSD ?? 0), 0).toLocaleString('es-AR')}
                              </td>
                              <td className="py-2 px-4"></td>
                            </tr>
                            {chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'ingreso').map((r) => (
                              <tr key={r.categoria} className="border-b border-slate-100 hover:bg-slate-50/80">
                                <td className="py-2 px-4 pl-8 text-slate-600">· {r.categoria.replace('Caja: ', '')}</td>
                                <td className="py-2 px-4 text-right">{(r.montoARS ?? 0).toLocaleString('es-AR')}</td>
                                <td className="py-2 px-4 text-right">{(r.montoUSD ?? 0).toLocaleString('es-AR')}</td>
                                <td className="py-2 px-4"></td>
                              </tr>
                            ))}
                          </>
                        )}
                        <tr className="border-b border-slate-200 bg-amber-50/50">
                          <td className="py-2 px-4 font-medium text-amber-800">− Egresos operativos</td>
                          <td className="py-2 px-4 text-right font-medium text-amber-700">{chartCategorias.filter((r) => CATEGORIAS_EGRESO_OPERATIVO.includes(r.categoria)).reduce((s, r) => s + (r.montoARS ?? 0), 0).toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4 text-right font-medium text-amber-700">{chartCategorias.filter((r) => CATEGORIAS_EGRESO_OPERATIVO.includes(r.categoria)).reduce((s, r) => s + (r.montoUSD ?? 0), 0).toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4">
                            {hasPermiso('flujo_fondos', 'crear') && <button type="button" onClick={() => abrirMov('salida')} className="text-xs text-amber-600 hover:underline">+ cargar</button>}
                          </td>
                        </tr>
                        {chartCategorias.filter((r) => CATEGORIAS_EGRESO_OPERATIVO.includes(r.categoria)).map((r) => (
                          <tr key={r.categoria} className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => hasPermiso('flujo_fondos', 'crear') && abrirMov('salida', undefined, r.categoria)}>
                            <td className="py-2 px-4 pl-8 text-slate-600">· {r.categoria}</td>
                            <td className="py-2 px-4 text-right">{(r.montoARS ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4 text-right">{(r.montoUSD ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4"></td>
                          </tr>
                        ))}
                        <tr className="border-b border-slate-200 bg-amber-50/30">
                          <td className="py-2 px-4 font-medium text-amber-700">− Sub-cajas</td>
                          <td className="py-2 px-4 text-right font-medium text-amber-600">{chartCategorias.filter((r) => CATEGORIAS_EGRESO_SUBCAJA.includes(r.categoria)).reduce((s, r) => s + (r.montoARS ?? 0), 0).toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4 text-right font-medium text-amber-600">{chartCategorias.filter((r) => CATEGORIAS_EGRESO_SUBCAJA.includes(r.categoria)).reduce((s, r) => s + (r.montoUSD ?? 0), 0).toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4">
                            {hasPermiso('flujo_fondos', 'crear') && <button type="button" onClick={() => abrirMov('salida')} className="text-xs text-amber-600 hover:underline">+ cargar</button>}
                          </td>
                        </tr>
                        {chartCategorias.filter((r) => CATEGORIAS_EGRESO_SUBCAJA.includes(r.categoria)).map((r) => (
                          <tr key={r.categoria} className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => hasPermiso('flujo_fondos', 'crear') && abrirMov('salida', undefined, r.categoria)}>
                            <td className="py-2 px-4 pl-8 text-slate-600">· {r.categoria}</td>
                            <td className="py-2 px-4 text-right">{(r.montoARS ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4 text-right">{(r.montoUSD ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4"></td>
                          </tr>
                        ))}
                        <tr className="border-b border-slate-200 bg-slate-100/50">
                          <td className="py-2 px-4 font-medium text-slate-700">− Financiero</td>
                          <td className="py-2 px-4 text-right font-medium text-slate-600">{chartCategorias.filter((r) => CATEGORIAS_EGRESO_FINANCIERO.includes(r.categoria)).reduce((s, r) => s + (r.montoARS ?? 0), 0).toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4 text-right font-medium text-slate-600">{chartCategorias.filter((r) => CATEGORIAS_EGRESO_FINANCIERO.includes(r.categoria)).reduce((s, r) => s + (r.montoUSD ?? 0), 0).toLocaleString('es-AR')}</td>
                          <td className="py-2 px-4"></td>
                        </tr>
                        {chartCategorias.filter((r) => CATEGORIAS_EGRESO_FINANCIERO.includes(r.categoria)).map((r) => (
                          <tr key={r.categoria} className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => hasPermiso('flujo_fondos', 'crear') && abrirMov('salida', undefined, r.categoria)}>
                            <td className="py-2 px-4 pl-8 text-slate-600">· {r.categoria}</td>
                            <td className="py-2 px-4 text-right">{(r.montoARS ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4 text-right">{(r.montoUSD ?? 0).toLocaleString('es-AR')}</td>
                            <td className="py-2 px-4"></td>
                          </tr>
                        ))}
                        {chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'egreso').length > 0 && (
                          <>
                            <tr className="border-b border-slate-200 bg-amber-50/20">
                              <td className="py-2 px-4 font-medium text-amber-600">− Egresos caja</td>
                              <td className="py-2 px-4 text-right font-medium text-amber-600">{chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'egreso').reduce((s, r) => s + (r.montoARS ?? 0), 0).toLocaleString('es-AR')}</td>
                              <td className="py-2 px-4 text-right font-medium text-amber-600">{chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'egreso').reduce((s, r) => s + (r.montoUSD ?? 0), 0).toLocaleString('es-AR')}</td>
                              <td className="py-2 px-4"></td>
                            </tr>
                            {chartCategorias.filter((r) => r.categoria.startsWith('Caja:') && r.tipo === 'egreso').map((r) => (
                              <tr key={r.categoria} className="border-b border-slate-100 hover:bg-slate-50/80">
                                <td className="py-2 px-4 pl-8 text-slate-600">· {r.categoria.replace('Caja: ', '')}</td>
                                <td className="py-2 px-4 text-right">{(r.montoARS ?? 0).toLocaleString('es-AR')}</td>
                                <td className="py-2 px-4 text-right">{(r.montoUSD ?? 0).toLocaleString('es-AR')}</td>
                                <td className="py-2 px-4"></td>
                              </tr>
                            ))}
                          </>
                        )}
                        <tr className="bg-blue-50 font-semibold">
                          <td className="py-3 px-4 text-slate-800">Flujo neto</td>
                          <td className="py-3 px-4 text-right">
                            <span className={(kpis.netoPeriodoARS ?? 0) >= 0 ? 'text-emerald-700' : 'text-amber-700'}>{kpis.netoPeriodoARS.toLocaleString('es-AR')}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={(kpis.netoPeriodoUSD ?? 0) >= 0 ? 'text-emerald-700' : 'text-amber-700'}>{kpis.netoPeriodoUSD.toLocaleString('es-AR')}</span>
                          </td>
                          <td className="py-3 px-4"></td>
                        </tr>
                        <tr className="bg-slate-100 font-semibold">
                          <td className="py-3 px-4 text-slate-800">Saldo final</td>
                          <td className="py-3 px-4 text-right text-slate-800">{kpis.totalSaldos.toLocaleString('es-AR')}</td>
                          <td className="py-3 px-4 text-right text-slate-800">{kpis.totalSaldosUSD.toLocaleString('es-AR')}</td>
                          <td className="py-3 px-4"></td>
                        </tr>
                      </>
                    )}
                    {!kpis && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">Sin datos en el período</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selector de cuenta para ver movimientos */}
          <div className="card overflow-hidden">
            <div className="card-header flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-800">Cuenta para movimientos</h2>
              <Link
                href="/admin/cuentas"
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Gestionar cuentas →
              </Link>
            </div>
            <div className="p-4 space-y-2">
              <select
                value={cuentaSeleccionada?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  const c = cuentas.find((x) => x.id === id) ?? null;
                  setCuentaSeleccionada(c);
                  setCajaSeleccionada(null);
                }}
                className="w-full max-w-md px-4 py-2 border border-slate-400 rounded-xl bg-slate-50 text-sm"
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentas.filter((c) => c.activa !== false).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')}
                  </option>
                ))}
              </select>
              {cuentaSeleccionada && hasPermiso('flujo_fondos', 'crear') && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => abrirMov('entrada', cuentaSeleccionada)} className="py-1.5 px-2.5 text-xs font-medium text-emerald-700 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 rounded-md">+ Entrada</button>
                  <button onClick={() => abrirMov('salida', cuentaSeleccionada)} className="py-1.5 px-2.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-md">− Salida</button>
                  <button onClick={() => abrirMov('transferencia', cuentaSeleccionada)} className="py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-slate-200 border border-slate-400 hover:bg-slate-300 rounded-md">Transferir</button>
                </div>
              )}
            </div>
          </div>

          {/* Cajas chica - colapsables */}
          {canVerModulo('caja_chica') && (
            <div className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setCajasExpandido(!cajasExpandido)}
                className="card-header w-full flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/50 transition-colors"
              >
                <h2 className="font-semibold text-slate-800">Cajas chica</h2>
                <span className="text-slate-500 text-lg">{cajasExpandido ? '▼' : '▶'}</span>
              </button>
              {cajasExpandido && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-50">
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Caja</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Nivel</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cajasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-500">No hay cajas chica</td>
                        </tr>
                      ) : (
                        cajasFiltradas.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => { setCajaSeleccionada(c); setCuentaSeleccionada(null); }}
                            className={`border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors ${
                              cajaSeleccionada?.id === c.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-medium text-slate-800">{c.nombre}</td>
                            <td className="py-3 px-4 text-slate-600">{(c.nivel ?? 'sub_caja') === 'central' ? 'Central' : 'Sub-caja'}</td>
                            <td className="py-3 px-4 text-right font-medium">{formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Movimientos de cuenta o caja seleccionada */}
          {cuentaSeleccionada && (
            <div className="card overflow-hidden">
              <div className="card-header flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-800">Movimientos — {cuentaSeleccionada.nombre}</h2>
                <p className="text-sm text-slate-600">
                  Saldo: {formatMonto(cuentaSeleccionada.saldoActual ?? 0, cuentaSeleccionada.moneda ?? 'ARS')}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Concepto</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Categoría</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Monto</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">Sin movimientos en esta cuenta</td>
                      </tr>
                    ) : (
                      movimientos.map((m) => {
                        const esEntrada = m.cuentaDestinoId === cuentaSeleccionada.id && m.cuentaOrigenId !== cuentaSeleccionada.id;
                        const signo = esEntrada ? '+' : '−';
                        return (
                          <tr key={m.id} className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-4 text-slate-600">{m.fecha}</td>
                            <td className="py-2 px-4">{m.descripcion || '—'}</td>
                            <td className="py-2 px-4">
                              <span className="text-xs px-2 py-0.5 bg-slate-200 rounded">{m.categoria}</span>
                            </td>
                            <td className={`py-2 px-4 text-right font-medium ${esEntrada ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {signo} {formatMonto(m.monto, m.moneda ?? 'ARS')}
                            </td>
                            <td className="py-2 px-4">
                              {hasPermiso('flujo_fondos', 'eliminar') && (
                                <button onClick={() => handleDeleteMov(m)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {cajaSeleccionada && (
            <div className="card overflow-hidden">
              <div className="card-header flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-800">Movimientos — {cajaSeleccionada.nombre}</h2>
                <p className="text-sm text-slate-600">
                  Saldo: {formatMonto(cajaSeleccionada.saldoActual ?? 0, cajaSeleccionada.moneda ?? 'ARS')}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Concepto</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Categoría</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Monto</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosCaja.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">Sin movimientos en esta caja</td>
                      </tr>
                    ) : (
                      movimientosCaja.map((m) => {
                        const esIngreso = m.tipo === 'ingreso';
                        const signo = esIngreso ? '+' : '−';
                        return (
                          <tr key={m.id} className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-4 text-slate-600">{m.fecha}</td>
                            <td className="py-2 px-4">{m.descripcion || '—'}</td>
                            <td className="py-2 px-4">
                              <span className="text-xs px-2 py-0.5 bg-slate-200 rounded">{m.categoria}</span>
                            </td>
                            <td className={`py-2 px-4 text-right font-medium ${esIngreso ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {signo} {formatMonto(m.monto, m.moneda ?? 'ARS')}
                            </td>
                            <td className="py-2 px-4">
                              {hasPermiso('caja_chica', 'eliminar') && (
                                <button onClick={() => handleDeleteMovCaja(m)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal compra/venta divisas */}
      {modalCambioDivisas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && setModalCambioDivisas(null)}>
          <div className="card w-full max-w-md p-4 sm:p-6 my-4 border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modalCambioDivisas === 'compra_usd' ? 'Compra de USD' : 'Venta de USD'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {modalCambioDivisas === 'compra_usd'
                ? 'ARS sale de la cuenta origen, USD entra a la cuenta destino.'
                : 'USD sale de la cuenta origen, ARS entra a la cuenta destino.'}
            </p>
            <form onSubmit={handleSubmitCambioDivisas} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cuenta origen ({modalCambioDivisas === 'compra_usd' ? 'ARS' : 'USD'}) *
                </label>
                <select
                  value={formCambio.cuentaOrigenId}
                  onChange={(e) => setFormCambio({ ...formCambio, cuentaOrigenId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {(modalCambioDivisas === 'compra_usd' ? cuentasARS : cuentasUSD).map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cuenta destino ({modalCambioDivisas === 'compra_usd' ? 'USD' : 'ARS'}) *
                </label>
                <select
                  value={formCambio.cuentaDestinoId}
                  onChange={(e) => setFormCambio({ ...formCambio, cuentaDestinoId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {(modalCambioDivisas === 'compra_usd' ? cuentasUSD : cuentasARS).map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto origen ({modalCambioDivisas === 'compra_usd' ? 'ARS' : 'USD'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCambio.montoOrigen || ''}
                    onChange={(e) => setFormCambio({ ...formCambio, montoOrigen: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto destino ({modalCambioDivisas === 'compra_usd' ? 'USD' : 'ARS'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCambio.montoDestino || ''}
                    onChange={(e) => setFormCambio({ ...formCambio, montoDestino: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formCambio.fecha}
                  onChange={(e) => setFormCambio({ ...formCambio, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={formCambio.descripcion}
                  onChange={(e) => setFormCambio({ ...formCambio, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-blue-700 text-white font-medium rounded-xl hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
                <button type="button" onClick={() => setModalCambioDivisas(null)} disabled={saving} className="btn-secondary py-2.5 px-4">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal movimiento */}
      {modalMov && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && cerrarModalMov()}>
          <div className="card w-full max-w-md p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              {modalMov === 'entrada' && '➕ Cargar movimiento (Ingreso)'}
              {modalMov === 'salida' && '➖ Cargar movimiento (Egreso)'}
              {modalMov === 'transferencia' && '↔ Cargar movimiento (Transferencia)'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Elegí cuenta, categoría y monto. El flujo se actualizará al guardar.
            </p>
            <div className="flex gap-2 mb-4">
              {(['entrada', 'salida', 'transferencia'] as TipoMovForm[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => abrirMov(t)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                    modalMov === t
                      ? t === 'entrada'
                        ? 'bg-emerald-600 text-white'
                        : t === 'salida'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t === 'entrada' && '+ Entrada'}
                  {t === 'salida' && '- Salida'}
                  {t === 'transferencia' && '↔ Transfer'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmitMov} className="space-y-4">
              {modalMov === 'entrada' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta destino (donde ingresa) *</label>
                  <select
                    value={formMov.cuentaDestinoId ?? ''}
                    onChange={(e) => {
                      const c = cuentasActivas.find((x) => x.id === e.target.value);
                      setFormMov({ ...formMov, cuentaDestinoId: e.target.value, moneda: c?.moneda ?? 'ARS' });
                    }}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    required
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasActivas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.moneda ?? 'ARS'})</option>
                    ))}
                  </select>
                </div>
              )}
              {modalMov === 'salida' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta origen (donde sale) *</label>
                  <select
                    value={formMov.cuentaOrigenId ?? ''}
                    onChange={(e) => {
                      const c = cuentasActivas.find((x) => x.id === e.target.value);
                      setFormMov({ ...formMov, cuentaOrigenId: e.target.value, moneda: c?.moneda ?? 'ARS' });
                    }}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    required
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasActivas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.moneda ?? 'ARS'})</option>
                    ))}
                  </select>
                </div>
              )}
              {modalMov === 'transferencia' && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta origen *</label>
                    <select
                      value={formMov.cuentaOrigenId ?? ''}
                      onChange={(e) => {
                        const c = cuentasActivas.find((x) => x.id === e.target.value);
                        setFormMov({ ...formMov, cuentaOrigenId: e.target.value, moneda: c?.moneda ?? 'ARS' });
                      }}
                      className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {cuentasActivas.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre} ({c.moneda ?? 'ARS'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta destino *</label>
                    <select
                      value={formMov.cuentaDestinoId ?? ''}
                      onChange={(e) => setFormMov({ ...formMov, cuentaDestinoId: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {cuentasActivas.filter((c) => c.id !== formMov.cuentaOrigenId).map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMov.monto ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, monto: Number(e.target.value) })}
                  className="w-full px-4 py-3 text-lg border border-slate-400 rounded-xl bg-slate-50 font-semibold"
                  placeholder="0,00"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                <select
                  value={formMov.categoria ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, categoria: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                >
                  <option value="">Elegir categoría...</option>
                  <optgroup label="(+) Ingresos">
                    {CATEGORIAS_INGRESO.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                  <optgroup label="(-) Egresos operativos">
                    {CATEGORIAS_EGRESO_OPERATIVO.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                  <optgroup label="(-) Sub-cajas / rendiciones">
                    {CATEGORIAS_EGRESO_SUBCAJA.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                  <optgroup label="(-) Financiero">
                    {CATEGORIAS_EGRESO_FINANCIERO.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-slate-500 mt-1">Flujo: Ingresos → Egresos operativos → Sub-cajas</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formMov.fecha ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={formMov.descripcion ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referencia</label>
                <input
                  type="text"
                  value={formMov.referencia ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, referencia: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  placeholder="Nº operación, factura..."
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-blue-700 text-white font-medium rounded-xl hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
                <button type="button" onClick={cerrarModalMov} disabled={saving} className="btn-secondary py-2.5 px-4">
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
