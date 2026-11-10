// Production is same-origin through Nginx. Local development can override
// this build-time value with NEXT_PUBLIC_API_URL.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
let csrfToken = "";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function setCSRF(value?: string) { if (value) csrfToken = value; }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? "request_failed", data?.error?.message ?? "So‘rov bajarilmadi");
  if (data?.csrf_token) setCSRF(data.csrf_token);
  return data as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, "body"> { return { body: JSON.stringify(value) }; }

