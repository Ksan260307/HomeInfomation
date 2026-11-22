/** WMO 天気コード → 日本語表記・絵文字 */
interface WeatherInfo {
  label: string;
  day: string;
  night: string;
}

const T: Record<number, WeatherInfo> = {
  0: { label: '快晴', day: '☀️', night: '🌙' },
  1: { label: '晴れ', day: '🌤️', night: '🌙' },
  2: { label: '晴れ時々曇り', day: '⛅', night: '☁️' },
  3: { label: '曇り', day: '☁️', night: '☁️' },
  45: { label: '霧', day: '🌫️', night: '🌫️' },
  48: { label: '霧氷', day: '🌫️', night: '🌫️' },
  51: { label: '弱い霧雨', day: '🌦️', night: '🌧️' },
  53: { label: '霧雨', day: '🌦️', night: '🌧️' },
  55: { label: '強い霧雨', day: '🌧️', night: '🌧️' },
  56: { label: '着氷性の霧雨', day: '🌧️', night: '🌧️' },
  57: { label: '着氷性の霧雨', day: '🌧️', night: '🌧️' },
  61: { label: '小雨', day: '🌦️', night: '🌧️' },
  63: { label: '雨', day: '🌧️', night: '🌧️' },
  65: { label: '大雨', day: '🌧️', night: '🌧️' },
  66: { label: '着氷性の雨', day: '🌧️', night: '🌧️' },
  67: { label: '着氷性の雨', day: '🌧️', night: '🌧️' },
  71: { label: '小雪', day: '🌨️', night: '🌨️' },
  73: { label: '雪', day: '🌨️', night: '🌨️' },
  75: { label: '大雪', day: '❄️', night: '❄️' },
  77: { label: '霧雪', day: '🌨️', night: '🌨️' },
  80: { label: 'にわか雨', day: '🌦️', night: '🌧️' },
  81: { label: 'にわか雨', day: '🌧️', night: '🌧️' },
  82: { label: '激しいにわか雨', day: '⛈️', night: '⛈️' },
  85: { label: 'にわか雪', day: '🌨️', night: '🌨️' },
  86: { label: '強いにわか雪', day: '❄️', night: '❄️' },
  95: { label: '雷雨', day: '⛈️', night: '⛈️' },
  96: { label: '雹を伴う雷雨', day: '⛈️', night: '⛈️' },
  99: { label: '激しい雷雨', day: '⛈️', night: '⛈️' },
};

export function weatherInfo(code: number | undefined, isDay = true): { label: string; icon: string } {
  const info = (code != null && T[code]) || { label: '—', day: '🌡️', night: '🌡️' };
  return { label: info.label, icon: isDay ? info.day : info.night };
}
