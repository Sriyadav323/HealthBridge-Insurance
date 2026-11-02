export const SESSION_EXPIRED_EVENT = 'healthbridge:session-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store' });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error('Unable to connect to the server. Please try again.');
  }
  if (response.status === 401 && url !== '/api/v1/auth/login') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; code?: string } | null;
    throw new ApiError(response.status,
      body?.message ?? `Request failed (${response.status}). Please try again.`, body?.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getApiData<T>(path: string, signal?: AbortSignal): Promise<T> {
  return readApiResponse<T>(await apiFetch(`/api/v1${path}`, { signal }));
}

// Tokens are session-bound and are fetched afresh for every mutation, including logout.
export async function getCsrfToken(): Promise<string> {
  const data = await getApiData<{ token: string }>('/auth/csrf');
  return data.token;
}

export async function mutateApiData<T>(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getCsrfToken();
    const response = await apiFetch(`/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    try {
      return await readApiResponse<T>(response);
    } catch (error) {
      // Only a rejected CSRF check is safe to retry; never repeat a processed mutation.
      if (attempt === 0 && error instanceof ApiError && error.code === 'CSRF_INVALID') continue;
      throw error;
    }
  }
  throw new Error('Unable to renew your security token. Please try again.');
}
