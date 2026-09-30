import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { getTenantColor } from '@/lib/tenantColors';
import { AuthShowcase } from '@/components/layout/AuthShowcase';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

interface DemoAccount {
  label: string;
  email: string;
  password: string;
  description: string;
  tenantSlug: string | null;
}

const DEMO_PASSWORD = 'Password123!';

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Acme Corp', email: 'acme@demo.com', password: DEMO_PASSWORD, description: 'Admin · Acme', tenantSlug: 'acme-corp' },
  { label: 'Globex Ltd', email: 'globex@demo.com', password: DEMO_PASSWORD, description: 'Admin · Globex', tenantSlug: 'globex-ltd' },
  { label: 'Initech', email: 'initech@demo.com', password: DEMO_PASSWORD, description: 'Admin · Initech', tenantSlug: 'initech' },
  {
    label: 'Multi-tenant',
    email: 'multi@demo.com',
    password: DEMO_PASSWORD,
    description: 'Admin · Acme, Staff · Globex, Viewer · Initech',
    tenantSlug: null,
  },
];

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    document.title = 'Sign in · TenantVault';
  }, []);

  useEffect(() => {
    if (status === 'authenticated') navigate(from, { replace: true });
  }, [status, from, navigate]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await login(email, password);
    } catch (err) {
      const code = getErrorStatus(err);
      setServerError(code === 401 ? 'Invalid email or password' : getErrorMessage(err, 'Unable to sign in'));
    }
  });

  const fillDemo = (account: DemoAccount) => {
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
    setServerError(null);
  };

  return (
    <div className="flex min-h-screen">
      <AuthShowcase />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <ThemeToggle className="absolute right-4 top-4 z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-80 w-80 animate-blob rounded-full bg-blue-200/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 animate-blob rounded-full bg-emerald-200/40 blur-3xl [animation-delay:-7s]" />
        </div>
        <div className="stagger relative w-full max-w-md space-y-8">
          <div>
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold">TenantVault</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to your isolated workspace.</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {serverError && (
              <div className="flex animate-fade-in items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {serverError}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              {...register('password')}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full !bg-gradient-to-r !from-slate-900 !via-slate-800 !to-slate-900 !shadow-slate-900/25 dark:!from-white dark:!via-slate-200 dark:!to-white dark:!text-slate-900"
              loading={isSubmitting}
            >
              Sign in
            </Button>
          </form>

          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">Demo credentials</h3>
              <span className="ml-auto font-mono text-xs text-slate-400">pw: {DEMO_PASSWORD}</span>
            </div>
            <div className="stagger grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="group flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:scale-[0.98]"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-100 transition-transform duration-300 group-hover:scale-125"
                    style={{
                      background: account.tenantSlug
                        ? getTenantColor(account.tenantSlug)
                        : 'conic-gradient(#2563eb, #16a34a, #dc2626, #2563eb)',
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{account.label}</span>
                    <span className="block truncate text-xs text-slate-500">{account.email}</span>
                    <span className="block text-[11px] text-slate-400">{account.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-slate-500">
            New to TenantVault?{' '}
            <Link to="/register" className="font-medium text-slate-900 hover:underline">
              Create an account
            </Link>
            <span className="mx-2 text-slate-300">·</span>
            <Link to="/home" className="font-medium text-slate-900 hover:underline">
              About TenantVault
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
