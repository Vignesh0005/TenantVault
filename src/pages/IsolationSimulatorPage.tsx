import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LinkButton } from '@/components/ui/Button';
import { IsolationSimulator } from '@/components/security/IsolationSimulator';
import { useCurrentTenant } from '@/context/TenantContext';

export function IsolationSimulatorPage() {
  const tenant = useCurrentTenant();
  return (
    <>
      <PageHeader
        title="Isolation Simulator"
        description={
          <>
            Prove that nothing can cross the <span className="font-medium text-accent">{tenant.name}</span> boundary.
          </>
        }
        actions={
          <LinkButton to="/security" variant="secondary" icon={<ShieldCheck className="h-4 w-4" />}>
            View security log
          </LinkButton>
        }
      />
      <IsolationSimulator />
    </>
  );
}
