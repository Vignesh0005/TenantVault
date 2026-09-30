import { useEffect } from 'react';
import { Compass } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found · TenantVault';
  }, []);

  return (
    <div className="stagger flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <span className="absolute inset-0 animate-ping rounded-3xl bg-accent/15 [animation-duration:2.5s]" />
        <span className="relative flex h-20 w-20 animate-float items-center justify-center rounded-3xl accent-gradient text-white shadow-xl shadow-accent/30">
          <Compass className="h-10 w-10 animate-[spin_12s_linear_infinite]" />
        </span>
      </div>
      <p className="text-gradient animate-gradient-x text-6xl font-black tracking-tight">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">The page you are looking for does not exist or has moved.</p>
      <div>
        <LinkButton to="/dashboard" className="mt-6">
          Back to dashboard
        </LinkButton>
      </div>
    </div>
  );
}
