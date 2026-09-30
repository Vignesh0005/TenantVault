import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Building2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { createTenant } from '@/api/tenants';
import { AppShell } from '@/components/layout/AppShell';
import { ProductForm } from '@/components/products/ProductForm';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { getErrorMessage } from '@/lib/errors';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SecurityDashboardPage } from '@/pages/SecurityDashboardPage';
import { IsolationSimulatorPage } from '@/pages/IsolationSimulatorPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { AIAssistantPage } from '@/pages/AIAssistantPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

function TenantOnboarding() {
  const { user, logout, refreshTenants } = useAuth();
  const { setTenant } = useTenant();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const tenant = await createTenant(name.trim());
      await refreshTenants();
      setTenant(tenant);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create tenant'));
    } finally {
      setCreating(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTenants();
    } catch {
      setError('Could not load your tenants');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md card animate-scale-in p-8 text-center shadow-sm">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Building2 className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-semibold text-slate-900">You're not in any tenant yet</h1>
        <p className="mt-2 text-sm text-slate-500">
          Signed in as {user?.email}. Create a workspace to get started, or ask an admin to invite you.
        </p>

        <form onSubmit={onCreate} className="mt-6 space-y-3 text-left">
          <Input
            label="Workspace name"
            placeholder="Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full !bg-slate-900 hover:!bg-slate-800 dark:!bg-slate-700 dark:hover:!bg-slate-600" loading={creating}>
            Create workspace
          </Button>
        </form>

        <div className="mt-4 flex justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} loading={refreshing} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            I've been invited
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut className="h-3.5 w-3.5" />}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function RequireTenant({ children }: { children: ReactNode }) {
  const { currentTenant, tenants } = useTenant();
  if (tenants.length === 0 || !currentTenant) return <TenantOnboarding />;
  return <>{children}</>;
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <RequireTenant>
        <AppShell />
      </RequireTenant>
    </RequireAuth>
  );
}

function PublicOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/home" element={<HomePage />} />

      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/products/:id/edit" element={<ProductForm />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/security" element={<SecurityDashboardPage />} />
        <Route path="/security/simulator" element={<IsolationSimulatorPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/ai" element={<AIAssistantPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
