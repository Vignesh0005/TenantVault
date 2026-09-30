import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from '@/types';
import {
  STATUS_MESSAGES,
  emitAccessDenied,
  emitToast,
  getConflictMessage,
  getErrorMessage,
} from '@/lib/errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Let the caller handle errors itself (no toast / redirect / overlay). */
    skipGlobalErrorHandler?: boolean;
  }
}

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const TOKEN_KEY = 'tv_token';
export const TENANT_KEY = 'tv_tenant';

// Kept in memory so the interceptor never reads a stale tenant mid-switch.
let currentTenantSlug: string | null = readStoredTenantSlug();

function readStoredTenantSlug(): string | null {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slug?: unknown };
    return typeof parsed.slug === 'string' ? parsed.slug : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setApiTenant(slug: string | null): void {
  currentTenantSlug = slug;
}

export function getApiTenant(): string | null {
  return currentTenantSlug;
}

export const client = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  if (currentTenantSlug) config.headers.set('X-Tenant-Id', currentTenantSlug);
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.config?.skipGlobalErrorHandler || axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const body = error.response?.data;

    switch (status) {
      case 401:
        setToken(null);
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        break;
      case 400:
        emitToast('error', body?.code === 'TENANT_MISSING' ? STATUS_MESSAGES[400] : getErrorMessage(error));
        break;
      case 403:
        emitAccessDenied({
          reason: body?.error ?? 'You are not a member of this tenant',
          path: error.config?.url ?? null,
        });
        break;
      case 404:
        emitToast('warning', STATUS_MESSAGES[404]);
        break;
      case 409:
        emitToast('error', getConflictMessage(error));
        break;
      case 429:
        emitToast('warning', STATUS_MESSAGES[429]);
        break;
      default:
        if (!error.response) {
          emitToast('error', 'Cannot reach the TenantVault API');
        } else if (status && status >= 500) {
          emitToast('error', body?.error ?? STATUS_MESSAGES[500]);
        }
    }

    return Promise.reject(error);
  },
);
