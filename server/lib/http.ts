const USER_AGENT = 'Mozilla/5.0 (compatible; HomeInformation/0.1; personal home dashboard)';

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

export async function fetchRaw(url: string, opts: FetchOptions = {}): Promise<Response> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    body: opts.body,
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja,en;q=0.8', ...opts.headers },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    redirect: 'follow',
  });
  return res;
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await fetchRaw(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${new URL(url).host})`);
  return res.text();
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } });
  return JSON.parse(text) as T;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
