'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import {
  listCuentasFondo,
  createCuentaFondo,
  updateCuentaFondo,
  deleteCuentaFondo,
  listMovimientosFondo,
} from '@/services/flujoFondosService';
import { listInversores } from '@/services/inversorService';
import { listCajasChica } from '@/services/cajaChicaService';
import type { CuentaFondo, TipoCuenta, SaldoInicialTipo } from '@/types/flujoFondos';
import type { MovimientoFondo } from '@/types/flujoFondos';
import type { Inversor } from '@/types/inversor';
import type { CajaChica } from '@/types/cajaChica';
import { Landmark } from 'lucide-react';

const TIPOS_CUENTA: { value: TipoCuenta; label: string }[] = [
  { value: 'banco', label: 'Banco' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'fondo_inversion', label: 'Fondo inversión' },
];

const MONEDAS = ['ARS', 'USD'];

const formatMonto = (n: number, moneda: string) =>
  `${moneda} ${typeof n === 'number' ? n.toLocaleString('es-AR') : '0'}`;

const nombreDisplay = (inv: Inversor) =>
  inv.tipo === 'persona_juridica' ? inv.razonSocial || inv.nombre : `${inv.nombre} ${inv.apellido || ''}`.trim();

export default function CuentasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermiso, canVerModulo } = usePermisos();
  const [cuentas, setCuentas] = useState<CuentaFondo[]>([]);
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [cajas, setCajas] = useState<CajaChica[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFondo[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<{ id: string | null; label: string } | null>(null);
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null);
  const [form, setForm] = useState<Partial<CuentaFondo>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [cuentasData, inv, cajasData] = await Promise.all([
        listCuentasFondo(),
        listInversores(),
        canVerModulo('caja_chica') ? listCajasChica() : Promise.resolve([]),
      ]);
      setCuentas(cuentasData);
      setInversores(inv);
      setCajas(cajasData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canVerModulo('cuentas')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!clienteSeleccionado) {
      setMovimientos([]);
      return;
    }
    if (clienteSeleccionado.id) {
      listMovimientosFondo({ inversorId: clienteSeleccionado.id })
        .then(setMovimientos)
        .catch(() => setMovimientos([]));
    } else {
      setMovimientos([]);
    }
  }, [clienteSeleccionado?.id]);

  const cuentasGeneral = cuentas.filter((c) => !c.inversorId);
  const cuentasClienteSeleccionado = clienteSeleccionado
    ? clienteSeleccionado.id
      ? cuentas.filter((c) => c.inversorId === clienteSeleccionado.id)
      : cuentas.filter((c) => !c.inversorId)
    : [];

  const cuentasARS = cuentasClienteSeleccionado.filter((c) => (c.moneda ?? 'ARS') === 'ARS');
  const cuentasUSD = cuentasClienteSeleccionado.filter((c) => (c.moneda ?? '') === 'USD');
  const totalARS = cuentasARS.reduce((s, c) => s + (c.saldoActual ?? 0), 0);
  const totalUSD = cuentasUSD.reduce((s, c) => s + (c.saldoActual ?? 0), 0);

  const abrirCrear = () => {
    setForm({
      nombre: '',
      tipo: 'banco',
      moneda: 'ARS',
      saldoInicial: 0,
      saldoActual: 0,
      activa: true,
      inversorId: clienteSeleccionado?.id ?? '',
    });
    setModal('crear');
    setError('');
  };

  const abrirEditar = (e: React.MouseEvent, c: CuentaFondo) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ ...c });
    setModal('editar');
    setError('');
  };

  const cerrarModal = () => {
    setModal(null);
    setForm({});
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (modal === 'crear' && !hasPermiso('cuentas', 'crear')) return;
    if (modal === 'editar' && !hasPermiso('cuentas', 'editar')) return;
    if (!form.nombre?.trim()) {
      setError('Nombre es obligatorio');
      toast.error('Nombre es obligatorio');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (modal === 'crear') {
        await createCuentaFondo(
          {
            nombre: form.nombre.trim(),
            tipo: form.tipo ?? 'banco',
            moneda: form.moneda ?? 'ARS',
            saldoInicial: Number(form.saldoInicial) || 0,
            saldoActual: Number(form.saldoActual) ?? Number(form.saldoInicial) ?? 0,
            saldoInicialTipo: form.saldoInicialTipo ?? 'historico',
            activa: form.activa !== false,
            inversorId: form.inversorId?.trim() || undefined,
            cajaCentralId: form.cajaCentralId?.trim() || undefined,
          },
          user?.uid
        );
        toast.success('Cuenta creada');
      } else if (modal === 'editar' && form.id) {
        await updateCuentaFondo(
          form.id,
          {
            nombre: form.nombre.trim(),
            tipo: form.tipo ?? 'banco',
            moneda: form.moneda ?? 'ARS',
            saldoActual: Number(form.saldoActual) ?? 0,
            saldoInicialTipo: form.saldoInicialTipo,
            activa: form.activa !== false,
            inversorId: form.inversorId?.trim() || undefined,
            cajaCentralId: form.cajaCentralId?.trim() || undefined,
          },
          user?.uid
        );
        toast.success('Cuenta actualizada');
      }
      cerrarModal();
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!hasPermiso('cuentas', 'eliminar')) return;
    if (!confirm('¿Eliminar esta cuenta?')) return;
    try {
      await deleteCuentaFondo(id, user?.uid);
      toast.success('Cuenta eliminada');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const cajasCentrales = cajas.filter((c) => (c.nivel ?? 'sub_caja') === 'central');

  const itemsParaLista = inversores
    .map((inv) => ({
      id: inv.id!,
      label: nombreDisplay(inv),
      cuentas: cuentas.filter((c) => c.inversorId === inv.id),
    }))
    .concat(
      cuentasGeneral.length > 0
        ? [{ id: null as string | null, label: 'Cuentas generales', cuentas: cuentasGeneral }]
        : []
    );

  const itemsFiltrados = busqueda
    ? itemsParaLista.filter((item) =>
        item.label.toLowerCase().includes(busqueda.toLowerCase())
      )
    : itemsParaLista;

  return (
    <AdminLayout title="Cuentas" backHref="/admin/dashboard" backLabel="Dashboard">
      <div className="space-y-4 max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 border border-slate-400 rounded-xl bg-slate-50 text-sm w-full sm:max-w-xs"
          />
          {hasPermiso('cuentas', 'crear') && (
            <button
              onClick={abrirCrear}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold transition shadow-sm"
            >
              Nueva cuenta
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista de clientes */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-800">Clientes</h2>
              <p className="text-xs text-slate-500 mt-1">
                {itemsParaLista.length} cliente{itemsParaLista.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Cargando...</div>
              ) : itemsFiltrados.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  {busqueda ? 'No hay clientes que coincidan' : 'No hay cuentas asignadas a inversores. Creá una cuenta y asignale un inversor.'}
                </div>
              ) : (
                itemsFiltrados.map((item) => (
                  <div
                    key={item.id ?? '_general'}
                    onClick={() => setClienteSeleccionado({ id: item.id, label: item.label })}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                      clienteSeleccionado?.id === item.id ? 'bg-sky-50 border-l-4 border-sky-600' : ''
                    }`}
                  >
                    <div className="font-medium text-slate-800">{item.label}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {item.cuentas.length} cuenta{item.cuentas.length !== 1 ? 's' : ''}
                      {item.cuentas.length > 0 && (
                        <>
                          {' '}
                          · ARS: {item.cuentas.filter((c) => (c.moneda ?? 'ARS') === 'ARS').reduce((s, c) => s + (c.saldoActual ?? 0), 0).toLocaleString('es-AR')}
                          {item.cuentas.some((c) => (c.moneda ?? '') === 'USD') && (
                            <>
                              {' '}
                              · USD: {item.cuentas.filter((c) => (c.moneda ?? '') === 'USD').reduce((s, c) => s + (c.saldoActual ?? 0), 0).toLocaleString('es-AR')}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detalle: cuentas y movimientos */}
          <div className="lg:col-span-2 space-y-4">
            {clienteSeleccionado ? (
              <>
                <div className="card p-4">
                  <h2 className="font-semibold text-slate-800 mb-1">{clienteSeleccionado.label}</h2>
                  <div className="flex gap-2 mt-2">
                    {clienteSeleccionado.id && (
                      <Link
                        href={`/admin/inversor-dashboard?id=${clienteSeleccionado.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver inversor →
                      </Link>
                    )}
                    <Link href="/admin/flujo-fondos" className="text-sm text-blue-600 hover:underline">
                      Flujo de fondos →
                    </Link>
                  </div>
                </div>

                {/* Cuentas en pesos */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Pesos (ARS)</h3>
                    <p className="text-lg font-bold text-slate-900 mt-1">{formatMonto(totalARS, 'ARS')}</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {cuentasARS.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">Sin cuentas en pesos</div>
                    ) : (
                      cuentasARS.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                              <Landmark size={20} className="text-sky-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{c.nombre}</p>
                              <p className="text-xs text-slate-500">{TIPOS_CUENTA.find((t) => t.value === c.tipo)?.label ?? c.tipo}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{formatMonto(c.saldoActual ?? 0, 'ARS')}</p>
                            <div className="flex gap-1">
                              <Link
                                href={`/admin/flujo-fondos?cuentaId=${c.id}`}
                                className="py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                              >
                                Movimientos
                              </Link>
                              {hasPermiso('cuentas', 'editar') && (
                                <button onClick={(e) => abrirEditar(e, c)} className="py-1.5 px-2.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md">
                                  Editar
                                </button>
                              )}
                              {hasPermiso('cuentas', 'eliminar') && (
                                <button onClick={() => c.id && handleDelete(c.id)} className="py-1.5 px-2.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md">
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cuentas en dólares */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Dólares (USD)</h3>
                    <p className="text-lg font-bold text-slate-900 mt-1">{formatMonto(totalUSD, 'USD')}</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {cuentasUSD.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">Sin cuentas en dólares</div>
                    ) : (
                      cuentasUSD.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                              <Landmark size={20} className="text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{c.nombre}</p>
                              <p className="text-xs text-slate-500">{TIPOS_CUENTA.find((t) => t.value === c.tipo)?.label ?? c.tipo}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{formatMonto(c.saldoActual ?? 0, 'USD')}</p>
                            <div className="flex gap-1">
                              <Link href={`/admin/flujo-fondos?cuentaId=${c.id}`} className="py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md">
                                Movimientos
                              </Link>
                              {hasPermiso('cuentas', 'editar') && (
                                <button onClick={(e) => abrirEditar(e, c)} className="py-1.5 px-2.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md">
                                  Editar
                                </button>
                              )}
                              {hasPermiso('cuentas', 'eliminar') && (
                                <button onClick={() => c.id && handleDelete(c.id)} className="py-1.5 px-2.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md">
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Movimientos del inversor */}
                {clienteSeleccionado.id && (
                  <div className="card overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">Movimientos</h3>
                      <Link href="/admin/flujo-fondos" className="text-sm text-blue-600 hover:underline">
                        Ver todos en Flujo de fondos →
                      </Link>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto">
                      {movimientos.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">Sin movimientos</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-4 font-medium text-slate-600">Fecha</th>
                              <th className="text-left py-2 px-4 font-medium text-slate-600">Categoría</th>
                              <th className="text-right py-2 px-4 font-medium text-slate-600">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movimientos.slice(0, 50).map((m) => {
                              const esEntrada = !!m.cuentaDestinoId && !m.cuentaOrigenId;
                              const signo = esEntrada ? '+' : '−';
                              return (
                                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                  <td className="py-2 px-4 text-slate-600">{m.fecha}</td>
                                  <td className="py-2 px-4">{m.categoria || m.descripcion || '—'}</td>
                                  <td className={`py-2 px-4 text-right font-medium ${esEntrada ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {signo} {formatMonto(m.monto, m.moneda ?? 'ARS')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                      {movimientos.length > 50 && (
                        <div className="p-2 text-center text-xs text-slate-500">
                          Mostrando últimos 50 · <Link href="/admin/flujo-fondos" className="text-blue-600 hover:underline">Ver todos</Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {hasPermiso('cuentas', 'crear') && (
                  <button
                    onClick={abrirCrear}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-400 text-sm font-medium"
                  >
                    + Nueva cuenta para este cliente
                  </button>
                )}
              </>
            ) : (
              <div className="card p-12 text-center">
                <Landmark size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-medium">Seleccioná un cliente</p>
                <p className="text-sm text-slate-500 mt-1">
                  Elegí un cliente de la lista para ver sus cuentas (ARS / USD) y movimientos.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && cerrarModal()}>
          <div className="card w-full max-w-md p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto border-slate-400" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modal === 'crear' ? 'Nueva cuenta' : 'Editar cuenta'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre ?? ''}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={form.tipo ?? 'banco'}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCuenta })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                >
                  {TIPOS_CUENTA.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <select
                  value={form.moneda ?? 'ARS'}
                  onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Caja Central asociada (opcional)</label>
                <select
                  value={form.cajaCentralId ?? ''}
                  onChange={(e) => setForm({ ...form, cajaCentralId: e.target.value || undefined })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                >
                  <option value="">Ninguna</option>
                  {cajasCentrales.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inversor</label>
                <select
                  value={form.inversorId ?? ''}
                  onChange={(e) => setForm({ ...form, inversorId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                >
                  <option value="">Cuenta general (sin inversor)</option>
                  {inversores.map((i) => (
                    <option key={i.id} value={i.id}>
                      {nombreDisplay(i)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {modal === 'crear' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Saldo inicial</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.saldoInicial ?? 0}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            saldoInicial: Number(e.target.value),
                            saldoActual: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tipo saldo inicial</label>
                      <select
                        value={form.saldoInicialTipo ?? 'historico'}
                        onChange={(e) => setForm({ ...form, saldoInicialTipo: e.target.value as SaldoInicialTipo })}
                        className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                      >
                        <option value="historico">Histórico</option>
                        <option value="nuevo">Nuevo</option>
                      </select>
                    </div>
                  </>
                )}
                {modal === 'editar' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Saldo actual</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.saldoActual ?? 0}
                      onChange={(e) => setForm({ ...form, saldoActual: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.activa !== false}
                    onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Cuenta activa</span>
                </label>
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
                <button type="button" onClick={cerrarModal} disabled={saving} className="btn-secondary py-2.5 px-4">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
