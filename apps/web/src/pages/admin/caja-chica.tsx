'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { listSystemUsers } from '@/services/permisosService';
import { addCajaToUserPermisos } from '@/services/permisosService';
import type { SystemUser } from '@/types/permisos';
import { listCuentasActivas } from '@/services/flujoFondosService';
import {
  listCajasChica,
  createCajaChica,
  updateCajaChica,
  deleteCajaChica,
  listMovimientosCaja,
  createMovimientoCaja,
  deleteMovimientoCaja,
  transferirFondoACaja,
  comprarUSDCajaChica,
  listRendiciones,
  createRendicion,
  aprobarRendicionYCrearReposicion,
  getMatrizControl,
  listCajasCentrales,
  listSubCajas,
  createCierreCaja,
  listCierresCaja,
} from '@/services/cajaChicaService';
import type { CajaChica, MovimientoCaja, TipoMovimientoCaja, Rendicion, ItemRendicion, CierreCaja } from '@/types/cajaChica';
import { CATEGORIAS_EGRESO } from '@/types/cajaChica';

const ESTADOS = [
  { value: 'activa' as const, label: 'Activa' },
  { value: 'cerrada' as const, label: 'Cerrada' },
];

const NIVELES = [
  { value: 'central' as const, label: 'Caja Central (Nivel 1)' },
  { value: 'sub_caja' as const, label: 'Sub-caja (Nivel 2)' },
];

const MONEDAS = ['ARS', 'USD'];

