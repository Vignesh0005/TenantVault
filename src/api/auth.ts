import { client } from './client';
import type { AuthResponse, MeResponse, RegisterPayload } from '@/types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>(
    '/auth/login',
    { email, password },
    { skipGlobalErrorHandler: true },
  );
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/register', payload, {
    skipGlobalErrorHandler: true,
  });
  return data;
}

/** Re-issues the JWT so its tenant_ids claim reflects current memberships. */
export async function refresh(): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/refresh', undefined, {
    skipGlobalErrorHandler: true,
  });
  return data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await client.get<MeResponse>('/me', { skipGlobalErrorHandler: true });
  return data;
}
