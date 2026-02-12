'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { listSystemUsers, updateSystemUser, resolvePermisos } from '@/services/permisosService';
import { listCajasChica } from '@/services/cajaChicaService';
import type { SystemUser, Rol, Modulo, PermisosMap } from '@/types/permisos';
import type { CajaChica } from '@/types/cajaChica';
import {
  ROL_LABELS,
  ROLES,
  MODULO_LABELS,
  ACCIONES_POR_MODULO,
  ACCION_LABELS,
} from '@/types/permisos';

export default function UsuariosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { hasPermiso, canVerModulo, loading: permLoading } = usePermisos();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<Partial<SystemUser>>({});
  const [saving, setSaving] = useState(false);
  const [cajasChica, setCajasChica] = useState<CajaChica[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (permLoading) return;
    if (!canVerModulo('usuarios')) {
      router.replace('/admin/dashboard');
      return;
    }
    listSystemUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [canVerModulo, permLoading, router]);

  const abrirEditar = (u: SystemUser) => {
    const efectivos = resolvePermisos(u);
    setForm({ ...u, permisos: efectivos });
    setModal(u);
    listCajasChica().then(setCajasChica).catch(() => setCajasChica([]));
  };

  const cerrarModal = () => {
    setModal(null);
    setForm({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id || !hasPermiso('usuarios', 'editar')) return;
    setSaving(true);
    try {
      await updateSystemUser(form.id, {
        rol: form.rol,
        permisos: form.permisos,
        email: form.email,
        displayName: form.displayName,
      }, user?.uid);
      toast.success('Usuario actualizado');
      cerrarModal();
      listSystemUsers().then(setUsers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const setPermiso = (modulo: Modulo, accion: string, value: boolean) => {
    setForm((f) => {
      const perm = (f.permisos ?? {}) as PermisosMap;
      const modPerm = perm[modulo] ?? {};
      return {
        ...f,
        permisos: {
          ...perm,
          [modulo]: { ...modPerm, [accion]: value },
        },
      };
    });
  };

  const getPermiso = (modulo: Modulo, accion: string): boolean => {
    const perm = (form.permisos ?? {}) as PermisosMap;
    return perm[modulo]?.[accion as keyof typeof perm[typeof modulo]] === true;
  };

  const getCajasChicaPermitidas = (): string[] => {
    const perm = (form.permisos ?? {}) as PermisosMap;
    const cc = perm.caja_chica as { cajasIds?: string[] } | undefined;
    return cc?.cajasIds ?? [];
  };

  const setCajasChicaPermitidas = (ids: string[]) => {
    setForm((f) => {
      const perm = (f.permisos ?? {}) as PermisosMap;
      const cc = (perm.caja_chica ?? {}) as Record<string, unknown>;
      const next = { ...cc };
      if (ids.length > 0) next.cajasIds = ids;
      else delete next.cajasIds; // Vacío = todas
      return {
        ...f,
        permisos: {
          ...perm,
          caja_chica: next as PermisosMap['caja_chica'],
        },
      };
    });
  };

  const toggleCajaChica = (cajaId: string) => {
    const actual = getCajasChicaPermitidas();
    if (actual.includes(cajaId)) {
      setCajasChicaPermitidas(actual.filter((id) => id !== cajaId));
    } else {
      setCajasChicaPermitidas([...actual, cajaId]);
    }
  };

  const canEdit = hasPermiso('usuarios', 'editar');

  if (authLoading || permLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-200">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminLayout title="Usuarios del sistema" backHref="/admin/dashboard" backLabel="Dashboard">
      <div className="max-w-4xl mx-auto space-y-6">
        <p className="text-slate-600 text-sm">
          Asigná roles y permisos por módulo. Super Admin y Administrador tienen acceso total.
          Administrativo puede tener permisos limitados (ej: ver inversores y caja chica, sin plazos fijo).
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="card-header">
              <h2 className="font-semibold text-slate-800">Usuarios</h2>
            </div>
            <div className="divide-y divide-slate-300">
              {users.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No hay usuarios registrados.</div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id ?? u.uid}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{u.email}</div>
                      <div className="text-sm text-slate-500">
                        {u.displayName ?? '—'} · {ROL_LABELS[u.rol ?? 'administrador']}
                        {u.uid === user?.uid && (
                          <span className="ml-2 text-blue-600">(vos)</span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => abrirEditar(u)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Editar permisos
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {modal && form && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => !saving && cerrarModal()}
          >
            <div
              className="card w-full max-w-2xl max-h-[90vh] flex flex-col border-slate-400"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-slate-800 p-4 border-b border-slate-300 shrink-0">
                Editar permisos: {form.email}
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 space-y-6 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rol</label>
                    <select
                      value={form.rol ?? 'administrador'}
                      onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                      className="w-full px-4 py-2 border border-slate-400 rounded-xl bg-slate-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROL_LABELS[r]}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Super Admin y Administrador tienen todo. Administrativo y Personalizado usan los permisos debajo.
                    </p>
                  </div>

                  {(form.rol === 'administrativo' || form.rol === 'custom') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">Permisos por módulo</label>
                      <div className="space-y-4">
                        {(Object.keys(ACCIONES_POR_MODULO) as Modulo[]).map((modulo) => (
                          <div key={modulo} className="p-3 border border-slate-300 rounded-xl">
                            <div className="font-medium text-slate-800 mb-2">{MODULO_LABELS[modulo]}</div>
                            <div className="flex flex-wrap gap-4">
                              {ACCIONES_POR_MODULO[modulo].map((accion) => (
                                <label key={accion} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={getPermiso(modulo, accion)}
                                    onChange={(e) => setPermiso(modulo, accion, e.target.checked)}
                                  />
                                  <span className="text-sm">{ACCION_LABELS[accion]}</span>
                                </label>
                              ))}
                            </div>
                            {modulo === 'caja_chica' && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="text-sm font-medium text-slate-700 mb-2">Cajas que puede ver</div>
                                <p className="text-xs text-slate-500 mb-2">Dejá vacío = todas. Marcá solo las que debe ver (ej: una sub-caja específica).</p>
                                <div className="flex flex-wrap gap-3">
                                  {cajasChica.map((c) => (
                                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={getCajasChicaPermitidas().includes(c.id ?? '')}
                                        onChange={() => toggleCajaChica(c.id!)}
                                      />
                                      <span className="text-sm">{c.nombre}</span>
                                      <span className="text-xs text-slate-500">({(c.nivel ?? 'sub_caja') === 'central' ? 'Central' : 'Sub'})</span>
                                    </label>
                                  ))}
                                  {cajasChica.length === 0 && (
                                    <span className="text-xs text-slate-400">No hay cajas creadas</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
                <div className="p-4 border-t border-slate-300 flex gap-3 shrink-0">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button type="button" onClick={cerrarModal} className="px-4 py-2 border border-slate-400 rounded-xl hover:bg-slate-100">
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
