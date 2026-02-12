'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSystemUser, createOrUpdateSystemUser } from '@/services/permisosService';
import type { SystemUser, Modulo, PermisosMap } from '@/types/permisos';
import { hasPermiso as checkHasPermiso, getCajasChicaPermitidas as getCajasPermitidas } from '@/services/permisosService';

interface PermisosContextType {
  systemUser: SystemUser | null;
  loading: boolean;
  activo: boolean;
  hasPermiso: (modulo: Modulo, accion: string) => boolean;
  canVerModulo: (modulo: Modulo) => boolean;
  getCajasChicaPermitidas: () => string[] | null;
}

const PermisosContext = createContext<PermisosContextType>({
  systemUser: null,
  loading: true,
  activo: false,
  hasPermiso: () => false,
  canVerModulo: () => false,
  getCajasChicaPermitidas: () => null,
});

export function PermisosProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSystemUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSystemUser(user.uid)
      .then(async (su) => {
        if (su) {
          setSystemUser(su);
        } else {
          const defaultUser: SystemUser = {
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName ?? undefined,
            rol: 'custom',
            activo: false,
          };
          try {
            await createOrUpdateSystemUser(user.uid, {
              email: defaultUser.email,
              displayName: defaultUser.displayName,
              rol: 'custom',
              activo: false,
            });
            const created = await getSystemUser(user.uid);
            setSystemUser(created ?? defaultUser);
          } catch {
            setSystemUser(defaultUser);
          }
        }
      })
      .catch(() => setSystemUser(null))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const hasPermiso = (modulo: Modulo, accion: string): boolean => {
    return checkHasPermiso(systemUser, modulo, accion);
  };

  const canVerModulo = (modulo: Modulo): boolean => {
    return hasPermiso(modulo, 'ver');
  };

  const getCajasChicaPermitidas = (): string[] | null => {
    return getCajasPermitidas(systemUser);
  };

  const activo = (systemUser?.activo !== false);

  return (
    <PermisosContext.Provider value={{ systemUser, loading, activo, hasPermiso, canVerModulo, getCajasChicaPermitidas }}>
      {children}
    </PermisosContext.Provider>
  );
}

export function usePermisos() {
  const ctx = useContext(PermisosContext);
  if (!ctx) throw new Error('usePermisos debe usarse dentro de PermisosProvider');
  return ctx;
}
