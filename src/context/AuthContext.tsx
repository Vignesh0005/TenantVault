import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import { TENANT_KEY, getToken, setApiTenant, setToken } from '@/api/client';
import type { AuthResponse, RegisterPayload, Tenant, User } from '@/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  tenants: Tenant[];
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshTenants: () => Promise<Tenant[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'));

  const clearSession = useCallback(() => {
    setToken(null);
    localStorage.removeItem(TENANT_KEY);
    setApiTenant(null);
    queryClient.clear();
    setTokenState(null);
    setUser(null);
    setTenants([]);
    setStatus('anonymous');
  }, [queryClient]);

  // Hydrate the session once on boot.
  useEffect(() => {
    const stored = getToken();
    if (!stored) return;
    let cancelled = false;
    authApi
      .getMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me.user);
        setTenants(me.tenants);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const applyAuth = useCallback(
    (res: AuthResponse) => {
      queryClient.clear();
      setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      setTenants(res.tenants);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      applyAuth(await authApi.login(email, password));
    },
    [applyAuth],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      applyAuth(await authApi.register(payload));
    },
    [applyAuth],
  );

  // Tenant access is checked against the JWT's tenant_ids claim, so membership changes need a new token.
  const refreshTenants = useCallback(async () => {
    const res = await authApi.refresh();
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setTenants(res.tenants);
    return res.tenants;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, tenants, status, login, register, logout: clearSession, refreshTenants }),
    [user, token, tenants, status, login, register, clearSession, refreshTenants],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
