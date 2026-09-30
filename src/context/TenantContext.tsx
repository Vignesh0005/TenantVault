import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { TENANT_KEY, getApiTenant, setApiTenant } from '@/api/client';
import { applyAccentColor } from '@/lib/tenantColors';
import type { Tenant } from '@/types';

export interface TenantContextValue {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  setTenant: (tenant: Tenant) => void;
  switcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readStoredSlug(): string | null {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? ((JSON.parse(raw) as Partial<Tenant>).slug ?? null) : null;
  } catch {
    return null;
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { tenants } = useAuth();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() => readStoredSlug());
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Only ever expose a tenant the user is actually a member of.
  const currentTenant = useMemo(
    () => tenants.find((t) => t.slug === selectedSlug) ?? tenants[0] ?? null,
    [tenants, selectedSlug],
  );

  // Sync the header value during render so no child query can fire with a stale tenant.
  const currentSlug = currentTenant?.slug ?? null;
  if (getApiTenant() !== currentSlug) setApiTenant(currentSlug);

  useLayoutEffect(() => {
    applyAccentColor(currentSlug);
  }, [currentSlug]);

  useEffect(() => {
    if (currentTenant) localStorage.setItem(TENANT_KEY, JSON.stringify(currentTenant));
  }, [currentTenant]);

  const setTenant = useCallback(
    (tenant: Tenant) => {
      if (tenant.slug === getApiTenant()) return;
      // Order matters: wipe cache and retarget the API before the new tenant name renders.
      queryClient.cancelQueries();
      queryClient.clear();
      setApiTenant(tenant.slug);
      localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
      applyAccentColor(tenant.slug);
      setSelectedSlug(tenant.slug);
      setSwitcherOpen(false);
    },
    [queryClient],
  );

  const value = useMemo<TenantContextValue>(
    () => ({ currentTenant, tenants, setTenant, switcherOpen, setSwitcherOpen }),
    [currentTenant, tenants, setTenant, switcherOpen],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>');
  return ctx;
}

/** For components rendered under <RequireTenant>, where a tenant is guaranteed. */
export function useCurrentTenant(): Tenant {
  const { currentTenant } = useTenant();
  if (!currentTenant) throw new Error('useCurrentTenant requires a selected tenant');
  return currentTenant;
}
