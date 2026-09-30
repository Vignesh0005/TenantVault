import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Modal } from '@/components/ui/Modal';
import { AccessDeniedCard } from '@/components/security/AccessDeniedCard';
import { useCurrentTenant } from '@/context/TenantContext';
import { onAccessDenied, type AccessDeniedPayload } from '@/lib/errors';

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden lg:left-64">
      <div className="absolute -right-32 -top-40 h-[28rem] w-[28rem] animate-blob rounded-full bg-accent/10 blur-3xl transition-colors duration-700" />
      <div
        className="absolute -left-24 top-1/3 h-80 w-80 animate-blob rounded-full bg-sky-300/10 blur-3xl"
        style={{ animationDelay: '-5s' }}
      />
      <div
        className="absolute bottom-[-10rem] right-1/4 h-96 w-96 animate-blob rounded-full bg-violet-300/10 blur-3xl"
        style={{ animationDelay: '-9s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(rgb(148_163_184/0.15)_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}

export function AppShell() {
  const tenant = useCurrentTenant();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [denied, setDenied] = useState<AccessDeniedPayload | null>(null);

  useEffect(() => onAccessDenied(setDenied), []);

  // A denial belongs to the page that caused it.
  useEffect(() => {
    setDenied(null);
  }, [location.pathname, tenant.id]);

  return (
    <div className="relative min-h-screen bg-slate-50">
      <Backdrop />
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="relative lg:pl-64">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        {/* Keyed by tenant: every page remounts on switch, so no state from the previous tenant survives. */}
        <main key={tenant.id} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <div key={location.pathname} className="animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      <Modal open={denied !== null} onClose={() => setDenied(null)} size="md" hideCloseButton>
        {denied && (
          <AccessDeniedCard
            reason={denied.reason}
            resource={denied.path}
            onDismiss={() => setDenied(null)}
            variant="plain"
          />
        )}
      </Modal>
    </div>
  );
}
