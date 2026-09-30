import { useCallback } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { getSecurityContext } from '@/api/tenants';
import { useTenant } from '@/context/TenantContext';
import { emitToast } from '@/lib/errors';
import type { Tenant } from '@/types';

// Routes whose params reference a record owned by the previous tenant.
const TENANT_BOUND_ROUTES = ['/products/:id', '/products/:id/edit'];

export function useTenantSwitch() {
  const { currentTenant, setTenant } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (tenant: Tenant) => {
      if (tenant.slug === currentTenant?.slug) return;
      // setTenant wipes the query cache; pages remount (keyed by tenant) and refetch.
      setTenant(tenant);
      const onBoundRoute = TENANT_BOUND_ROUTES.some(
        (pattern) => matchPath(pattern, location.pathname) && location.pathname !== '/products/new',
      );
      if (onBoundRoute) navigate('/products', { replace: true });
      // Records the switch in the new tenant's audit log; the UI does not wait on it.
      getSecurityContext('switch').catch(() => undefined);
      emitToast('success', `Switched to ${tenant.name}`);
    },
    [currentTenant?.slug, setTenant, location.pathname, navigate],
  );
}
