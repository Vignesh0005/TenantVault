import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { AuthShowcase } from '@/components/layout/AuthShowcase';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const registerSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/\d/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { register: registerUser, status } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    document.title = 'Create account · TenantVault';
  }, []);

  useEffect(() => {
    if (status === 'authenticated') navigate('/dashboard', { replace: true });
  }, [status, navigate]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await registerUser({ email, password });
    } catch (err) {
      setServerError(
        getErrorStatus(err) === 409
          ? 'An account with this email already exists'
          : getErrorMessage(err, 'Unable to create account'),
      );
    }
  });

  return (
    <div className="flex min-h-screen">
      <AuthShowcase />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <ThemeToggle className="absolute right-4 top-4 z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-80 w-80 animate-blob rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 animate-blob rounded-full bg-blue-200/40 blur-3xl [animation-delay:-7s]" />
        </div>
      <div className="stagger relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span className="text-xl font-semibold">TenantVault</span>
        </div>

        <div className="card p-8 shadow-xl shadow-slate-200/60">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign up, then create an isolated workspace for your inventory.
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            {serverError && (
              <div className="flex animate-fade-in items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {serverError}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              required
              autoComplete="new-password"
              leftIcon={<Lock className="h-4 w-4" />}
              hint="At least 8 characters, including a number"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm password"
              type="password"
              required
              autoComplete="new-password"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full !bg-gradient-to-r !from-slate-900 !via-slate-800 !to-slate-900 !shadow-slate-900/25 dark:!from-white dark:!via-slate-200 dark:!to-white dark:!text-slate-900"
              loading={isSubmitting}
            >
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}
