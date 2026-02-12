'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { listInversores, createInversor, updateInversor, deleteInversor } from '@/services/inversorService';
import type { Inversor, TipoInversor, EstadoInversor } from '@/types/inversor';

const TIPOS: { value: TipoInversor; label: string }[] = [
  { value: 'persona_fisica', label: 'Persona física' },
  { value: 'persona_juridica', label: 'Persona jurídica' },
];

const ESTADOS: { value: EstadoInversor; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'pendiente_documentacion', label: 'Pendiente documentación' },
];

const INIT: Partial<Inversor> = {
  nombre: '',
  apellido: '',
  razonSocial: '',
  email: '',
  telefono: '',
  documento: '',
  tipo: 'persona_fisica',
  estado: 'activo',
};

export default function InversoresPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermiso, canVerModulo } = usePermisos();
  const [list, setList] = useState<Inversor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null);
  const [form, setForm] = useState<Partial<Inversor>>(INIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listInversores();
      setList(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canVerModulo('inversores')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    load();
  }, []);

  const filtrar = list.filter(
    (i) =>
      !busqueda ||
      i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (i.apellido && i.apellido.toLowerCase().includes(busqueda.toLowerCase())) ||
      i.email.toLowerCase().includes(busqueda.toLowerCase()) ||
      (i.documento && i.documento.includes(busqueda)) ||
      (i.razonSocial && i.razonSocial.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const abrirCrear = () => {
    setForm(INIT);
    setModal('crear');
    setError('');
  };

  const abrirEditar = (e: React.MouseEvent, inv: Inversor) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ ...inv });
    setModal('editar');
    setError('');
  };

  const cerrarModal = () => {
    setModal(null);
    setForm(INIT);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (modal === 'crear' && !hasPermiso('inversores', 'crear')) return;
    if (modal === 'editar' && !hasPermiso('inversores', 'editar')) return;
    const esJuridica = form.tipo === 'persona_juridica';
    if (esJuridica && !form.razonSocial?.trim()) {
      setError('Razón social es obligatoria');
      toast.error('Razón social es obligatoria');
      return;
    }
    if (!esJuridica && !form.nombre?.trim()) {
      setError('Nombre es obligatorio');
      toast.error('Nombre es obligatorio');
      return;
    }
    if (!form.email?.trim()) {
      setError('Email es obligatorio');
      toast.error('Email es obligatorio');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (modal === 'crear') {
        await createInversor(
          {
            nombre: (form.tipo === 'persona_juridica' ? form.razonSocial : form.nombre)?.trim() ?? '',
            apellido: form.apellido?.trim() || undefined,
            razonSocial: form.tipo === 'persona_juridica' ? form.razonSocial?.trim() : undefined,
            email: form.email.trim(),
            telefono: form.telefono?.trim() || undefined,
            documento: form.documento?.trim() || undefined,
            tipo: form.tipo ?? 'persona_fisica',
            estado: form.estado ?? 'activo',
          },
          user?.uid
        );
        toast.success('Inversor creado correctamente');
      } else if (modal === 'editar' && form.id) {
        const nombreVal = form.tipo === 'persona_juridica'
          ? (form.razonSocial ?? form.nombre)?.trim()
          : form.nombre?.trim();
        await updateInversor(form.id, {
          nombre: nombreVal ?? '',
          apellido: form.apellido?.trim() || undefined,
          razonSocial: form.razonSocial?.trim() || undefined,
          email: form.email.trim(),
          telefono: form.telefono?.trim() || undefined,
          documento: form.documento?.trim() || undefined,
          tipo: form.tipo ?? 'persona_fisica',
          estado: form.estado ?? 'activo',
        });
        toast.success('Inversor actualizado correctamente');
      }
      cerrarModal();
      load();
    } catch (err) {
      console.error('[Inversores] Error al guardar:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasPermiso('inversores', 'eliminar')) return;
    if (!confirm('¿Eliminar este inversor?')) return;
    deleteInversor(id)
      .then(() => {
        toast.success('Inversor eliminado');
        load();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar'));
  };

  const irADashboard = (inversorId: string) => router.push(`/admin/inversor-dashboard?id=${inversorId}`);

  return (
    <AdminLayout title="Inversores" backHref="/admin/dashboard" backLabel="Dashboard">
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        </div>
        {hasPermiso('inversores', 'crear') && (
          <button
            onClick={abrirCrear}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-blue-700 text-white rounded-xl hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm touch-manipulation"
          >
            + Nuevo inversor
          </button>
        )}
      </header>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, email, documento..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          <div className="block sm:hidden space-y-4">
            {filtrar.length === 0 ? (
              <div className="card-seccion p-6 text-center text-slate-600">No hay inversores.</div>
            ) : (
              filtrar.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => inv.id && irADashboard(inv.id)}
                  className="card p-5 cursor-pointer hover:border-slate-500"
                >
                  <div className="font-medium text-slate-800">
                    {inv.tipo === 'persona_juridica' ? inv.razonSocial || inv.nombre : `${inv.nombre} ${inv.apellido || ''}`.trim()}
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">{inv.email}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${inv.estado === 'activo' ? 'bg-green-100 text-green-800' : inv.estado === 'inactivo' ? 'bg-slate-200' : 'bg-amber-100 text-amber-800'}`}>
                      {ESTADOS.find((e) => e.value === inv.estado)?.label ?? inv.estado}
                    </span>
                    <span className="text-xs text-slate-500">{TIPOS.find((t) => t.value === inv.tipo)?.label}</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    {hasPermiso('inversores', 'editar') && (
                      <button onClick={(e) => abrirEditar(e, inv)} className="flex-1 sm:flex-initial py-2.5 px-4 min-h-[44px] rounded-lg bg-slate-200 hover:bg-slate-300 text-indigo-700 font-medium text-sm touch-manipulation">Editar</button>
                    )}
                    {hasPermiso('inversores', 'eliminar') && (
                      <button onClick={(e) => inv.id && handleDelete(e, inv.id)} className="flex-1 sm:flex-initial py-2.5 px-4 min-h-[44px] rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm touch-manipulation">Eliminar</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden sm:block card-seccion overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-100 border-b border-slate-400">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Nombre</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Estado</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrar.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">No hay inversores. Creá el primero.</td>
                    </tr>
                  ) : (
                    filtrar.map((inv) => (
                      <tr
                        key={inv.id}
                        onClick={() => inv.id && irADashboard(inv.id)}
                        className="border-b border-slate-300 hover:bg-slate-100 cursor-pointer transition"
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800">
                            {inv.tipo === 'persona_juridica' ? inv.razonSocial || inv.nombre : `${inv.nombre} ${inv.apellido || ''}`.trim()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{inv.email}</td>
                        <td className="py-3 px-4 text-slate-600">{TIPOS.find((t) => t.value === inv.tipo)?.label ?? inv.tipo}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            inv.estado === 'activo' ? 'bg-green-100 text-green-800' :
                            inv.estado === 'inactivo' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ESTADOS.find((e) => e.value === inv.estado)?.label ?? inv.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {hasPermiso('inversores', 'editar') && (
                            <button onClick={(e) => abrirEditar(e, inv)} className="text-blue-700 hover:underline text-sm mr-3 font-medium">Editar</button>
                          )}
                          {hasPermiso('inversores', 'eliminar') && (
                            <button onClick={(e) => inv.id && handleDelete(e, inv.id)} className="text-red-600 hover:underline text-sm">Eliminar</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => !saving && cerrarModal()}>
          <div className="bg-slate-100 rounded-xl shadow-xl border border-slate-400 w-full max-w-md p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{modal === 'crear' ? 'Nuevo inversor' : 'Editar inversor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoInversor })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                  {TIPOS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              {form.tipo === 'persona_juridica' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Razón social *</label>
                  <input type="text" value={form.razonSocial ?? ''} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Razón social" required />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                    <input type="text" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                    <input type="text" value={form.apellido ?? ''} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                  </div>
                </>
              )}
              {form.tipo === 'persona_juridica' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Persona de contacto</label>
                  <input type="text" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Nombre del responsable" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input type="text" value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Documento (DNI/CUIT)</label>
                <input type="text" value={form.documento ?? ''} onChange={(e) => setForm({ ...form, documento: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoInversor })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                  {ESTADOS.map((e) => (<option key={e.value} value={e.value}>{e.label}</option>))}
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? (<> <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando... </>) : 'Guardar'}
                </button>
                <button type="button" onClick={cerrarModal} disabled={saving} className="py-2.5 px-4 border border-slate-400 rounded-lg hover:bg-slate-200 text-slate-700">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
