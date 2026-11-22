import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Icon } from '../components/icons';
import { TileHeader, TileMessage, atLeast, useTileSize } from '../components/tileKit';
import { wifiQrPayload } from '../lib/utils';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './wifi.css';

export function WifiTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const wifi = useApp((s) => s.settings.wifi);
  const [svg, setSvg] = useState('');
  const [reveal, setReveal] = useState(false);
  const payload = wifi.ssid ? wifiQrPayload(wifi.ssid, wifi.password, wifi.encryption, wifi.hidden) : '';

  useEffect(() => {
    if (!payload) return;
    let alive = true;
    QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0d14', light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [payload]);

  if (!wifi.ssid) return <TileMessage icon="📶">設定 → WiFi でネットワーク名とパスワードを登録してください</TileMessage>;

  const showInfo = size.size !== 'xs' && (size.wide || size.height > 220);
  const showPassword = props.showPassword !== false && atLeast(size.size, 's') && wifi.encryption !== 'nopass';

  return (
    <div className={`wifi ${size.wide ? 'is-wide' : ''}`}>
      {showInfo && !size.wide && <TileHeader icon="📶" title="WiFi" sub="カメラで読み取って接続" />}
      <div className="wifi-content">
        <div className="wifi-qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`WiFi ${wifi.ssid} の QR コード`} />
        {showInfo && (
          <div className="wifi-info">
            {size.wide && <TileHeader icon="📶" title="WiFi" sub="カメラで読み取って接続" />}
            <div className="wifi-ssid">{wifi.ssid}</div>
            {showPassword && (
              <button type="button" className="wifi-pass" onClick={() => setReveal((v) => !v)}>
                <Icon name={reveal ? 'eyeOff' : 'eye'} size={16} />
                <span>{reveal ? wifi.password : '••••••••'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
