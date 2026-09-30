import { isAxiosError } from 'axios';
import type { ApiErrorBody, ToastVariant } from '@/types';

export const STATUS_MESSAGES: Record<number, string> = {
  400: 'Missing or invalid tenant context',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have access to this resource',
  404: 'Resource not found',
  409: 'Duplicate SKU',
  429: 'Too many requests, slow down',
  500: 'Something went wrong on our side',
};

export function getErrorStatus(error: unknown): number | null {
  if (isAxiosError(error)) return error.response?.status ?? null;
  return null;
}

/** Prefers the server's explanation, falling back to a friendly status message. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    const fieldError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
    if (fieldError) return fieldError;
    if (body?.error) return body.error;
    const status = error.response?.status;
    if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
    if (!error.response) return 'Cannot reach the TenantVault API';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getConflictMessage(error: unknown): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error ?? '';
    if (message && !/sku/i.test(message)) return message;
  }
  return STATUS_MESSAGES[409];
}

/*
 * Tiny event bus so the non-React axios layer can talk to React UI
 * (toasts and the global Access Denied overlay).
 */
type ToastListener = (variant: ToastVariant, message: string) => void;
type AccessDeniedListener = (payload: AccessDeniedPayload) => void;

export interface AccessDeniedPayload {
  reason: string;
  path: string | null;
}

const toastListeners = new Set<ToastListener>();
const accessDeniedListeners = new Set<AccessDeniedListener>();

export function onToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

export function emitToast(variant: ToastVariant, message: string): void {
  toastListeners.forEach((listener) => listener(variant, message));
}

export function onAccessDenied(listener: AccessDeniedListener): () => void {
  accessDeniedListeners.add(listener);
  return () => accessDeniedListeners.delete(listener);
}

export function emitAccessDenied(payload: AccessDeniedPayload): void {
  accessDeniedListeners.forEach((listener) => listener(payload));
}
