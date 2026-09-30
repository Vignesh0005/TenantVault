import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, EyeOff, Info, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';

interface AccessDeniedCardProps {
  reason: string;
  resource?: string | null;
  onDismiss?: () => void;
  /** `card` renders its own container; `plain` is for use inside a modal. */
  variant?: 'card' | 'plain';
}

export function AccessDeniedCard({ reason, resource, onDismiss, variant = 'card' }: AccessDeniedCardProps) {
  const { user } = useAuth();
  const { currentTenant, tenants, setSwitcherOpen } = useTenant();

  const openSwitcher = () => {
    onDismiss?.();
    // Let the modal close first so its outside-click handler doesn't immediately close the switcher.
    window.setTimeout(() => setSwitcherOpen(true), 0);
  };

  const content = (
    <div className="text-center">
      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-red-100 opacity-60" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/60">
          <ShieldX className="h-8 w-8 text-red-600" />
        </span>
      </div>

      <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-red-700">{reason}</p>

      <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Info className="h-3.5 w-3.5" />
          Why was this blocked?
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Signed in as</dt>
            <dd className="truncate font-medium text-slate-800">{user?.email ?? 'Unknown user'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Active tenant</dt>
            <dd className="truncate font-medium text-slate-800">{currentTenant?.name ?? 'None'}</dd>
          </div>
          {currentTenant && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Your role</dt>
              <dd className="font-medium capitalize text-slate-800">{currentTenant.role}</dd>
            </div>
          )}
          {resource && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Resource</dt>
              <dd className="truncate font-mono text-xs text-slate-800">{resource}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Policy</dt>
            <dd className="font-medium text-slate-800">Tenant isolation (403)</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
          TenantVault only returns data for tenants you are a member of. This attempt has been recorded in the audit log.
        </p>
      </div>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {tenants.length > 1 && (
          <Button onClick={openSwitcher} icon={<ArrowLeftRight className="h-4 w-4" />}>
            Switch to a tenant you belong to
          </Button>
        )}
        {onDismiss && (
          <Button variant="secondary" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );

  if (variant === 'plain') return content;

  return (
    <div className="mx-auto max-w-xl animate-fade-in rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
      {content}
    </div>
  );
}

interface ResourceErrorStateProps {
  error: unknown;
  resourceLabel: string;
  resourceId: string;
  backTo: string;
  backLabel: string;
}

/**
 * Explains a failed record lookup. Cross-tenant IDs come back as 404 by design
 * (the record's existence is never revealed), so the copy explains that too.
 */
export function ResourceErrorState({ error, resourceLabel, resourceId, backTo, backLabel }: ResourceErrorStateProps) {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const status = getErrorStatus(error);

  if (status === 403) {
    return <AccessDeniedCard reason={getErrorMessage(error)} resource={`${resourceLabel} ${resourceId}`} />;
  }

  const isNotFound = status === 404;

  return (
    <div className="mx-auto max-w-xl animate-fade-in card p-8 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/60">
        <EyeOff className="h-8 w-8 text-amber-600" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        {isNotFound ? '404 · Not in this tenant' : 'Could not load'}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">
        {isNotFound ? `${resourceLabel} not found in ${currentTenant?.name}` : `Unable to load this ${resourceLabel.toLowerCase()}`}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {isNotFound
          ? `No ${resourceLabel.toLowerCase()} with this ID exists in your current tenant. If it belongs to another tenant, TenantVault responds exactly as if it did not exist, so nothing about other tenants' data is revealed.`
          : getErrorMessage(error)}
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Requested ID</span>
          <span className="truncate font-mono text-xs text-slate-800">{resourceId}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-slate-500">Searched in</span>
          <span className="font-medium text-slate-800">{currentTenant?.name}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-slate-500">Logged</span>
          <span className="font-medium text-slate-800">Yes, visible in Security &amp; Audit</span>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(backTo)}>
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
