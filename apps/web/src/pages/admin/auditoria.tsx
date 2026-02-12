'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { usePermisos } from '@/context/PermisosContext';
import { getRecentAudit, getAuditFiltrado, type AuditEntry } from '@/services/auditService';
import { FileText } from 'lucide-react';

const MODULOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'inversores', label: 'Inversores' },
  { value: 'plazo_fijo', label: 'Plazos fijo' },
  { value: 'caja_chica', label: 'Caja chica' },
  { value: 'flujo_fondos', label: 'Flujo de fondos' },
];

function formatFecha(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AuditoriaPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { canVerModulo } = usePermisos();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [modulo, setModulo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!canVerModulo('auditoria')) router.replace('/admin/dashboard');
  }, [canVerModulo, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    const load = async () => {
      try {
        let data: AuditEntry[];
        if (modulo || desde || hasta) {
          data = await getAuditFiltrado({
            modulo: modulo || undefined,
            desde: desde ? `${desde}T00:00:00.000Z` : undefined,
            hasta: hasta ? `${hasta}T23:59:59.999Z` : undefined,
            limit: 200,
          });
        } else {
          data = await getRecentAudit(100);
        }
        setEntries(data);
      } catch (e) {
        console.error('[Auditoría] Error:', e);
        setEntries([]);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [user, modulo, desde, hasta]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-200">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminLayout title="Auditoría interna">
      <div className="max-w-6xl mx-auto space-y-6">
        <p className="text-slate-600 text-sm">
          Trazabilidad de todas las acciones en la plataforma: día, hora, movimiento detallado y usuario.
        </p>

        {/* Filtros */}
        <div className="card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Módulo</label>
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {MODULOS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center gap-2">
            <FileText size={20} />
            <span>Registro de auditoría</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            {loadingData ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No hay registros de auditoría para los filtros seleccionados.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-700">Fecha y hora</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-700">Acción</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-700">Módulo</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-700">Detalle</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-700">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatFecha(e.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {e.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.modulo}</td>
                      <td className="px-4 py-3 max-w-md truncate" title={e.detalle}>
                        {e.detalle || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                        {e.userId ? (
                          <span title={e.userId}>
                            {e.userEmail || e.userId.slice(0, 8) + '…'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
