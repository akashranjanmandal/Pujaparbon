/** Thin fetch client. Access token lives in memory only; the refresh token is an httpOnly cookie. */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

export const setAccessToken = (t: string | null) => (accessToken = t);
export const onSessionExpired = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** One refresh at a time, however many requests hit 401 together. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then(async (r) => {
      if (!r.ok) return false;
      const body = await r.json();
      accessToken = body.accessToken;
      lastUser = body.user;
      return true;
    })
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}
export let lastUser: unknown = null;

interface Opts {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

async function raw(path: string, o: Opts = {}, retry = true): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/v1${path}`, {
    method: o.method ?? (o.body !== undefined || o.form ? "POST" : "GET"),
    headers,
    body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
    credentials: "same-origin",
    signal: o.signal,
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return raw(path, o, false);
    listeners.forEach((l) => l());
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details);
  }
  return res;
}

export const api = {
  get: <T,>(path: string, signal?: AbortSignal) => raw(path, { signal }).then((r) => r.json() as Promise<T>),
  post: <T,>(path: string, body?: unknown) => raw(path, { method: "POST", body: body ?? {} }).then((r) => r.json() as Promise<T>),
  put: <T,>(path: string, body: unknown) => raw(path, { method: "PUT", body }).then((r) => r.json() as Promise<T>),
  patch: <T,>(path: string, body: unknown) => raw(path, { method: "PATCH", body }).then((r) => r.json() as Promise<T>),
  del: <T,>(path: string) => raw(path, { method: "DELETE" }).then((r) => r.json() as Promise<T>),
  upload: <T,>(path: string, form: FormData) => raw(path, { method: "POST", form }).then((r) => r.json() as Promise<T>),
  /** Fetch an authenticated file (PDF, image, Excel) as an object URL. */
  blobUrl: async (path: string, body?: unknown) => URL.createObjectURL(await (await raw(path, body ? { method: "POST", body } : {})).blob()),
};

export async function download(path: string, filename: string, body?: unknown) {
  const url = await api.blobUrl(path, body);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function openFile(path: string, body?: unknown) {
  const url = await api.blobUrl(path, body);
  window.open(url, "_blank", "noopener");
}
