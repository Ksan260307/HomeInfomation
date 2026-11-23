import type { Response } from 'express';
import type { DisplayInfo, RemoteCommand } from '../../shared/types';

/**
 * スマホのリモコンから iPad などの表示端末を操作するための中継。
 * 表示端末は Server-Sent Events（/api/remote/stream）で待ち受け、
 * 定期的に現在のページなどを /api/remote/heartbeat で報告する。
 */
export class RemoteHub {
  private displays = new Map<string, DisplayInfo>();
  private streams = new Map<string, Set<Response>>();

  static validId(id: unknown): id is string {
    return typeof id === 'string' && /^[\w-]{4,64}$/.test(id);
  }

  heartbeat(info: Partial<DisplayInfo> & { id: string }): DisplayInfo {
    const prev = this.displays.get(info.id);
    const next: DisplayInfo = {
      id: info.id,
      name: String(info.name ?? prev?.name ?? '表示端末').slice(0, 40),
      profile: String(info.profile ?? prev?.profile ?? ''),
      page: Math.max(0, Number(info.page ?? prev?.page ?? 0) || 0),
      pageCount: Math.max(1, Number(info.pageCount ?? prev?.pageCount ?? 1) || 1),
      pages: Array.isArray(info.pages) ? info.pages.slice(0, 50).map((p) => String(p).slice(0, 80)) : (prev?.pages ?? []),
      dim: info.dim === true,
      lastSeen: Date.now(),
      connected: this.streams.has(info.id),
    };
    this.displays.set(info.id, next);
    return next;
  }

  list(): DisplayInfo[] {
    const cutoff = Date.now() - 60_000;
    const out: DisplayInfo[] = [];
    for (const d of this.displays.values()) {
      const connected = (this.streams.get(d.id)?.size ?? 0) > 0;
      if (connected || d.lastSeen > cutoff) out.push({ ...d, connected });
      else this.displays.delete(d.id);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  attach(id: string, res: Response): () => void {
    let set = this.streams.get(id);
    if (!set) this.streams.set(id, (set = new Set()));
    set.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    return () => {
      clearInterval(ping);
      set.delete(res);
      if (set.size === 0) this.streams.delete(id);
    };
  }

  /** 命令を送る。届いた端末の数を返す */
  send(target: string, command: RemoteCommand): number {
    const ids = target === 'all' ? [...this.streams.keys()] : [target];
    let delivered = 0;
    const data = `data: ${JSON.stringify(command)}\n\n`;
    for (const id of ids) {
      for (const res of this.streams.get(id) ?? []) {
        res.write(data);
        delivered++;
      }
    }
    return delivered;
  }
}
