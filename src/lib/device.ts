/** この端末（ブラウザ）の ID と名前。リモコンで端末を見分けるために使う */
const ID_KEY = 'hi:device-id';
const NAME_KEY = 'hi:device-name';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

let memoId: string | null = null;

export function getDeviceId(): string {
  memoId ??= safeGet(ID_KEY);
  if (!memoId) {
    memoId = `d-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    safeSet(ID_KEY, memoId);
  }
  return memoId;
}

export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iPad) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android' : 'Android タブレット';
  return 'PC のブラウザ';
}

export function getDeviceName(): string {
  return safeGet(NAME_KEY) || guessDeviceName();
}

export function setDeviceName(name: string) {
  safeSet(NAME_KEY, name.trim().slice(0, 40));
}

/** リモコン画面として開かれているか（/remote） */
export function isRemoteMode(): boolean {
  return /\/remote\/?$/.test(location.pathname) || location.hash === '#remote';
}
