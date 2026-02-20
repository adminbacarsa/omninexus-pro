'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import {
  listBancos,
  createBanco,
  updateBanco,
  deleteBanco,
  listSaldos,
  upsertSaldo,
  listMovimientos,
  createMovimiento,
  createTransferencia,
  updateMovimiento,
  deleteMovimiento,
  listPlantillas,
  createPlantilla,
  updatePlantilla,
  deletePlantilla,
  generarMovimientoDesdePlantilla,
  listCompromisos,
  createCompromiso,
  updateCompromiso,
  deleteCompromiso,
} from '@/services/libroDiarioService';
import type {
  Banco,
  SaldoDiario,
  Movimiento,
  PlantillaMovimiento,
  Compromiso,
} from '@/types/libroDiario';
import {
  CATEGORIAS_COMPROMISO,
  TIPOS_MOVIMIENTO,
} from '@/types/libroDiario';
import { Bank, Wallet, ListOrdered, FileStack, CalendarCheck, BarChart3, Plus, Pencil, Trash2 } from 'lucide-react';

type TabId = 'bancos' | 'saldos' | 'movimientos' | 'plantillas' | 'compromisos' | 'resumen';

const TABS: { id: TabId; label: string; icon: typeof Bank }[] = [
  { id: 'bancos', label: 'Bancos', icon: Bank },
  { id: 'saldos', label: 'Saldos', icon: Wallet },
  { id: 'movimientos', label: 'Movimientos', icon: ListOrdered },
  { id: 'plantillas', label: 'Plantillas', icon: FileStack },
  { id: 'compromisos', label: 'Compromisos', icon: CalendarCheck },
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
];

const MONEDAS = ['ARS', 'USD'] as const;
const formatMonto = (n: number, moneda: string) =>
  `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0'}`;

