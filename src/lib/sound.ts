/** 効果音（Web Audio で生成。音声ファイル不要） */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** iOS はユーザー操作中に一度鳴らさないと音が出ないため、タップ時に呼ぶ */
export function unlockAudio() {
  audio();
}

export function playTones(notes: { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }[]) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.18;
    g.gain.setValueAtTime(0, t0 + n.at);
    g.gain.linearRampToValueAtTime(peak, t0 + n.at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.05);
  }
}

export const sounds = {
  correct: () =>
    playTones([
      { freq: 523.25, at: 0, dur: 0.18, type: 'triangle' },
      { freq: 659.25, at: 0.12, dur: 0.18, type: 'triangle' },
      { freq: 783.99, at: 0.24, dur: 0.35, type: 'triangle' },
      { freq: 1046.5, at: 0.36, dur: 0.45, type: 'triangle', gain: 0.12 },
    ]),
  wrong: () =>
    playTones([
      { freq: 220, at: 0, dur: 0.22, type: 'square', gain: 0.06 },
      { freq: 185, at: 0.2, dur: 0.3, type: 'square', gain: 0.06 },
    ]),
  tap: () => playTones([{ freq: 880, at: 0, dur: 0.06, type: 'sine', gain: 0.08 }]),
  alarm: () =>
    playTones(
      Array.from({ length: 8 }, (_, i) => ({ freq: i % 2 ? 1318.5 : 1046.5, at: i * 0.22 + Math.floor(i / 4) * 0.4, dur: 0.18, type: 'square' as const, gain: 0.1 })),
    ),
};
