// Thin fetch wrapper: base URL, JSON parsing, typed error throwing.
import type { ApiError } from '../types';

// Overridable via VITE_API_BASE_URL (see .env.example) — defaults to the local dev server so
// `npm run dev` works out of the box with no setup.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001/api';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    if (body?.error?.message) return body.error.message;
  } catch {
    // response had no JSON body — fall through to generic message
  }
  return `Request failed with status ${res.status}`;
}

/** Performs a fetch against `${API_BASE_URL}${path}` and returns the parsed JSON body as `T`. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new HttpError(0, 'Network error — is the server running?');
  }

  if (!res.ok) {
    throw new HttpError(res.status, await parseErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
