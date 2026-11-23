import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { TileHeader, atLeast, useTileSize } from '../components/tileKit';
import { KIDS_QUIZ } from '../data/kidsQuiz';
import { TRIVIA } from '../data/trivia';
import { useNow } from '../hooks/useNow';
import { sounds, unlockAudio } from '../lib/sound';
import { hourlyIndex, seededShuffle } from '../lib/utils';
import type { TileComponentProps } from './types';
import './quiz.css';

const LETTERS = ['A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------
// ためになる常識クイズ（1時間ごとにランダムで切り替え）
// ---------------------------------------------------------------------------

export function TriviaTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const now = useNow(30_000);
  // 「次の問題」を押した回数（1時間ごとの切り替わりでリセット）
  const hour = Math.floor(now / 3600_000);
  const [skip, setSkip] = useState({ hour, step: 0 });
  const step = skip.hour === hour ? skip.step : 0;
  const { index, nextChangeAt } = hourlyIndex(now, TRIVIA.length, 0, step);
  const nextQuestion = () => setSkip({ hour, step: step + 1 });
  const q = TRIVIA[index];
  const order = useMemo(() => seededShuffle(q.choices.map((_, i) => i), q.id * 97 + Math.floor(nextChangeAt / 3600_000)), [q, nextChangeAt]);
  const [picked, setPicked] = useState<{ id: number; choice: number } | null>(null);
  const [flipped, setFlipped] = useState<number | null>(null);
  const minutesLeft = Math.max(1, Math.ceil((nextChangeAt - now) / 60_000));
  const autoReveal = props.autoReveal === true && minutesLeft <= 15;
  const answered = picked?.id === q.id ? picked.choice : null;
  const revealed = answered !== null || autoReveal || flipped === q.id;
  const correct = answered === q.answer;

  // 小さいタイル: 問題 → タップで答え（カードをめくる）
  if (!atLeast(size.size, 'm') || size.height < 200) {
    return (
      <button type="button" className={`trivia-card ${revealed ? 'is-revealed' : ''}`} onClick={() => setFlipped(revealed ? null : q.id)}>
        <span className="chip">{q.category}</span>
        {!revealed ? (
          <span className="trivia-q">{q.q}</span>
        ) : (
          <>
            <span className="trivia-answer">💡 {q.choices[q.answer]}</span>
            {size.height > 150 && <span className="trivia-explain">{q.explain}</span>}
          </>
        )}
        <span className="trivia-hint">{revealed ? 'タップで問題にもどる' : 'タップで答え'}</span>
        {revealed && (
          <span
            role="button"
            tabIndex={0}
            className="trivia-next-btn is-mini"
            onClick={(e) => {
              e.stopPropagation();
              nextQuestion();
            }}
          >
            次の問題 ▶
          </span>
        )}
      </button>
    );
  }

  const compact = size.height < 330;
  const twoCols = size.width > 380;
  return (
    <div className="trivia">
      <TileHeader icon="💡" title="常識クイズ" sub={q.category} right={<span className="trivia-next">次の問題まで {minutesLeft}分</span>} />
      <div className="trivia-q trivia-q--big">{q.q}</div>
      {revealed && compact ? (
        <div className={`trivia-result ${answered === null ? '' : correct ? 'is-correct' : 'is-wrong'}`}>
          <div className="trivia-answer">
            {answered === null ? '💡 ' : correct ? '⭕ 正解！ ' : '❌ 残念… '}
            {q.choices[q.answer]}
          </div>
          <div className="trivia-explain">{q.explain}</div>
          <span className="trivia-actions">
            <button type="button" className="link-btn" onClick={() => setPicked(null)}>
              もう一度
            </button>
            <button type="button" className="trivia-next-btn" onClick={nextQuestion}>
              次の問題 ▶
            </button>
          </span>
        </div>
      ) : (
        <>
          <div className={`trivia-choices ${twoCols ? 'is-grid' : ''}`}>
            {order.map((ci, i) => {
              const state = !revealed ? '' : ci === q.answer ? 'is-correct' : ci === answered ? 'is-wrong' : 'is-dim';
              return (
                <button
                  key={ci}
                  type="button"
                  className={`trivia-choice ${state}`}
                  disabled={revealed}
                  onClick={() => setPicked({ id: q.id, choice: ci })}
                >
                  <span className="trivia-letter">{LETTERS[i]}</span>
                  <span>{q.choices[ci]}</span>
                </button>
              );
            })}
          </div>
          {revealed && <div className="trivia-explain trivia-explain--full">{q.explain}</div>}
          <div className="trivia-actions">
            {revealed ? (
              <button type="button" className="trivia-next-btn" onClick={nextQuestion}>
                次の問題 ▶
              </button>
            ) : (
              <button type="button" className="link-btn" onClick={nextQuestion}>
                ほかの問題 ↻
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// こども向けクイズ
// ---------------------------------------------------------------------------

const CHEERS = ['せいかい！', 'すごい！', 'やったね！', 'てんさい！', 'ぴんぽーん！'];

export function KidsQuizTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const sequence = useMemo(() => seededShuffle(KIDS_QUIZ.map((_, i) => i), seed), [seed]);
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<{ choice: number; ok: boolean } | null>(null);
  const [score, setScore] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const q = KIDS_QUIZ[sequence[pos % sequence.length]];
  const order = useMemo(() => seededShuffle(q.choices.map((_, i) => i), seed + pos), [q, seed, pos]);
  const soundOn = props.sound !== false;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const next = () => {
    window.clearTimeout(timer.current);
    setResult(null);
    setPos((p) => p + 1);
  };

  const pick = (ci: number) => {
    if (result?.ok) return;
    unlockAudio();
    const ok = ci === q.answer;
    setResult({ choice: ci, ok });
    window.clearTimeout(timer.current);
    if (ok) {
      setScore((s) => s + 1);
      if (soundOn) sounds.correct();
      if (props.autoNext !== false) timer.current = window.setTimeout(next, 2600);
    } else {
      if (soundOn) sounds.wrong();
      timer.current = window.setTimeout(() => setResult(null), 1100);
    }
  };

  const textChoices = q.choices.some((c) => /[ぁ-んァ-ン]/.test(c) && c.length > 2);
  const vertical = size.tall || (textChoices && !size.wide && size.width < 420);

  return (
    <div className={`kids ${vertical ? 'is-vertical' : ''} ${textChoices ? 'has-text' : ''}`}>
      {atLeast(size.size, 'm') && (
        <TileHeader
          icon="🧸"
          title="こどもクイズ"
          sub={q.category}
          right={
            <span className="kids-score" aria-label={`せいかい ${score}もん`}>
              ⭐ {score}
            </span>
          }
        />
      )}
      <div className="kids-question">
        {q.picture && <div className="kids-picture">{q.picture}</div>}
        <div className="kids-text">{q.q}</div>
      </div>
      <div className="kids-choices">
        {order.map((ci) => {
          const state = result?.choice === ci ? (result.ok ? 'is-correct' : 'is-wrong') : result?.ok && ci !== q.answer ? 'is-dim' : '';
          return (
            <button key={`${pos}-${ci}`} type="button" className={`kids-choice ${state}`} onClick={() => pick(ci)}>
              {q.choices[ci]}
            </button>
          );
        })}
      </div>
      {result?.ok && (
        <div className="kids-celebrate" onClick={next}>
          <div className="kids-confetti" aria-hidden="true">
            {['🎉', '⭐', '🎊', '✨', '🌟', '🎈', '💮', '🍭'].map((e, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties}>
                {e}
              </span>
            ))}
          </div>
          <div className="kids-cheer">{CHEERS[(pos + score) % CHEERS.length]}</div>
          <button type="button" className="kids-next" onClick={next}>
            つぎの もんだい ▶
          </button>
        </div>
      )}
      {!result?.ok && atLeast(size.size, 'm') && (
        <button type="button" className="kids-skip" onClick={next}>
          ほかの もんだい ↻
        </button>
      )}
    </div>
  );
}
