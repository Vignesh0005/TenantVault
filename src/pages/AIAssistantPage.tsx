import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Lock, SendHorizonal, Sparkles, User } from 'lucide-react';
import { askAssistant } from '@/api/ai';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCurrentTenant } from '@/context/TenantContext';
import { formatRelativeTime } from '@/lib/format';
import type { ChatMessage } from '@/types';

const SUGGESTIONS = ['Low stock items', 'Dead stock this month', 'Reorder suggestions'];

function ScopeBadge({ tenantName }: { tenantName: string }) {
  return (
    <Badge variant="accent" icon={<Lock className="h-3 w-3" />}>
      Scoped to: {tenantName}
    </Badge>
  );
}

function MessageBubble({ message, fallbackTenant }: { message: ChatMessage; fallbackTenant: string }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'animate-slide-in-right flex-row-reverse' : 'animate-slide-in-left'}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-md ${
          isUser ? 'bg-slate-200 text-slate-600' : 'accent-gradient text-white shadow-accent/30'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && <ScopeBadge tenantName={message.tenantName ?? fallbackTenant} />}
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-sm accent-gradient text-white shadow-lg shadow-accent/20'
              : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 shadow-sm'
          }`}
        >
          {message.content}
        </div>
        <span className="text-[11px] text-slate-400">{formatRelativeTime(message.createdAt)}</span>
      </div>
    </div>
  );
}

function TypingIndicator({ tenantName }: { tenantName: string }) {
  return (
    <div className="flex animate-fade-in gap-3">
      <span className="flex h-8 w-8 shrink-0 animate-glow-pulse items-center justify-center rounded-full accent-gradient text-white">
        <Bot className="h-4 w-4" />
      </span>
      <div className="flex flex-col gap-1">
        <ScopeBadge tenantName={tenantName} />
        <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-accent/60"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AIAssistantPage() {
  const tenant = useCurrentTenant();
  const queryClient = useQueryClient();
  const historyKey = ['ai-history', tenant.id] as const;
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The conversation lives only in this tenant's query cache, so a tenant switch wipes it.
  const history = useQuery<ChatMessage[]>({
    queryKey: historyKey,
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
  });

  const appendMessage = (message: ChatMessage) =>
    queryClient.setQueryData<ChatMessage[]>(historyKey, (current) => [...(current ?? []), message]);

  const ask = useMutation({
    mutationFn: askAssistant,
    onMutate: (text) => {
      appendMessage({
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        tenantName: tenant.name,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (res) => {
      appendMessage({
        id: res.id,
        role: 'assistant',
        content: res.reply,
        tenantName: res.tenantName,
        createdAt: res.createdAt,
      });
    },
    onError: () => {
      appendMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I could not answer that right now. Please try again.',
        tenantName: tenant.name,
        createdAt: new Date().toISOString(),
      });
    },
  });

  const messages = history.data ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, ask.isPending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    setDraft('');
    ask.mutate(trimmed);
    textareaRef.current?.focus();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Natural-language answers from your inventory, never from another tenant's."
        actions={<ScopeBadge tenantName={tenant.name} />}
      />

      <div className="card flex h-[calc(100vh-16rem)] min-h-[480px] flex-col overflow-hidden !bg-slate-50/80 dark:!bg-slate-900/50">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="relative mb-5">
                <span className="absolute inset-0 animate-ping rounded-3xl bg-accent/15 [animation-duration:2.5s]" />
                <span className="relative flex h-16 w-16 animate-float items-center justify-center rounded-3xl accent-gradient text-white shadow-xl shadow-accent/30">
                  <Sparkles className="h-8 w-8" />
                </span>
              </div>
              <h2 className="text-base font-semibold text-slate-900">Ask anything about {tenant.name}'s inventory</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                The assistant only sees data from this tenant. Try one of the suggestions below.
              </p>
              <div className="stagger mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/15"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} fallbackTenant={tenant.name} />)
          )}
          {ask.isPending && <TypingIndicator tenantName={tenant.name} />}
        </div>

        <div className="border-t border-slate-200 bg-white/90 p-3 backdrop-blur">
          {messages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={ask.isPending}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask about your inventory — e.g., 'Which SKUs are low on stock?'"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
              aria-label="Message the AI assistant"
            />
            <Button
              type="submit"
              className="h-10 w-10 !px-0"
              disabled={!draft.trim()}
              loading={ask.isPending}
              aria-label="Send"
              icon={<SendHorizonal className="h-4 w-4" />}
            />
          </form>
        </div>
      </div>
    </>
  );
}
