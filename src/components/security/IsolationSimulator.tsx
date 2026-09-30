import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Play, RotateCcw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { ATTACKS, simulateAttacks } from '@/api/security';
import { Button } from '@/components/ui/Button';
import { useTenant } from '@/context/TenantContext';
import { getErrorMessage } from '@/lib/errors';
import type { AttackId, SimulationResult } from '@/types';

type RowState = { phase: 'idle' } | { phase: 'running' } | { phase: 'done'; result: SimulationResult };

// Minimum per-attack time so the audience can follow each step.
const MIN_STEP_MS = 700;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function initialRows(): Record<AttackId, RowState> {
  return Object.fromEntries(ATTACKS.map((a) => [a.id, { phase: 'idle' }])) as Record<AttackId, RowState>;
}

export function IsolationSimulator() {
  const { currentTenant } = useTenant();
  const [rows, setRows] = useState<Record<AttackId, RowState>>(initialRows);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);

  const results = ATTACKS.map((a) => rows[a.id]).filter(
    (r): r is Extract<RowState, { phase: 'done' }> => r.phase === 'done',
  );
  const blockedCount = results.filter((r) => r.result.blocked).length;
  const progress = Math.round((results.length / ATTACKS.length) * 100);
  const allBlocked = finished && blockedCount === ATTACKS.length;

  const run = async () => {
    cancelled.current = false;
    setRows(initialRows());
    setFinished(false);
    setRunning(true);

    // One request runs all 8 checks server-side; rows are then revealed step by step.
    const outcome = simulateAttacks().then(
      (list) => ({ ok: true as const, list }),
      (error: unknown) => ({ ok: false as const, reason: getErrorMessage(error, 'Simulation failed') }),
    );

    for (const attack of ATTACKS) {
      if (cancelled.current) break;
      setRows((prev) => ({ ...prev, [attack.id]: { phase: 'running' } }));
      const [res] = await Promise.all([outcome, sleep(MIN_STEP_MS)]);
      const result: SimulationResult =
        (res.ok ? res.list.find((r) => r.attack === attack.id) : undefined) ?? {
          attack: attack.id,
          expected: attack.expected,
          actual: 'error',
          blocked: false,
          reason: res.ok ? 'Check was not reported by the server' : res.reason,
        };
      setRows((prev) => ({ ...prev, [attack.id]: { phase: 'done', result } }));
    }

    setRunning(false);
    setFinished(!cancelled.current);
  };

  const stop = () => {
    cancelled.current = true;
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-2xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-24 h-72 w-72 animate-blob rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-64 w-64 animate-blob rounded-full bg-emerald-500/20 blur-3xl [animation-delay:-6s]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:28px_28px]" />
          {running && (
            <div className="absolute inset-x-0 top-0 h-24 animate-scan bg-gradient-to-b from-transparent via-accent/25 to-transparent" />
          )}
        </div>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Live attack suite</p>
            <h2 className="mt-1 text-2xl font-semibold">8 attacks against {currentTenant?.name}</h2>
            <p className="mt-2 text-sm text-slate-300">
              The server runs each attack against the real isolation layers (tenant middleware, JWT validation, EF
              query filters, the SaveChanges interceptor, storage keys, the tenant cache and PostgreSQL RLS). A green
              check means TenantVault blocked it.
            </p>
          </div>
          <div className="flex gap-2">
            {running ? (
              <Button size="lg" variant="danger" onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={run}
                icon={finished ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                className="animate-glow-pulse shadow-lg shadow-accent/40"
              >
                {finished ? 'Run Again' : 'Run Isolation Test'}
              </Button>
            )}
          </div>
        </div>

        <div className="relative mt-6">
          <div className="mb-1.5 flex justify-between text-xs text-slate-400">
            <span>
              {results.length}/{ATTACKS.length} attacks executed
            </span>
            <span className="font-semibold text-emerald-300">{blockedCount} blocked</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-accent to-emerald-400 shadow-[0_0_16px_rgb(var(--tv-accent)/0.6)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {finished && (
        <div
          className={`flex animate-scale-in items-center gap-4 rounded-2xl border p-5 shadow-lg ${
            allBlocked ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <span
            className={`flex h-12 w-12 shrink-0 animate-pop-in items-center justify-center rounded-full shadow-lg ${
              allBlocked ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {allBlocked ? <ShieldCheck className="h-7 w-7 text-white" /> : <ShieldAlert className="h-7 w-7 text-white" />}
          </span>
          <div>
            <p className={`text-lg font-semibold ${allBlocked ? 'text-emerald-900' : 'text-red-900'}`}>
              {allBlocked
                ? `${blockedCount}/${ATTACKS.length} attacks blocked. Isolation verified.`
                : `${blockedCount}/${ATTACKS.length} attacks blocked. Isolation gaps detected.`}
            </p>
            <p className={`text-sm ${allBlocked ? 'text-emerald-700' : 'text-red-700'}`}>
              {allBlocked
                ? `No request escaped the ${currentTenant?.name} boundary.`
                : 'Review the failed rows below. Each one could not be confirmed as blocked.'}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden card shadow-sm">
        <div className="hidden grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_3rem_minmax(0,2fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <span>#</span>
          <span>Attack</span>
          <span>Expected</span>
          <span>Actual</span>
          <span className="text-center">Result</span>
          <span>Reason</span>
        </div>
        <ol className="divide-y divide-slate-100">
          {ATTACKS.map((attack, index) => {
            const row = rows[attack.id];
            const done = row.phase === 'done' ? row.result : null;
            return (
              <li
                key={attack.id}
                className={`grid grid-cols-1 gap-2 px-5 py-4 transition-colors duration-300 lg:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_3rem_minmax(0,2fr)] lg:items-center lg:gap-4 ${
                  row.phase === 'running'
                    ? 'bg-accent/[0.07] shadow-[inset_3px_0_0_rgb(var(--tv-accent))]'
                    : done?.blocked
                      ? 'bg-emerald-50/40'
                      : done
                        ? 'bg-red-50/60'
                        : ''
                }`}
              >
                <span className="text-sm font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{attack.name}</p>
                  <p className="text-xs text-slate-500">{attack.description}</p>
                </div>
                <p className="text-sm text-slate-600">
                  <span className="text-xs text-slate-400 lg:hidden">Expected: </span>
                  {attack.expected}
                </p>
                <p className="font-mono text-xs text-slate-700">
                  <span className="font-sans text-xs text-slate-400 lg:hidden">Actual: </span>
                  {row.phase === 'running' ? <span className="text-slate-400">probing…</span> : done ? done.actual : '—'}
                </p>
                <div className="flex lg:justify-center">
                  {row.phase === 'idle' && <span className="h-6 w-6 rounded-full border-2 border-dashed border-slate-200" />}
                  {row.phase === 'running' && <Loader2 className="h-6 w-6 animate-spin text-accent" />}
                  {done &&
                    (done.blocked ? (
                      <CheckCircle2 key="ok" className="h-7 w-7 animate-pop-in text-emerald-600" aria-label="Blocked" />
                    ) : (
                      <XCircle key="fail" className="h-7 w-7 animate-pop-in text-red-600" aria-label="Not blocked" />
                    ))}
                </div>
                <div className="min-w-0">
                  {done ? (
                    <div className="animate-fade-in">
                      <p className={`text-sm ${done.blocked ? 'text-slate-700' : 'font-medium text-red-700'}`}>
                        {done.reason}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">—</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