export default function CajaChicaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermiso, canVerModulo, getCajasChicaPermitidas } = usePermisos();
  const [cajas, setCajas] = useState<CajaChica[]>([]);
  const [cuentasFondo, setCuentasFondo] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCaja, setModalCaja] = useState<'crear' | 'editar' | null>(null);
  const [modalMov, setModalMov] = useState<'ingreso' | 'egreso' | null>(null);
  const [cajaSeleccionada, setCajaSeleccionada] = useState<CajaChica | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [formCaja, setFormCaja] = useState<Partial<CajaChica>>({});
  const [formMov, setFormMov] = useState<Partial<MovimientoCaja>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [matriz, setMatriz] = useState<Awaited<ReturnType<typeof getMatrizControl>>>([]);
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([]);
  const [modalTransferir, setModalTransferir] = useState(false);
  const [modalRendicion, setModalRendicion] = useState(false);
  const [formTransferir, setFormTransferir] = useState({ subCajaId: '', monto: 0, fecha: new Date().toISOString().slice(0, 10) });
  const [formRendicion, setFormRendicion] = useState<{ items: ItemRendicion[]; fecha: string }>({ items: [], fecha: new Date().toISOString().slice(0, 10) });
  const [asignarMontos, setAsignarMontos] = useState<Record<string, number>>({});
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [filtroFecha, setFiltroFecha] = useState<{ desde: string; hasta: string }>(() => {
    const hoy = new Date();
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return {
      desde: ini.toISOString().slice(0, 10),
      hasta: hoy.toISOString().slice(0, 10),
    };
  });
  const [modalCierre, setModalCierre] = useState(false);
  const [formCierre, setFormCierre] = useState<{ fecha: string; tipo: 'diario' | 'mensual'; observaciones: string }>({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'diario',
    observaciones: '',
  });
  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [modalCompraUSD, setModalCompraUSD] = useState(false);
  const [formCompraUSD, setFormCompraUSD] = useState({
    cajaArsId: '',
    cajaUsdId: '',
    montoPesos: 0,
    cotizacion: 0,
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
  });
  const [anchosColumnas, setAnchosColumnas] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const s = localStorage.getItem('caja-chica-columnas');
        if (s) return JSON.parse(s);
      } catch {}
    }
    return { fecha: 95, descripcion: 180, ingresos: 95, egresos: 95, cierre: 95 };
  });
  const [colResizing, setColResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem('caja-chica-columnas', JSON.stringify(anchosColumnas));
    } catch {}
  }, [anchosColumnas]);

  const handleResizeStart = useCallback((col: string, clientX: number) => {
    const defaults: Record<string, number> = { fecha: 95, descripcion: 180, ingresos: 95, egresos: 95, cierre: 95 };
    const w = anchosColumnas[col] ?? defaults[col] ?? 95;
    setColResizing(col);
    resizeStartX.current = clientX;
    resizeStartW.current = w;
  }, [anchosColumnas]);

  useEffect(() => {
    if (!colResizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartX.current;
      const newW = Math.max(50, resizeStartW.current + dx);
      setAnchosColumnas((prev) => ({ ...prev, [colResizing]: newW }));
    };
    const onUp = () => {
      setColResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [colResizing]);

  const ThResizable = useCallback(({ col, children, className = '' }: { col: string; children: React.ReactNode; className?: string }) => (
    <th className={`relative ${className}`}>
      <span>{children}</span>
      <div
        role="separator"
        aria-orientation="vertical"
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300 active:bg-blue-400 transition-colors -mr-1"
        style={{ backgroundColor: colResizing === col ? 'rgb(147 197 253)' : undefined }}
        onMouseDown={(e) => { e.preventDefault(); handleResizeStart(col, e.clientX); }}
      />
    </th>
  ), [colResizing, handleResizeStart]);

  const permitidas = getCajasChicaPermitidas();
  const cajasFiltradas = permitidas === null ? cajas : cajas.filter((c) => c.id && permitidas.includes(c.id));
  const cajasCentrales = listCajasCentrales(cajasFiltradas);
  const subCajas = cajaSeleccionada && (cajaSeleccionada.nivel ?? 'sub_caja') === 'central'
    ? listSubCajas(cajasFiltradas, cajaSeleccionada.id!)
    : [];
  const cajasArs = cajasFiltradas.filter((c) => (c.moneda ?? 'ARS') === 'ARS');
  const cajasUsd = cajasFiltradas.filter((c) => (c.moneda ?? '') === 'USD');
  const puedeComprarUSD = cajasArs.length > 0 && cajasUsd.length > 0 && hasPermiso('caja_chica', 'crear');
  const cajasOrdenadas = [...cajasFiltradas].sort((a, b) => {
    const na = a.nivel ?? 'sub_caja';
    const nb = b.nivel ?? 'sub_caja';
    if (na === 'central' && nb !== 'central') return -1;
    if (na !== 'central' && nb === 'central') return 1;
    return 0;
  });

  const loadCajas = async () => {
    setLoading(true);
    try {
      const [data, cuentas] = await Promise.all([listCajasChica(), listCuentasActivas()]);
      setCajas(data);
      setCuentasFondo(cuentas.map((c) => ({ id: c.id!, nombre: c.nombre })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadMovimientos = async (cajaId: string) => {
    try {
      const filtros = filtroFecha.desde && filtroFecha.hasta ? { desde: filtroFecha.desde, hasta: filtroFecha.hasta } : undefined;
      const data = await listMovimientosCaja(cajaId, filtros);
      setMovimientos(data);
    } catch {
      setMovimientos([]);
    }
  };

  useEffect(() => {
    if (!canVerModulo('caja_chica')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    loadCajas();
  }, []);

  useEffect(() => {
    if (cajaSeleccionada?.id) loadMovimientos(cajaSeleccionada.id);
  }, [cajaSeleccionada?.id, filtroFecha.desde, filtroFecha.hasta]);

  useEffect(() => {
    const permit = getCajasChicaPermitidas();
    const filtradas = permit === null ? cajas : cajas.filter((c) => c.id && permit.includes(c.id));
    if (filtradas.length > 0) {
      const ordenadas = [...filtradas].sort((a, b) => {
        const na = a.nivel ?? 'sub_caja';
        const nb = b.nivel ?? 'sub_caja';
        if (na === 'central' && nb !== 'central') return -1;
        if (na !== 'central' && nb === 'central') return 1;
        return 0;
      });
      getMatrizControl(ordenadas).then(setMatriz).catch(() => setMatriz([]));
    } else {
      setMatriz([]);
    }
  }, [cajas]);

  useEffect(() => {
    if (cajaSeleccionada?.id) {
      listRendiciones(cajaSeleccionada.id).then(setRendiciones).catch(() => setRendiciones([]));
      listCierresCaja(cajaSeleccionada.id).then(setCierres).catch(() => setCierres([]));
    } else {
      setRendiciones([]);
      setCierres([]);
    }
  }, [cajaSeleccionada?.id, cajas]);

  const abrirCrearCaja = () => {
    setFormCaja({
      nombre: '',
      nivel: 'sub_caja',
      montoMaximo: 0,
      moneda: 'ARS',
      estado: 'activa',
      saldoInicial: 0,
    });
    setModalCaja('crear');
    setError('');
    listSystemUsers().then(setSystemUsers).catch(() => setSystemUsers([]));
  };

  const abrirEditarCaja = (c: CajaChica) => {
    setFormCaja({ ...c });
    setModalCaja('editar');
    setError('');
    listSystemUsers().then(setSystemUsers).catch(() => setSystemUsers([]));
  };

  const cerrarModalCaja = () => {
    setModalCaja(null);
    setFormCaja({});
    setError('');
  };

  const handleSubmitCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (modalCaja === 'crear' && !hasPermiso('caja_chica', 'crear')) return;
    if (modalCaja === 'editar' && !hasPermiso('caja_chica', 'editar')) return;
    if (!formCaja.nombre?.trim()) {
      setError('Nombre es obligatorio');
      toast.error('Nombre es obligatorio');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (modalCaja === 'crear') {
        const cajaId = await createCajaChica({
          nombre: formCaja.nombre.trim(),
          nivel: formCaja.nivel ?? 'sub_caja',
          cajaPadreId: formCaja.nivel === 'sub_caja' && formCaja.cajaPadreId ? formCaja.cajaPadreId : undefined,
          cuentaFondoId: (formCaja.nivel ?? 'sub_caja') === 'central' ? formCaja.cuentaFondoId || undefined : undefined,
          responsableId: formCaja.responsableId || undefined,
          responsableNombre: formCaja.responsableNombre || undefined,
          usuarioAsignadoId: formCaja.usuarioAsignadoId || undefined,
          montoMaximo: Number(formCaja.montoMaximo) || 0,
          moneda: formCaja.moneda ?? 'ARS',
          estado: formCaja.estado ?? 'activa',
          saldoInicial: formCaja.nivel === 'central' ? Number(formCaja.saldoInicial) || 0 : undefined,
        }, user?.uid);
        if (formCaja.usuarioAsignadoId && cajaId) {
          await addCajaToUserPermisos(formCaja.usuarioAsignadoId, cajaId, user?.uid).catch(() => {});
        }
      } else if (modalCaja === 'editar' && formCaja.id) {
        await updateCajaChica(formCaja.id, {
          nombre: formCaja.nombre.trim(),
          cuentaFondoId: (formCaja.nivel ?? 'sub_caja') === 'central' ? formCaja.cuentaFondoId || undefined : undefined,
          responsableId: formCaja.responsableId || undefined,
          responsableNombre: formCaja.responsableNombre || undefined,
          usuarioAsignadoId: formCaja.usuarioAsignadoId || undefined,
          montoMaximo: Number(formCaja.montoMaximo) || 0,
          moneda: formCaja.moneda ?? 'ARS',
          estado: formCaja.estado ?? 'activa',
        }, user?.uid);
        if (formCaja.usuarioAsignadoId) {
          await addCajaToUserPermisos(formCaja.usuarioAsignadoId, formCaja.id, user?.uid).catch(() => {});
        }
        if (cajaSeleccionada?.id === formCaja.id) {
          setCajaSeleccionada({ ...cajaSeleccionada, ...formCaja });
        }
        toast.success('Caja actualizada');
      } else if (modalCaja === 'crear') {
        toast.success('Caja creada');
      }
      cerrarModalCaja();
      loadCajas();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCaja = async (id: string) => {
    if (!hasPermiso('caja_chica', 'eliminar')) return;
    if (!confirm('¿Eliminar esta caja? Los movimientos asociados quedarán huérfanos.')) return;
    try {
      await deleteCajaChica(id, user?.uid);
      if (cajaSeleccionada?.id === id) setCajaSeleccionada(null);
      toast.success('Caja eliminada');
      loadCajas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const abrirMov = (tipo: TipoMovimientoCaja, caja: CajaChica) => {
    setCajaSeleccionada(caja);
    setFormMov({
      cajaId: caja.id,
      tipo,
      monto: 0,
      moneda: caja.moneda ?? 'ARS',
      fecha: new Date().toISOString().slice(0, 10),
      categoria: tipo === 'egreso' ? CATEGORIAS_EGRESO[0] : '',
      descripcion: '',
    });
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
    if (!hasPermiso('caja_chica', 'crear')) return;
    if (!cajaSeleccionada?.id || !formMov.monto || formMov.monto <= 0) {
      setError('Monto debe ser mayor a 0');
      return;
    }
    if (formMov.tipo === 'egreso' && !formMov.categoria) {
      setError('Categoría es obligatoria para egresos');
      return;
    }
    const caja = cajas.find((c) => c.id === cajaSeleccionada.id);
    if (formMov.tipo === 'egreso' && caja && (caja.saldoActual ?? 0) < formMov.monto) {
      setError('Saldo insuficiente en la caja');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await createMovimientoCaja(
        {
          cajaId: cajaSeleccionada.id,
          tipo: formMov.tipo!,
          monto: Number(formMov.monto),
          moneda: formMov.moneda ?? 'ARS',
          fecha: formMov.fecha ?? new Date().toISOString().slice(0, 10),
          categoria: formMov.categoria ?? 'Otros',
          descripcion: formMov.descripcion?.trim() || undefined,
        },
        user?.uid
      );
      toast.success(modalMov === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado');
      cerrarModalMov();
      loadCajas();
      loadMovimientos(cajaSeleccionada.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMov = async (mov: MovimientoCaja) => {
    if (!cajaSeleccionada?.id || !mov.id) return;
    if (!hasPermiso('caja_chica', 'eliminar')) return;
    const msg = mov.operacionCambioId
      ? 'Este movimiento es parte de una compra USD. Se eliminarán ambos movimientos (egreso ARS e ingreso USD). ¿Continuar?'
      : '¿Eliminar este movimiento?';
    if (!confirm(msg)) return;
    try {
      await deleteMovimientoCaja(mov.id, cajaSeleccionada.id, user?.uid);
      loadCajas();
      loadMovimientos(cajaSeleccionada.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const formatMonto = (n: number, moneda: string) =>
    `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR') : '0'}`;

  const handleAsignarDirecto = async (subCajaId: string, monto: number) => {
    if (!hasPermiso('caja_chica', 'transferir')) return;
    if (!cajaSeleccionada?.id || monto <= 0) {
      toast.error('Monto debe ser mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await transferirFondoACaja(
        cajaSeleccionada.id,
        subCajaId,
        monto,
        new Date().toISOString().slice(0, 10),
        user?.uid
      );
      toast.success('Fondo asignado');
      setAsignarMontos((prev) => ({ ...prev, [subCajaId]: 0 }));
      loadCajas();
      loadMovimientos(cajaSeleccionada.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermiso('caja_chica', 'transferir')) return;
    if (!cajaSeleccionada?.id || !formTransferir.subCajaId || formTransferir.monto <= 0) {
      toast.error('Completá sub-caja y monto');
      return;
    }
    setSaving(true);
    try {
      await transferirFondoACaja(
        cajaSeleccionada.id,
        formTransferir.subCajaId,
        formTransferir.monto,
        formTransferir.fecha || new Date().toISOString().slice(0, 10),
        user?.uid
      );
      toast.success('Fondo transferido');
      setModalTransferir(false);
      setFormTransferir({ subCajaId: '', monto: 0, fecha: new Date().toISOString().slice(0, 10) });
      loadCajas();
      if (cajaSeleccionada?.id) loadMovimientos(cajaSeleccionada.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompraUSD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompraUSD.cajaArsId || !formCompraUSD.cajaUsdId || formCompraUSD.montoPesos <= 0 || formCompraUSD.cotizacion <= 0) {
      toast.error('Completá caja origen, caja destino, monto en pesos y cotización');
      return;
    }
    setSaving(true);
    try {
      await comprarUSDCajaChica(
        {
          cajaArsId: formCompraUSD.cajaArsId,
          cajaUsdId: formCompraUSD.cajaUsdId,
          montoPesos: formCompraUSD.montoPesos,
          cotizacion: formCompraUSD.cotizacion,
          fecha: formCompraUSD.fecha,
          descripcion: formCompraUSD.descripcion || undefined,
        },
        user?.uid
      );
      const montoUsd = Math.round((formCompraUSD.montoPesos / formCompraUSD.cotizacion) * 100) / 100;
      toast.success(`Compra USD registrada: ${formCompraUSD.montoPesos.toLocaleString('es-AR')} ARS → ${montoUsd.toLocaleString('es-AR')} USD`);
      setModalCompraUSD(false);
      setFormCompraUSD({ cajaArsId: '', cajaUsdId: '', montoPesos: 0, cotizacion: 0, fecha: new Date().toISOString().slice(0, 10), descripcion: '' });
      loadCajas();
      if (cajaSeleccionada?.id) loadMovimientos(cajaSeleccionada.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleCrearRendicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermiso('caja_chica', 'rendicion')) return;
    const itemsValidos = formRendicion.items.filter((i) => i.monto > 0);
    if (!cajaSeleccionada?.id || itemsValidos.length === 0) {
      toast.error('Agregá al menos un comprobante con monto mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await createRendicion({
        cajaId: cajaSeleccionada.id,
        responsableNombre: cajaSeleccionada.responsableNombre ?? 'Responsable',
        fecha: formRendicion.fecha,
        totalGastado: 0,
        items: itemsValidos,
        montoReposicion: 0,
      }, user?.uid);
      toast.success('Rendición creada');
      setModalRendicion(false);
      setFormRendicion({ items: [], fecha: new Date().toISOString().slice(0, 10) });
      listRendiciones(cajaSeleccionada.id).then(setRendiciones);
      loadCajas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleAprobarRendicion = async (rid: string) => {
    if (!hasPermiso('caja_chica', 'rendicion')) return;
    setSaving(true);
    try {
      await aprobarRendicionYCrearReposicion(rid, user?.uid);
      toast.success('Rendición aprobada y repuesta');
      if (cajaSeleccionada?.id) {
        listRendiciones(cajaSeleccionada.id).then(setRendiciones);
        loadMovimientos(cajaSeleccionada.id);
      }
      loadCajas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const agregarItemRendicion = () => {
    setFormRendicion({
      ...formRendicion,
      items: [...formRendicion.items, { monto: 0, categoria: CATEGORIAS_EGRESO[0], descripcion: '' }],
    });
  };

  const quitarItemRendicion = (i: number) => {
    setFormRendicion({
      ...formRendicion,
      items: formRendicion.items.filter((_, idx) => idx !== i),
    });
  };

  const actualizarItemRendicion = (i: number, campo: keyof ItemRendicion, valor: string | number) => {
    const items = [...formRendicion.items];
    items[i] = { ...items[i], [campo]: valor };
    setFormRendicion({ ...formRendicion, items });
  };

  const handleCrearCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaSeleccionada?.id || !hasPermiso('caja_chica', 'crear')) return;
    const saldo = cajaSeleccionada.saldoActual ?? 0;
    setSaving(true);
    try {
      await createCierreCaja({
        cajaId: cajaSeleccionada.id,
        fecha: formCierre.fecha,
        tipo: formCierre.tipo,
        saldoRegistrado: saldo,
        observaciones: formCierre.observaciones.trim() || undefined,
      }, user?.uid);
      toast.success('Cierre registrado');
      setModalCierre(false);
      listCierresCaja(cajaSeleccionada.id).then(setCierres).catch(() => setCierres([]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Caja chica" backHref="/admin/dashboard" backLabel="Dashboard">
    <div className="space-y-6 max-w-6xl mx-auto">
      <p className="text-slate-600 text-sm">
        Sistema Fondo Fijo (Imprest): Caja Central fondea sub-cajas. Rendición contra comprobante para reponer.
      </p>

      <header className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
        <div></div>
        {hasPermiso('caja_chica', 'crear') && (
          <button
            onClick={abrirCrearCaja}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-blue-700 text-white rounded-xl hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm touch-manipulation"
          >
            + Nueva caja
          </button>
        )}
      </header>

      {/* Matriz de control */}
      {matriz.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800">Resumen de saldos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-4 py-3 font-medium">Ubicación</th>
                  <th className="text-left px-4 py-3 font-medium">Responsable</th>
                  <th className="text-right px-4 py-3 font-medium">Saldo Inicial</th>
                  <th className="text-right px-4 py-3 font-medium">Entregas/Repos.</th>
                  <th className="text-right px-4 py-3 font-medium">Gastos Rendidos</th>
                  <th className="text-right px-4 py-3 font-medium">Saldo Actual</th>
                </tr>
              </thead>
              <tbody>
                {matriz.map((f) => (
                  <tr key={f.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{f.ubicacion}</td>
                    <td className="px-4 py-3">{f.responsable}</td>
                    <td className="px-4 py-3 text-right">{f.saldoInicial.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{f.entregasReposiciones.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{f.gastosRendidos.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-right font-medium">{f.saldoActual.toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Lista de cajas */}
          <div className="lg:col-span-1 card overflow-hidden order-2 lg:order-1">
            <div className="card-header">
              <h2 className="font-semibold text-slate-800">Cajas</h2>
            </div>
            <div className="divide-y divide-slate-300 max-h-[400px] overflow-y-auto">
              {cajasOrdenadas.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">No hay cajas. Creá la primera.</div>
              ) : (
                cajasOrdenadas.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setCajaSeleccionada(c)}
                    className={`p-4 cursor-pointer hover:bg-slate-200/50 transition-colors ${
                      cajaSeleccionada?.id === c.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="font-medium text-slate-800 flex items-center gap-2">
                      {c.nombre}
                      <span className={`text-xs px-2 py-0.5 rounded ${(c.nivel ?? 'sub_caja') === 'central' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                        {(c.nivel ?? 'sub_caja') === 'central' ? 'Central' : 'Sub'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {formatMonto(c.saldoActual ?? 0, c.moneda ?? 'ARS')} / {formatMonto(c.montoMaximo ?? 0, c.moneda ?? 'ARS')}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {hasPermiso('caja_chica', 'editar') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); abrirEditarCaja(c); }}
                          className="flex-1 py-2 px-3 min-h-[40px] text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg touch-manipulation"
                        >
                          Editar
                        </button>
                      )}
                      {hasPermiso('caja_chica', 'eliminar') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); c.id && handleDeleteCaja(c.id); }}
                          className="flex-1 py-2 px-3 min-h-[40px] text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg touch-manipulation"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detalle caja + movimientos */}
          <div className="lg:col-span-2 card overflow-hidden order-1 lg:order-2">
            {!cajaSeleccionada ? (
              <div className="p-12 text-center text-slate-500">Seleccioná una caja</div>
            ) : (
              <>
                <div className="card-header flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-800">{cajaSeleccionada.nombre}</h2>
                    <p className="text-sm text-slate-600">
                      Saldo: <strong>{formatMonto(cajaSeleccionada.saldoActual ?? 0, cajaSeleccionada.moneda ?? 'ARS')}</strong>
                      {' · '}
                      Tope: {formatMonto(cajaSeleccionada.montoMaximo ?? 0, cajaSeleccionada.moneda ?? 'ARS')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(cajaSeleccionada.nivel ?? 'sub_caja') === 'central' && subCajas.length > 0 && hasPermiso('caja_chica', 'transferir') && (
                      <button
                        onClick={() => { setFormTransferir({ subCajaId: '', monto: 0, fecha: new Date().toISOString().slice(0, 10) }); setModalTransferir(true); }}
                        className="px-4 py-3 min-h-[44px] bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 touch-manipulation"
                      >
                        Transferir a sub-caja
                      </button>
                    )}
                    {(cajaSeleccionada.nivel ?? 'sub_caja') === 'sub_caja' && hasPermiso('caja_chica', 'rendicion') && (
                      <button
                        onClick={() => { setFormRendicion({ items: [{ monto: 0, categoria: CATEGORIAS_EGRESO[0], descripcion: '' }], fecha: new Date().toISOString().slice(0, 10) }); setModalRendicion(true); }}
                        className="px-4 py-3 min-h-[44px] bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 touch-manipulation"
                      >
                        Nueva rendición
                      </button>
                    )}
                    {hasPermiso('caja_chica', 'crear') && (
                      <button
                        onClick={() => {
                          setFormCierre({ fecha: new Date().toISOString().slice(0, 10), tipo: 'diario', observaciones: '' });
                          setModalCierre(true);
                        }}
                        className="px-4 py-3 min-h-[44px] bg-slate-600 text-white text-sm font-medium rounded-xl hover:bg-slate-700 touch-manipulation"
                      >
                        Registrar cierre
                      </button>
                    )}
                    {puedeComprarUSD && (
                      <button
                        onClick={() => {
                          setFormCompraUSD({
                            cajaArsId: (cajaSeleccionada.moneda ?? '') === 'ARS' ? cajaSeleccionada.id ?? '' : cajasArs[0]?.id ?? '',
                            cajaUsdId: (cajaSeleccionada.moneda ?? '') === 'USD' ? cajaSeleccionada.id ?? '' : cajasUsd[0]?.id ?? '',
                            montoPesos: 0,
                            cotizacion: 0,
                            fecha: new Date().toISOString().slice(0, 10),
                            descripcion: '',
                          });
                          setModalCompraUSD(true);
                        }}
                        className="px-4 py-3 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 touch-manipulation"
                      >
                        Compra USD
                      </button>
                    )}
                    {hasPermiso('caja_chica', 'crear') && (
                      <>
                        <button
                          onClick={() => abrirMov('ingreso', cajaSeleccionada)}
                          className="flex-1 sm:flex-initial px-4 py-3 min-h-[44px] bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 touch-manipulation"
                        >
                          + Ingreso
                        </button>
                        <button
                          onClick={() => abrirMov('egreso', cajaSeleccionada)}
                          disabled={(cajaSeleccionada.saldoActual ?? 0) <= 0}
                          className="flex-1 sm:flex-initial px-4 py-3 min-h-[44px] bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                        >
                          - Egreso
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {(cajaSeleccionada.nivel ?? 'sub_caja') === 'central' && subCajas.length > 0 && hasPermiso('caja_chica', 'transferir') && (
                  <div className="p-4 border-b border-slate-300 bg-indigo-50">
                    <h3 className="font-medium text-slate-800 mb-3">Asignar fondos directamente</h3>
                    <div className="space-y-3">
                      {subCajas.map((sub) => (
                        <div key={sub.id} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex-1 min-w-[120px]">
                            <span className="font-medium text-slate-800">{sub.nombre}</span>
                            <span className="text-slate-500 text-sm ml-2">
                              ({sub.responsableNombre ?? '—'}) · Saldo: {formatMonto(sub.saldoActual ?? 0, sub.moneda ?? 'ARS')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Monto"
                              value={asignarMontos[sub.id!] ?? ''}
                              onChange={(e) => setAsignarMontos((prev) => ({ ...prev, [sub.id!]: Number(e.target.value) }))}
                              className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <button
                              onClick={() => handleAsignarDirecto(sub.id!, asignarMontos[sub.id!] ?? 0)}
                              disabled={saving || !asignarMontos[sub.id!] || asignarMontos[sub.id!] <= 0}
                              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Asignar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {rendiciones.filter((r) => r.estado === 'pendiente').length > 0 && hasPermiso('caja_chica', 'rendicion') && (
                  <div className="p-4 border-b border-slate-300 bg-amber-50">
                    <h3 className="font-medium text-slate-800 mb-2">Rendiciones pendientes</h3>
                    <div className="space-y-2">
                      {rendiciones.filter((r) => r.estado === 'pendiente').map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-4 py-2">
                          <span>{r.fecha} · {r.totalGastado.toLocaleString('es-AR')} ({r.items.length} comprobantes)</span>
                          <button
                            onClick={() => handleAprobarRendicion(r.id!)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Aprobar y reponer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-4 border-t border-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-slate-800">Ingresos y egresos</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={filtroFecha.desde}
                        onChange={(e) => setFiltroFecha((f) => ({ ...f, desde: e.target.value }))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <span className="text-slate-500">a</span>
                      <input
                        type="date"
                        value={filtroFecha.hasta}
                        onChange={(e) => setFiltroFecha((f) => ({ ...f, hasta: e.target.value }))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => loadMovimientos(cajaSeleccionada!.id!)}
                        className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                      >
                        Filtrar
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: anchosColumnas.fecha || 95 }} />
                        <col style={{ width: anchosColumnas.descripcion || 180 }} />
                        <col style={{ width: anchosColumnas.ingresos || 95 }} />
                        <col style={{ width: anchosColumnas.egresos || 95 }} />
                        <col style={{ width: anchosColumnas.cierre || 95 }} />
                        {hasPermiso('caja_chica', 'eliminar') && <col style={{ width: 72 }} />}
                      </colgroup>
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="bg-slate-100 border-b border-slate-300">
                          <ThResizable col="fecha" className="text-left px-3 py-2 font-medium">Fecha</ThResizable>
                          <ThResizable col="descripcion" className="text-left px-3 py-2 font-medium">Descripción</ThResizable>
                          <ThResizable col="ingresos" className="text-right px-3 py-2 font-medium text-emerald-700">Ingresos</ThResizable>
                          <ThResizable col="egresos" className="text-right px-3 py-2 font-medium text-amber-700">Egresos</ThResizable>
                          <ThResizable col="cierre" className="text-right px-3 py-2 font-medium text-slate-600">Cierre</ThResizable>
                          {hasPermiso('caja_chica', 'eliminar') && <th className="w-[72px] px-3 py-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const moneda = cajaSeleccionada?.moneda ?? 'ARS';
                          const filas: { tipo: 'mov' | 'cierre'; fecha: string; mov?: MovimientoCaja; cierre?: CierreCaja }[] = [];
                          movimientos.forEach((m) => filas.push({ tipo: 'mov', fecha: m.fecha ?? '', mov: m }));
                          cierres.forEach((c) => {
                            const enRango = !filtroFecha.desde || !filtroFecha.hasta || (c.fecha >= filtroFecha.desde && c.fecha <= filtroFecha.hasta);
                            if (enRango) filas.push({ tipo: 'cierre', fecha: c.fecha, cierre: c });
                          });
                          filas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

                          let totalIngresos = 0;
                          let totalEgresos = 0;

                          if (filas.length === 0) {
                            return (
                              <tr>
                                <td colSpan={hasPermiso('caja_chica', 'eliminar') ? 6 : 5} className="p-6 text-center text-slate-500">
                                  Sin movimientos. Usá + Ingreso o - Egreso para registrar.
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <>
                              {filas.map((f) => {
                                if (f.tipo === 'mov' && f.mov) {
                                  if (f.mov.tipo === 'ingreso') totalIngresos += f.mov.monto ?? 0;
                                  else totalEgresos += f.mov.monto ?? 0;
                                  return (
                                    <tr key={`mov-${f.mov.id}`} className="border-t border-slate-200 hover:bg-slate-50">
                                      <td className="px-3 py-2">{f.mov.fecha}</td>
                                      <td className="px-3 py-2">
                                        {f.mov.categoria && <span className="text-xs px-2 py-0.5 bg-slate-200 rounded">{f.mov.categoria}</span>}
                                        {f.mov.descripcion && <span className="ml-1 text-slate-600">{f.mov.descripcion}</span>}
                                      </td>
                                      <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                                        {f.mov.tipo === 'ingreso' ? formatMonto(f.mov.monto, f.mov.moneda ?? moneda) : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right text-amber-700 font-medium">
                                        {f.mov.tipo === 'egreso' ? formatMonto(f.mov.monto, f.mov.moneda ?? moneda) : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right">—</td>
                                      {hasPermiso('caja_chica', 'eliminar') && (
                                        <td className="px-3 py-2">
                                          <button onClick={() => handleDeleteMov(f.mov!)} className="text-red-600 hover:bg-red-50 rounded px-2 py-1 text-xs font-medium">
                                            Eliminar
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                }
                                if (f.tipo === 'cierre' && f.cierre) {
                                  return (
                                    <tr key={`cierre-${f.cierre.id}`} className="border-t border-slate-200 bg-slate-50">
                                      <td className="px-3 py-2">{f.cierre.fecha}</td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs px-2 py-0.5 bg-slate-300 rounded font-medium">
                                          Cierre {f.cierre.tipo ?? 'diario'}
                                        </span>
                                        {f.cierre.observaciones && <span className="ml-1 text-slate-600 text-xs">{f.cierre.observaciones}</span>}
                                      </td>
                                      <td className="px-3 py-2 text-right">—</td>
                                      <td className="px-3 py-2 text-right">—</td>
                                      <td className="px-3 py-2 text-right font-medium text-slate-800">
                                        {formatMonto(f.cierre.saldoRegistrado, moneda)}
                                      </td>
                                      {hasPermiso('caja_chica', 'eliminar') && <td className="px-3 py-2"></td>}
                                    </tr>
                                  );
                                }
                                return null;
                              })}
                              <tr className="border-t-2 border-slate-300 bg-slate-100 font-medium">
                                <td className="px-3 py-3" colSpan={2}>Subtotal</td>
                                <td className="px-3 py-3 text-right text-emerald-700">{formatMonto(totalIngresos, moneda)}</td>
                                <td className="px-3 py-3 text-right text-amber-700">{formatMonto(totalEgresos, moneda)}</td>
                                <td className="px-3 py-3 text-right text-slate-800">{formatMonto(totalIngresos - totalEgresos, moneda)}</td>
                                {hasPermiso('caja_chica', 'eliminar') && <td className="px-3 py-3"></td>}
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal caja */}
      {modalCaja && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && cerrarModalCaja()}>
          <div className="card w-full max-w-md p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modalCaja === 'crear' ? 'Nueva caja' : 'Editar caja'}
            </h2>
            <form onSubmit={handleSubmitCaja} className="space-y-4">
              {modalCaja === 'crear' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nivel</label>
                  <select
                    value={formCaja.nivel ?? 'sub_caja'}
                    onChange={(e) => setFormCaja({ ...formCaja, nivel: e.target.value as 'central' | 'sub_caja' })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  >
                    {NIVELES.map((n) => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {modalCaja === 'crear' && formCaja.nivel === 'sub_caja' && cajasCentrales.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Caja Central (origen de fondos)</label>
                  <select
                    value={formCaja.cajaPadreId ?? ''}
                    onChange={(e) => setFormCaja({ ...formCaja, cajaPadreId: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  >
                    <option value="">Sin asignar</option>
                    {cajasCentrales.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formCaja.nombre ?? ''}
                  onChange={(e) => setFormCaja({ ...formCaja, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsable</label>
                <input
                  type="text"
                  value={formCaja.responsableNombre ?? ''}
                  onChange={(e) => setFormCaja({ ...formCaja, responsableNombre: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  placeholder="Nombre del responsable"
                />
              </div>
              {(formCaja.nivel ?? 'sub_caja') === 'sub_caja' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Usuario que puede ver y manejar</label>
                  <select
                    value={formCaja.usuarioAsignadoId ?? ''}
                    onChange={(e) => setFormCaja({ ...formCaja, usuarioAsignadoId: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  >
                    <option value="">Ninguno (todos los que tengan permiso)</option>
                    {systemUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>{u.email} · {u.displayName || '—'}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Al asignar, el usuario verá solo esta caja (además de configurar en Usuarios).</p>
                </div>
              )}
              {((formCaja.nivel ?? 'sub_caja') === 'central') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta que fondea (Flujo de fondos)</label>
                  <select
                    value={formCaja.cuentaFondoId ?? ''}
                    onChange={(e) => setFormCaja({ ...formCaja, cuentaFondoId: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  >
                    <option value="">Ninguna</option>
                    {cuentasFondo.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">La Caja Central recibe ingresos y paga egresos desde esta cuenta</p>
                </div>
              )}
              {modalCaja === 'crear' && formCaja.nivel === 'central' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Saldo inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCaja.saldoInicial ?? ''}
                    onChange={(e) => setFormCaja({ ...formCaja, saldoInicial: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tope máximo (sub-caja)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCaja.montoMaximo ?? ''}
                    onChange={(e) => setFormCaja({ ...formCaja, montoMaximo: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                  <select
                    value={formCaja.moneda ?? 'ARS'}
                    onChange={(e) => setFormCaja({ ...formCaja, moneda: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  >
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select
                  value={formCaja.estado ?? 'activa'}
                  onChange={(e) => setFormCaja({ ...formCaja, estado: e.target.value as 'activa' | 'cerrada' })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
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
                <button type="button" onClick={cerrarModalCaja} disabled={saving} className="btn-secondary py-2.5 px-4">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal movimiento */}
      {modalMov && cajaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && cerrarModalMov()}>
          <div className="card w-full max-w-md p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modalMov === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
            </h2>
            <form onSubmit={handleSubmitMov} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMov.monto ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, monto: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                />
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
              {modalMov === 'egreso' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                  <select
                    value={formMov.categoria ?? ''}
                    onChange={(e) => setFormMov({ ...formMov, categoria: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  >
                    {CATEGORIAS_EGRESO.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formMov.descripcion ?? ''}
                  onChange={(e) => setFormMov({ ...formMov, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  placeholder="Detalle del movimiento"
                />
                {(() => {
                  const descs = movimientos
                    .map((m) => m.descripcion?.trim())
                    .filter((d): d is string => !!d);
                  const counts = new Map<string, number>();
                  descs.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
                  const frecuentes = [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([d]) => d);
                  if (frecuentes.length === 0) return null;
                  return (
                    <div className="mt-2">
                      <span className="text-xs text-slate-500">Detalles frecuentes: </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {frecuentes.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setFormMov((f) => ({
                              ...f,
                              descripcion: f.descripcion ? `${f.descripcion} ${d}`.trim() : d,
                            }))}
                            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700"
                          >
                            {d.length > 25 ? d.slice(0, 24) + '…' : d}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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

      {/* Modal transferir a sub-caja */}
      {modalTransferir && cajaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !saving && setModalTransferir(false)}>
          <div className="card w-full max-w-md p-4 sm:p-6 border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Transferir fondo a sub-caja</h2>
            <form onSubmit={handleTransferir} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub-caja destino *</label>
                <select
                  value={formTransferir.subCajaId}
                  onChange={(e) => setFormTransferir({ ...formTransferir, subCajaId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {subCajas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.responsableNombre ?? '—'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formTransferir.monto || ''}
                  onChange={(e) => setFormTransferir({ ...formTransferir, monto: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formTransferir.fecha}
                  onChange={(e) => setFormTransferir({ ...formTransferir, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-blue-700 text-white rounded-xl hover:bg-blue-800 disabled:opacity-50">
                  Transferir
                </button>
                <button type="button" onClick={() => setModalTransferir(false)} disabled={saving} className="btn-secondary py-2.5 px-4">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal compra USD */}
      {modalCompraUSD && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !saving && setModalCompraUSD(false)}>
          <div className="card w-full max-w-md p-4 sm:p-6 border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Compra de USD</h2>
            <p className="text-sm text-slate-600 mb-4">
              Se registrará egreso en caja ARS e ingreso en caja USD automáticamente, usando la cotización indicada.
            </p>
            <form onSubmit={handleCompraUSD} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Caja origen (ARS)</label>
                <select
                  value={formCompraUSD.cajaArsId}
                  onChange={(e) => setFormCompraUSD({ ...formCompraUSD, cajaArsId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {cajasArs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} — Saldo: {formatMonto(c.saldoActual ?? 0, 'ARS')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Caja destino (USD)</label>
                <select
                  value={formCompraUSD.cajaUsdId}
                  onChange={(e) => setFormCompraUSD({ ...formCompraUSD, cajaUsdId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {cajasUsd.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} — Saldo: {formatMonto(c.saldoActual ?? 0, 'USD')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto (ARS)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formCompraUSD.montoPesos || ''}
                    onChange={(e) => setFormCompraUSD({ ...formCompraUSD, montoPesos: Number(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    placeholder="Ej: 100000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cotización (ARS/USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formCompraUSD.cotizacion || ''}
                    onChange={(e) => setFormCompraUSD({ ...formCompraUSD, cotizacion: Number(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    placeholder="Ej: 1050"
                    required
                  />
                </div>
              </div>
              {formCompraUSD.montoPesos > 0 && formCompraUSD.cotizacion > 0 && (
                <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                  Recibirás: <strong>{((formCompraUSD.montoPesos / formCompraUSD.cotizacion)).toFixed(2)} USD</strong>
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formCompraUSD.fecha}
                  onChange={(e) => setFormCompraUSD({ ...formCompraUSD, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={formCompraUSD.descripcion}
                  onChange={(e) => setFormCompraUSD({ ...formCompraUSD, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  placeholder="Ej: Compra efectuada en..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                  Registrar compra
                </button>
                <button type="button" onClick={() => setModalCompraUSD(false)} disabled={saving} className="btn-secondary py-2.5 px-4">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cierre */}
      {modalCierre && cajaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !saving && setModalCierre(false)}>
          <div className="card w-full max-w-md p-4 sm:p-6 border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Registrar cierre de caja</h2>
            <p className="text-sm text-slate-600 mb-4">
              Saldo actual: <strong>{formatMonto(cajaSeleccionada.saldoActual ?? 0, cajaSeleccionada.moneda ?? 'ARS')}</strong>
            </p>
            <form onSubmit={handleCrearCierre} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formCierre.fecha}
                  onChange={(e) => setFormCierre({ ...formCierre, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={formCierre.tipo}
                  onChange={(e) => setFormCierre({ ...formCierre, tipo: e.target.value as 'diario' | 'mensual' })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                >
                  <option value="diario">Diario</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  value={formCierre.observaciones}
                  onChange={(e) => setFormCierre({ ...formCierre, observaciones: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  placeholder="Opcional"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-slate-600 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50">
                  Registrar
                </button>
                <button type="button" onClick={() => setModalCierre(false)} disabled={saving} className="btn-secondary py-2.5 px-4">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal rendición */}
      {modalRendicion && cajaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && setModalRendicion(false)}>
          <div className="card w-full max-w-lg p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Nueva rendición (comprobantes)</h2>
            <p className="text-sm text-slate-600 mb-4">El responsable trae los tickets. Al aprobar, se registran gastos y se repone el fondo.</p>
            <form onSubmit={handleCrearRendicion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formRendicion.fecha}
                  onChange={(e) => setFormRendicion({ ...formRendicion, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-700">Comprobantes</label>
                  <button type="button" onClick={agregarItemRendicion} className="text-sm text-blue-600 hover:underline">+ Agregar</button>
                </div>
                <div className="space-y-3">
                  {formRendicion.items.map((item, i) => (
                    <div key={i} className="p-3 border border-slate-300 rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Monto"
                          value={item.monto || ''}
                          onChange={(e) => actualizarItemRendicion(i, 'monto', Number(e.target.value))}
                          className="flex-1 px-3 py-2 border rounded-lg"
                        />
                        <select
                          value={item.categoria}
                          onChange={(e) => actualizarItemRendicion(i, 'categoria', e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg"
                        >
                          {CATEGORIAS_EGRESO.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => quitarItemRendicion(i)} className="text-red-600 px-2">×</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Descripción (opcional)"
                        value={item.descripcion ?? ''}
                        onChange={(e) => actualizarItemRendicion(i, 'descripcion', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || formRendicion.items.every((i) => !i.monto || i.monto <= 0)} className="flex-1 py-2.5 px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50">
                  Crear rendición
                </button>
                <button type="button" onClick={() => setModalRendicion(false)} disabled={saving} className="btn-secondary py-2.5 px-4">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
