import { useEffect } from 'react';
import type { RemoteCommand } from '../../shared/types';
import { getDeviceId, getDeviceName } from '../lib/device';
import { activeProfileId, ensureProfile, useApp } from '../state/store';
import { getTileDef } from '../tiles/registry';

/**
 * 表示端末（iPad など）側の処理。
 * - リモコンからの命令を Server-Sent Events で受け取って実行する
 * - 現在のページなどを定期的にサーバーへ報告する（リモコンに表示するため）
 */
export function useDisplayRemote(isDimmed: boolean) {
  // 命令の受信
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(`/api/remote/stream?id=${encodeURIComponent(getDeviceId())}`);
    es.onmessage = (e) => {
      let cmd: RemoteCommand;
      try {
        cmd = JSON.parse(e.data) as RemoteCommand;
      } catch {
        return;
      }
      const s = useApp.getState();
      const count = ensureProfile(s.layout, activeProfileId(s)).pages.length;
      switch (cmd.type) {
        case 'goto':
          s.setPageIndex(Math.min(Math.max(0, cmd.page), count - 1));
          break;
        case 'next':
          s.setPageIndex(Math.min(count - 1, s.pageIndex + 1));
          break;
        case 'prev':
          s.setPageIndex(Math.max(0, s.pageIndex - 1));
          break;
        case 'reload':
          window.location.reload();
          break;
        case 'dim':
          s.setRemoteDim(true);
          break;
        case 'undim':
          s.setRemoteDim(false, 30 * 60_000);
          break;
        case 'sync':
          void s.syncFromServer();
          break;
        case 'identify':
          s.setRemoteDim(false, 60_000);
          s.toast(`📱 リモコンから呼び出し中：${getDeviceName()}`);
          break;
      }
    };
    return () => es.close();
  }, []);

  // 状態の報告
  const pageIndex = useApp((s) => s.pageIndex);
  const profileId = useApp(activeProfileId);
  const layout = useApp((s) => s.layout);

  useEffect(() => {
    const send = () => {
      const profile = ensureProfile(layout, profileId);
      const pages = profile.pages.map((p) =>
        [...p.tiles]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((t) => getTileDef(t.type)?.icon ?? '▫️')
          .join(''),
      );
      void fetch('/api/remote/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: getDeviceId(),
          name: getDeviceName(),
          profile: profileId,
          page: Math.min(pageIndex, pages.length - 1),
          pageCount: pages.length,
          pages,
          dim: isDimmed,
        }),
      }).catch(() => undefined);
    };
    send();
    const t = window.setInterval(send, 15_000);
    return () => window.clearInterval(t);
  }, [pageIndex, profileId, layout, isDimmed]);
}