export default function LibroDiarioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermiso, canVerModulo } = usePermisos();
  const [tab, setTab] = useState<TabId>('bancos');
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [saldos, setSaldos] = useState<SaldoDiario[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaMovimiento[]>([]);
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalBanco, setModalBanco] = useState<'crear' | 'editar' | null>(null);
  const [modalSaldo, setModalSaldo] = useState(false);
  const [modalMov, setModalMov] = useState<'crear' | 'transferencia' | null>(null);
  const [modalPlantilla, setModalPlantilla] = useState<'crear' | 'editar' | null>(null);
  const [modalCompromiso, setModalCompromiso] = useState<'crear' | 'editar' | null>(null);
  const [formBanco, setFormBanco] = useState<Partial<Banco>>({});
  const [formSaldo, setFormSaldo] = useState<{ bancoId: string; fecha: string; saldo: number }>({ bancoId: '', fecha: new Date().toISOString().slice(0, 10), saldo: 0 });
  const [formMov, setFormMov] = useState<Partial<Movimiento>>({});
  const [formPlantilla, setFormPlantilla] = useState<Partial<PlantillaMovimiento>>({});
  const [formCompromiso, setFormCompromiso] = useState<Partial<Compromiso>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filtroFechaMov, setFiltroFechaMov] = useState(new Date().toISOString().slice(0, 10));
  const [filtroBancoMov, setFiltroBancoMov] = useState('');
  const [mesAnioCompromisos, setMesAnioCompromisos] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [fechaSaldo, setFechaSaldo] = useState(new Date().toISOString().slice(0, 10));
  const [fechaResumen, setFechaResumen] = useState(new Date().toISOString().slice(0, 10));
  const [movimientosResumen, setMovimientosResumen] = useState<Movimiento[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [b, s, m, p, c] = await Promise.all([
        listBancos(),
        listSaldos(),
        listMovimientos({ fechaDesde: filtroFechaMov, fechaHasta: filtroFechaMov }),
        listPlantillas(),
        listCompromisos(mesAnioCompromisos),
      ]);
      setBancos(b);
      setSaldos(s);
      setMovimientos(m);
      setPlantillas(p);
      setCompromisos(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canVerModulo('libro_diario')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab !== 'movimientos') return;
    listMovimientos({
      fechaDesde: filtroFechaMov,
      fechaHasta: filtroFechaMov,
      ...(filtroBancoMov ? { bancoId: filtroBancoMov } : {}),
    }).then(setMovimientos);
  }, [tab, filtroFechaMov, filtroBancoMov]);

  useEffect(() => {
    if (tab !== 'compromisos') return;
    listCompromisos(mesAnioCompromisos).then(setCompromisos);
  }, [tab, mesAnioCompromisos]);

  useEffect(() => {
    if (tab !== 'resumen') return;
    listMovimientos({ fechaDesde: fechaResumen, fechaHasta: fechaResumen }).then(setMovimientosResumen);
  }, [tab, fechaResumen]);

  const bancosActivos = bancos.filter((b) => b.activa !== false);

  // --- Bancos ---
  const abrirCrearBanco = () => {
    setFormBanco({ nombre: '', moneda: 'ARS', activa: true, orden: bancos.length });
    setModalBanco('crear');
    setError('');
  };
  const abrirEditarBanco = (b: Banco) => {
    setFormBanco({ ...b });
    setModalBanco('editar');
    setError('');
  };
  const handleSubmitBanco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !formBanco.nombre?.trim()) return;
    if (modalBanco === 'crear' && !hasPermiso('libro_diario', 'crear')) return;
    if (modalBanco === 'editar' && !hasPermiso('libro_diario', 'editar')) return;
    setSaving(true);
    setError('');
    try {
      if (modalBanco === 'crear') {
        await createBanco({
          nombre: formBanco.nombre.trim(),
          moneda: (formBanco.moneda as 'ARS' | 'USD') || 'ARS',
          activa: formBanco.activa ?? true,
          orden: formBanco.orden ?? 0,
        }, user?.uid);
        toast.success('Banco creado');
      } else if (formBanco.id) {
        await updateBanco(formBanco.id, {
          nombre: formBanco.nombre.trim(),
          moneda: (formBanco.moneda as 'ARS' | 'USD') || 'ARS',
          activa: formBanco.activa ?? true,
          orden: formBanco.orden ?? 0,
        }, user?.uid);
        toast.success('Banco actualizado');
      }
      setModalBanco(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteBanco = async (b: Banco) => {
    if (!b.id || !hasPermiso('libro_diario', 'eliminar')) return;
    if (!confirm(`¿Eliminar banco "${b.nombre}"?`)) return;
    try {
      await deleteBanco(b.id);
      toast.success('Banco eliminado');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  // --- Saldos ---
  const abrirSaldo = (bancoId: string, fecha: string) => {
    const s = saldos.find((x) => x.bancoId === bancoId && x.fecha === fecha);
    setFormSaldo({ bancoId, fecha, saldo: s?.saldo ?? 0 });
    setFechaSaldo(fecha);
    setModalSaldo(true);
  };
  const handleSubmitSaldo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !formSaldo.bancoId) return;
    setSaving(true);
    setError('');
    try {
      await upsertSaldo(
        { bancoId: formSaldo.bancoId, fecha: formSaldo.fecha, saldo: formSaldo.saldo },
        user?.uid
      );
      toast.success('Saldo guardado');
      setModalSaldo(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  // --- Movimientos ---
  const abrirCrearMov = () => {
    setFormMov({
      bancoId: bancosActivos[0]?.id ?? '',
      fecha: filtroFechaMov,
      tipo: 'deposito',
      monto: 0,
      moneda: 'ARS',
      descripcion: '',
      referencia: '',
    });
    setModalMov('crear');
    setError('');
  };
  const abrirTransferencia = () => {
    setFormMov({
      bancoId: bancosActivos[0]?.id ?? '',
      fecha: filtroFechaMov,
      tipo: 'transferencia',
      monto: 0,
      moneda: 'ARS',
      descripcion: 'Transferencia',
      bancoDestinoId: bancosActivos[1]?.id ?? '',
    });
    setModalMov('transferencia');
    setError('');
  };
  const handleSubmitMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (modalMov === 'transferencia') {
      if (!formMov.bancoId || !formMov.bancoDestinoId || formMov.bancoId === formMov.bancoDestinoId) {
        setError('Seleccione banco origen y destino distintos');
        return;
      }
      const monto = Math.abs(Number(formMov.monto) || 0);
      if (monto <= 0) {
        setError('Monto mayor a 0');
        return;
      }
      setSaving(true);
      setError('');
      try {
        await createTransferencia(
          formMov.bancoId,
          formMov.bancoDestinoId,
          monto,
          (formMov.moneda as 'ARS' | 'USD') || 'ARS',
          formMov.fecha || filtroFechaMov,
          formMov.descripcion || 'Transferencia',
          formMov.referencia,
          user?.uid
        );
        toast.success('Transferencia registrada');
        setModalMov(null);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
        toast.error(err instanceof Error ? err.message : 'Error');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!formMov.bancoId || !formMov.fecha || formMov.monto === undefined) return;
    const monto = formMov.tipo === 'transferencia' ? 0 : Number(formMov.monto) || 0;
    if (formMov.tipo !== 'ajuste' && formMov.tipo !== 'otro' && monto === 0) return;
    setSaving(true);
    setError('');
    try {
      await createMovimiento(
        {
          bancoId: formMov.bancoId,
          fecha: formMov.fecha,
          tipo: (formMov.tipo as Movimiento['tipo']) || 'deposito',
          monto,
          moneda: (formMov.moneda as 'ARS' | 'USD') || 'ARS',
          descripcion: formMov.descripcion?.trim() || '-',
          referencia: formMov.referencia,
        },
        user?.uid
      );
      toast.success('Movimiento creado');
      setModalMov(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteMov = async (m: Movimiento) => {
    if (!m.id || !hasPermiso('libro_diario', 'eliminar')) return;
    if (!confirm('¿Eliminar este movimiento?')) return;
    try {
      await deleteMovimiento(m.id);
      toast.success('Movimiento eliminado');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  // --- Plantillas ---
  const abrirCrearPlantilla = () => {
    setFormPlantilla({
      nombre: '',
      tipo: 'deposito',
      monto: 0,
      moneda: 'ARS',
      bancoId: bancosActivos[0]?.id ?? '',
      descripcion: '',
      frecuencia: 'mensual',
      activa: true,
      orden: plantillas.length,
    });
    setModalPlantilla('crear');
    setError('');
  };
  const abrirEditarPlantilla = (p: PlantillaMovimiento) => {
    setFormPlantilla({ ...p });
    setModalPlantilla('editar');
    setError('');
  };
  const handleSubmitPlantilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !formPlantilla.nombre?.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (modalPlantilla === 'crear') {
        await createPlantilla({
          nombre: formPlantilla.nombre.trim(),
          tipo: (formPlantilla.tipo as PlantillaMovimiento['tipo']) || 'deposito',
          monto: Number(formPlantilla.monto) || 0,
          moneda: (formPlantilla.moneda as 'ARS' | 'USD') || 'ARS',
          bancoId: formPlantilla.bancoId!,
          bancoDestinoId: formPlantilla.bancoDestinoId,
          descripcion: formPlantilla.descripcion?.trim() || '-',
          frecuencia: formPlantilla.frecuencia,
          activa: formPlantilla.activa ?? true,
          orden: formPlantilla.orden ?? 0,
        }, user?.uid);
        toast.success('Plantilla creada');
      } else if (formPlantilla.id) {
        await updatePlantilla(formPlantilla.id, {
          nombre: formPlantilla.nombre.trim(),
          tipo: formPlantilla.tipo,
          monto: Number(formPlantilla.monto) || 0,
          moneda: formPlantilla.moneda,
          bancoId: formPlantilla.bancoId,
          bancoDestinoId: formPlantilla.bancoDestinoId,
          descripcion: formPlantilla.descripcion?.trim(),
          frecuencia: formPlantilla.frecuencia,
          activa: formPlantilla.activa,
          orden: formPlantilla.orden,
        }, user?.uid);
        toast.success('Plantilla actualizada');
      }
      setModalPlantilla(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };
  const aplicarPlantilla = async (plantillaId: string) => {
    try {
      await generarMovimientoDesdePlantilla(plantillaId, filtroFechaMov, user?.uid);
      toast.success('Movimiento generado');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  // --- Compromisos ---
  const abrirCrearCompromiso = () => {
    setFormCompromiso({
      concepto: '',
      deuda: 0,
      importeAPagar: 0,
      cuota: '-',
      observacion: '',
      categoria: 'otros_egresos',
      moneda: 'ARS',
      mesAnio: mesAnioCompromisos,
      pagosPorFecha: {},
      activo: true,
      orden: compromisos.length,
    });
    setModalCompromiso('crear');
    setError('');
  };
  const abrirEditarCompromiso = (c: Compromiso) => {
    setFormCompromiso({ ...c });
    setModalCompromiso('editar');
    setError('');
  };
  const handleSubmitCompromiso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !formCompromiso.concepto?.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        concepto: formCompromiso.concepto.trim(),
        deuda: Number(formCompromiso.deuda) || 0,
        importeAPagar: Number(formCompromiso.importeAPagar) || 0,
        cuota: formCompromiso.cuota?.trim() || '-',
        observacion: formCompromiso.observacion?.trim() || '',
        categoria: formCompromiso.categoria!,
        moneda: (formCompromiso.moneda as 'ARS' | 'USD') || 'ARS',
        mesAnio: formCompromiso.mesAnio || mesAnioCompromisos,
        pagosPorFecha: formCompromiso.pagosPorFecha ?? {},
        acumulado: formCompromiso.acumulado,
        diferencia: formCompromiso.diferencia,
        activo: formCompromiso.activo ?? true,
        orden: formCompromiso.orden ?? 0,
      };
      if (modalCompromiso === 'crear') {
        await createCompromiso(payload, user?.uid);
        toast.success('Compromiso creado');
      } else if (formCompromiso.id) {
        await updateCompromiso(formCompromiso.id, payload, user?.uid);
        toast.success('Compromiso actualizado');
      }
      setModalCompromiso(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteCompromiso = async (c: Compromiso) => {
    if (!c.id || !hasPermiso('libro_diario', 'eliminar')) return;
    if (!confirm(`¿Eliminar compromiso "${c.concepto}"?`)) return;
    try {
      await deleteCompromiso(c.id);
      toast.success('Compromiso eliminado');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const resumenPorBanco = bancosActivos.map((b) => {
    const s = saldos.find((x) => x.bancoId === b.id && x.fecha === fechaResumen);
    const movs = movimientosResumen.filter((m) => m.bancoId === b.id);
    const sumMov = movs.reduce((ac, m) => ac + (m.monto ?? 0), 0);
    const saldoCalculado = (s?.saldo ?? 0) + sumMov;
    return { banco: b, saldoManual: s?.saldo ?? null, movimientos: movs.length, saldoCalculado };
  });

  if (!canVerModulo('libro_diario')) return null;

  return (
    <AdminLayout title="Libro diario">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-300 pb-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                <Icon size={18} />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="text-slate-500">Cargando…</p>
        )}

        {/* Tab: Bancos */}
        {!loading && tab === 'bancos' && (
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Cuentas bancarias</h2>
              {hasPermiso('libro_diario', 'crear') && (
                <button type="button" onClick={abrirCrearBanco} className="btn-primary flex items-center gap-2">
                  <Plus size={18} />
                  Nuevo banco
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Moneda</th>
                    <th className="py-2 pr-2">Orden</th>
                    <th className="py-2 pr-2">Activa</th>
                    <th className="py-2 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bancos.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100">
                      <td className="py-2">{b.nombre}</td>
                      <td className="py-2">{b.moneda}</td>
                      <td className="py-2">{b.orden ?? 0}</td>
                      <td className="py-2">{b.activa !== false ? 'Sí' : 'No'}</td>
                      <td className="py-2 flex gap-1">
                        {hasPermiso('libro_diario', 'editar') && (
                          <button type="button" onClick={() => abrirEditarBanco(b)} className="p-1.5 rounded hover:bg-slate-200" title="Editar">
                            <Pencil size={16} />
                          </button>
                        )}
                        {hasPermiso('libro_diario', 'eliminar') && (
                          <button type="button" onClick={() => handleDeleteBanco(b)} className="p-1.5 rounded hover:bg-red-100 text-red-700" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bancos.length === 0 && <p className="text-slate-500 py-4">No hay bancos. Agregue uno para comenzar.</p>}
          </div>
        )}

        {/* Tab: Saldos */}
        {!loading && tab === 'saldos' && (
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Saldos por fecha</h2>
              <input
                type="date"
                value={fechaSaldo}
                onChange={(e) => setFechaSaldo(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bancosActivos.map((b) => {
                const s = saldos.find((x) => x.bancoId === b.id && x.fecha === fechaSaldo);
                return (
                  <div key={b.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="font-medium text-slate-800">{b.nombre}</div>
                    <div className="text-2xl font-semibold text-slate-700 mt-1">
                      {formatMonto(s?.saldo ?? 0, b.moneda ?? 'ARS')}
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirSaldo(b.id!, fechaSaldo)}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      {s ? 'Editar saldo' : 'Cargar saldo'}
                    </button>
                  </div>
                );
              })}
            </div>
            {bancosActivos.length === 0 && <p className="text-slate-500 py-4">Configure bancos en la pestaña Bancos.</p>}
          </div>
        )}

        {/* Tab: Movimientos */}
        {!loading && tab === 'movimientos' && (
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Movimientos</h2>
              <input
                type="date"
                value={filtroFechaMov}
                onChange={(e) => setFiltroFechaMov(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
              <select
                value={filtroBancoMov}
                onChange={(e) => setFiltroBancoMov(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="">Todos los bancos</option>
                {bancosActivos.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
              {hasPermiso('libro_diario', 'crear') && (
                <>
                  <button type="button" onClick={abrirCrearMov} className="btn-primary flex items-center gap-2">
                    <Plus size={18} />
                    Movimiento
                  </button>
                  <button type="button" onClick={abrirTransferencia} className="btn-secondary flex items-center gap-2">
                    Transferencia
                  </button>
                </>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-2">Banco</th>
                    <th className="py-2 pr-2">Tipo</th>
                    <th className="py-2 pr-2">Descripción</th>
                    <th className="py-2 pr-2 text-right">Monto</th>
                    <th className="py-2 pr-2">Ref.</th>
                    <th className="py-2 w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(filtroBancoMov ? movimientos.filter((m) => m.bancoId === filtroBancoMov) : movimientos).map((m) => {
                    const banco = bancos.find((b) => b.id === m.bancoId);
                    return (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-2">{banco?.nombre ?? m.bancoId}</td>
                        <td className="py-2">{m.tipo}</td>
                        <td className="py-2">{m.descripcion}</td>
                        <td className={`py-2 text-right font-medium ${(m.monto ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatMonto(m.monto ?? 0, m.moneda ?? 'ARS')}
                        </td>
                        <td className="py-2">{m.referencia || '-'}</td>
                        <td className="py-2">
                          {hasPermiso('libro_diario', 'eliminar') && (
                            <button type="button" onClick={() => handleDeleteMov(m)} className="p-1.5 rounded hover:bg-red-100 text-red-700" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {movimientos.length === 0 && <p className="text-slate-500 py-4">No hay movimientos para esta fecha.</p>}
          </div>
        )}

        {/* Tab: Plantillas */}
        {!loading && tab === 'plantillas' && (
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Plantillas de movimientos</h2>
              {hasPermiso('libro_diario', 'crear') && (
                <button type="button" onClick={abrirCrearPlantilla} className="btn-primary flex items-center gap-2">
                  <Plus size={18} />
                  Nueva plantilla
                </button>
              )}
            </div>
            <p className="text-slate-600 text-sm mb-2">Use una plantilla para generar un movimiento en la fecha seleccionada (pestaña Movimientos).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Tipo</th>
                    <th className="py-2 pr-2 text-right">Monto</th>
                    <th className="py-2 pr-2">Banco</th>
                    <th className="py-2 w-32">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {plantillas.map((p) => {
                    const banco = bancos.find((b) => b.id === p.bancoId);
                    return (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="py-2">{p.nombre}</td>
                        <td className="py-2">{p.tipo}</td>
                        <td className="py-2 text-right">{formatMonto(p.monto ?? 0, p.moneda ?? 'ARS')}</td>
                        <td className="py-2">{banco?.nombre ?? p.bancoId}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => aplicarPlantilla(p.id!)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Aplicar hoy
                          </button>
                          {hasPermiso('libro_diario', 'editar') && (
                            <button type="button" onClick={() => abrirEditarPlantilla(p)} className="ml-2 p-1 rounded hover:bg-slate-200">
                              <Pencil size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {plantillas.length === 0 && <p className="text-slate-500 py-4">No hay plantillas.</p>}
          </div>
        )}

        {/* Tab: Compromisos */}
        {!loading && tab === 'compromisos' && (
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Planilla de compromisos</h2>
              <input
                type="month"
                value={mesAnioCompromisos}
                onChange={(e) => setMesAnioCompromisos(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
              {hasPermiso('libro_diario', 'crear') && (
                <button type="button" onClick={abrirCrearCompromiso} className="btn-primary flex items-center gap-2">
                  <Plus size={18} />
                  Nuevo compromiso
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-2">Concepto</th>
                    <th className="py-2 pr-2">Categoría</th>
                    <th className="py-2 pr-2 text-right">Deuda</th>
                    <th className="py-2 pr-2 text-right">A pagar</th>
                    <th className="py-2 pr-2">Cuota</th>
                    <th className="py-2 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {compromisos.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2">{c.concepto}</td>
                      <td className="py-2">{CATEGORIAS_COMPROMISO.find((x) => x.value === c.categoria)?.label ?? c.categoria}</td>
                      <td className="py-2 text-right">{formatMonto(c.deuda ?? 0, c.moneda ?? 'ARS')}</td>
                      <td className="py-2 text-right">{formatMonto(c.importeAPagar ?? 0, c.moneda ?? 'ARS')}</td>
                      <td className="py-2">{c.cuota ?? '-'}</td>
                      <td className="py-2 flex gap-1">
                        {hasPermiso('libro_diario', 'editar') && (
                          <button type="button" onClick={() => abrirEditarCompromiso(c)} className="p-1.5 rounded hover:bg-slate-200" title="Editar">
                            <Pencil size={16} />
                          </button>
                        )}
                        {hasPermiso('libro_diario', 'eliminar') && (
                          <button type="button" onClick={() => handleDeleteCompromiso(c)} className="p-1.5 rounded hover:bg-red-100 text-red-700" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {compromisos.length === 0 && <p className="text-slate-500 py-4">No hay compromisos para este mes.</p>}
          </div>
        )}

        {/* Tab: Resumen */}
        {!loading && tab === 'resumen' && (
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Resumen por banco</h2>
              <input
                type="date"
                value={fechaResumen}
                onChange={(e) => setFechaResumen(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resumenPorBanco.map(({ banco, saldoManual, movimientos: cant, saldoCalculado }) => (
                <div key={banco.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="font-medium text-slate-800">{banco.nombre}</div>
                  <div className="text-slate-600 text-sm mt-1">Saldo manual: {saldoManual != null ? formatMonto(saldoManual, banco.moneda ?? 'ARS') : 'Sin cargar'}</div>
                  <div className="text-slate-600 text-sm">Movimientos: {cant}</div>
                  <div className="text-xl font-semibold text-slate-800 mt-2">{formatMonto(saldoCalculado, banco.moneda ?? 'ARS')}</div>
                </div>
              ))}
            </div>
            {resumenPorBanco.length === 0 && <p className="text-slate-500 py-4">Configure bancos y cargue saldos.</p>}
          </div>
        )}
      </div>

      {/* Modal Banco */}
      {(modalBanco === 'crear' || modalBanco === 'editar') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">{modalBanco === 'crear' ? 'Nuevo banco' : 'Editar banco'}</h3>
            <form onSubmit={handleSubmitBanco} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formBanco.nombre ?? ''}
                  onChange={(e) => setFormBanco((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <select
                  value={formBanco.moneda ?? 'ARS'}
                  onChange={(e) => setFormBanco((f) => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formBanco.orden ?? 0}
                  onChange={(e) => setFormBanco((f) => ({ ...f, orden: Number(e.target.value) }))}
                  className="w-20 border border-slate-300 rounded-lg px-3 py-2"
                />
                <label className="text-sm text-slate-600">Orden</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formBanco.activa ?? true}
                  onChange={(e) => setFormBanco((f) => ({ ...f, activa: e.target.checked }))}
                />
                <label className="text-sm text-slate-600">Activa</label>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModalBanco(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Saldo */}
      {modalSaldo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Cargar saldo</h3>
            <form onSubmit={handleSubmitSaldo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                <select
                  value={formSaldo.bancoId}
                  onChange={(e) => setFormSaldo((f) => ({ ...f, bancoId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Seleccione</option>
                  {bancosActivos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formSaldo.fecha}
                  onChange={(e) => setFormSaldo((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo</label>
                <input
                  type="number"
                  step="0.01"
                  value={formSaldo.saldo}
                  onChange={(e) => setFormSaldo((f) => ({ ...f, saldo: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModalSaldo(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento / Transferencia */}
      {(modalMov === 'crear' || modalMov === 'transferencia') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {modalMov === 'transferencia' ? 'Nueva transferencia' : 'Nuevo movimiento'}
            </h3>
            <form onSubmit={handleSubmitMov} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Banco {modalMov === 'transferencia' ? 'origen' : ''}</label>
                <select
                  value={formMov.bancoId ?? ''}
                  onChange={(e) => setFormMov((f) => ({ ...f, bancoId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                >
                  {bancosActivos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
              {modalMov === 'transferencia' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Banco destino</label>
                  <select
                    value={formMov.bancoDestinoId ?? ''}
                    onChange={(e) => setFormMov((f) => ({ ...f, bancoDestinoId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    required
                  >
                    {bancosActivos.filter((b) => b.id !== formMov.bancoId).map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {modalMov === 'crear' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select
                      value={formMov.tipo ?? 'deposito'}
                      onChange={(e) => setFormMov((f) => ({ ...f, tipo: e.target.value as Movimiento['tipo'] }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      {TIPOS_MOVIMIENTO.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto (positivo ingreso, negativo egreso)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formMov.monto ?? ''}
                      onChange={(e) => setFormMov((f) => ({ ...f, monto: Number(e.target.value) }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}
              {modalMov === 'transferencia' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formMov.monto ?? ''}
                    onChange={(e) => setFormMov((f) => ({ ...f, monto: Number(e.target.value) }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <select
                  value={formMov.moneda ?? 'ARS'}
                  onChange={(e) => setFormMov((f) => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formMov.descripcion ?? ''}
                  onChange={(e) => setFormMov((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formMov.fecha ?? filtroFechaMov}
                  onChange={(e) => setFormMov((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referencia</label>
                <input
                  type="text"
                  value={formMov.referencia ?? ''}
                  onChange={(e) => setFormMov((f) => ({ ...f, referencia: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModalMov(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Plantilla */}
      {(modalPlantilla === 'crear' || modalPlantilla === 'editar') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{modalPlantilla === 'crear' ? 'Nueva plantilla' : 'Editar plantilla'}</h3>
            <form onSubmit={handleSubmitPlantilla} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formPlantilla.nombre ?? ''}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={formPlantilla.tipo ?? 'deposito'}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, tipo: e.target.value as PlantillaMovimiento['tipo'] }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {TIPOS_MOVIMIENTO.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  value={formPlantilla.monto ?? ''}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, monto: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <select
                  value={formPlantilla.moneda ?? 'ARS'}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                <select
                  value={formPlantilla.bancoId ?? ''}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, bancoId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                >
                  {bancosActivos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
              {formPlantilla.tipo === 'transferencia' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Banco destino</label>
                  <select
                    value={formPlantilla.bancoDestinoId ?? ''}
                    onChange={(e) => setFormPlantilla((f) => ({ ...f, bancoDestinoId: e.target.value || undefined }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="">—</option>
                    {bancosActivos.filter((b) => b.id !== formPlantilla.bancoId).map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formPlantilla.descripcion ?? ''}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia</label>
                <select
                  value={formPlantilla.frecuencia ?? 'mensual'}
                  onChange={(e) => setFormPlantilla((f) => ({ ...f, frecuencia: e.target.value as PlantillaMovimiento['frecuencia'] }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModalPlantilla(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Compromiso */}
      {(modalCompromiso === 'crear' || modalCompromiso === 'editar') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{modalCompromiso === 'crear' ? 'Nuevo compromiso' : 'Editar compromiso'}</h3>
            <form onSubmit={handleSubmitCompromiso} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                <input
                  type="text"
                  value={formCompromiso.concepto ?? ''}
                  onChange={(e) => setFormCompromiso((f) => ({ ...f, concepto: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select
                  value={formCompromiso.categoria ?? 'otros_egresos'}
                  onChange={(e) => setFormCompromiso((f) => ({ ...f, categoria: e.target.value as Compromiso['categoria'] }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {CATEGORIAS_COMPROMISO.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deuda</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCompromiso.deuda ?? ''}
                    onChange={(e) => setFormCompromiso((f) => ({ ...f, deuda: Number(e.target.value) }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Importe a pagar</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCompromiso.importeAPagar ?? ''}
                    onChange={(e) => setFormCompromiso((f) => ({ ...f, importeAPagar: Number(e.target.value) }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cuota (ej: 34 de 67)</label>
                <input
                  type="text"
                  value={formCompromiso.cuota ?? ''}
                  onChange={(e) => setFormCompromiso((f) => ({ ...f, cuota: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observación</label>
                <input
                  type="text"
                  value={formCompromiso.observacion ?? ''}
                  onChange={(e) => setFormCompromiso((f) => ({ ...f, observacion: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <select
                  value={formCompromiso.moneda ?? 'ARS'}
                  onChange={(e) => setFormCompromiso((f) => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mes / Año</label>
                <input
                  type="month"
                  value={formCompromiso.mesAnio ?? mesAnioCompromisos}
                  onChange={(e) => setFormCompromiso((f) => ({ ...f, mesAnio: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModalCompromiso(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
