import { mulberry32 } from '../lib/utils';

/**
 * こども向けクイズ（101〜400問）。
 * 数・名前・色・なかまはずれなどは、答えが必ず正しくなるように絵文字の一覧から機械的に作成する
 * （シード固定なので毎回同じ問題になる）。反対ことばなどは手書き。
 */
type Raw = { category: string; q: string; picture?: string; choices: string[]; answer: number };

type Group = 'fruit' | 'veg' | 'animal' | 'sea' | 'bug' | 'vehicle' | 'sky' | 'food' | 'flower' | 'wear' | 'toy';

const THINGS: [string, string, Group][] = [
  ['🍎', 'りんご', 'fruit'], ['🍌', 'ばなな', 'fruit'], ['🍇', 'ぶどう', 'fruit'], ['🍓', 'いちご', 'fruit'], ['🍉', 'すいか', 'fruit'],
  ['🍑', 'もも', 'fruit'], ['🍊', 'みかん', 'fruit'], ['🍒', 'さくらんぼ', 'fruit'], ['🍋', 'れもん', 'fruit'], ['🍍', 'ぱいなっぷる', 'fruit'],
  ['🥕', 'にんじん', 'veg'], ['🍅', 'とまと', 'veg'], ['🌽', 'とうもろこし', 'veg'], ['🍆', 'なす', 'veg'], ['🥦', 'ぶろっこりー', 'veg'],
  ['🥒', 'きゅうり', 'veg'], ['🧅', 'たまねぎ', 'veg'], ['🎃', 'かぼちゃ', 'veg'],
  ['🐶', 'いぬ', 'animal'], ['🐱', 'ねこ', 'animal'], ['🐰', 'うさぎ', 'animal'], ['🐻', 'くま', 'animal'], ['🐼', 'ぱんだ', 'animal'],
  ['🦁', 'らいおん', 'animal'], ['🐯', 'とら', 'animal'], ['🐘', 'ぞう', 'animal'], ['🦒', 'きりん', 'animal'], ['🐒', 'おさる', 'animal'],
  ['🐧', 'ぺんぎん', 'animal'], ['🐸', 'かえる', 'animal'], ['🐷', 'ぶた', 'animal'], ['🐮', 'うし', 'animal'], ['🐴', 'うま', 'animal'],
  ['🐑', 'ひつじ', 'animal'], ['🐭', 'ねずみ', 'animal'], ['🦊', 'きつね', 'animal'], ['🐨', 'こあら', 'animal'], ['🐔', 'にわとり', 'animal'],
  ['🐟', 'さかな', 'sea'], ['🐙', 'たこ', 'sea'], ['🐢', 'かめ', 'sea'], ['🦀', 'かに', 'sea'], ['🐳', 'くじら', 'sea'], ['🐬', 'いるか', 'sea'],
  ['🦋', 'ちょうちょ', 'bug'], ['🐞', 'てんとうむし', 'bug'], ['🐜', 'あり', 'bug'], ['🐝', 'はち', 'bug'], ['🐌', 'かたつむり', 'bug'],
  ['🚗', 'くるま', 'vehicle'], ['🚌', 'ばす', 'vehicle'], ['🚃', 'でんしゃ', 'vehicle'], ['✈️', 'ひこうき', 'vehicle'], ['🚢', 'ふね', 'vehicle'],
  ['🚲', 'じてんしゃ', 'vehicle'], ['🚒', 'しょうぼうしゃ', 'vehicle'], ['🚑', 'きゅうきゅうしゃ', 'vehicle'], ['🚓', 'ぱとかー', 'vehicle'], ['🚀', 'ろけっと', 'vehicle'],
  ['☀️', 'たいよう', 'sky'], ['🌙', 'おつきさま', 'sky'], ['⭐', 'ほし', 'sky'], ['🌈', 'にじ', 'sky'], ['☁️', 'くも', 'sky'],
  ['🍦', 'あいすくりーむ', 'food'], ['🍙', 'おにぎり', 'food'], ['🍞', 'ぱん', 'food'], ['🎂', 'けーき', 'food'], ['🍩', 'どーなつ', 'food'], ['🍕', 'ぴざ', 'food'],
  ['🌸', 'さくら', 'flower'], ['🌻', 'ひまわり', 'flower'], ['🌷', 'ちゅーりっぷ', 'flower'], ['🌹', 'ばら', 'flower'],
  ['👟', 'くつ', 'wear'], ['🧢', 'ぼうし', 'wear'], ['👕', 'しゃつ', 'wear'], ['🧦', 'くつした', 'wear'], ['🧤', 'てぶくろ', 'wear'],
  ['🎈', 'ふうせん', 'toy'], ['⚽', 'ぼーる', 'toy'], ['🪀', 'よーよー', 'toy'], ['🧩', 'ぱずる', 'toy'], ['🥁', 'たいこ', 'toy'],
];

const GROUP_NAME: Record<Group, string> = {
  fruit: 'くだもの',
  veg: 'やさい',
  animal: 'どうぶつ',
  sea: 'うみの いきもの',
  bug: 'むし',
  vehicle: 'のりもの',
  sky: 'そらに あるもの',
  food: 'たべもの',
  flower: 'おはな',
  wear: 'みにつけるもの',
  toy: 'おもちゃ',
};

const rand = mulberry32(20261123);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
function pickDistinct<T>(arr: readonly T[], n: number, exclude: (x: T) => boolean = () => false): T[] {
  const pool = arr.filter((x) => !exclude(x));
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
const NUM = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const out: Raw[] = [];

// 1. なまえ：「〇〇は どれ？」（全部のものについて1問ずつ）
for (const [emoji, name, group] of THINGS) {
  const others = pickDistinct(THINGS, 2, (t) => t[2] === group || t[0] === emoji).map((t) => t[0]);
  out.push({ category: 'なまえ', q: `「${name}」は どれ？`, choices: [emoji, ...others], answer: 0 });
}

// 2. かず：「いくつ あるかな？」（1〜9こ）
const countables = THINGS.filter((t) => ['fruit', 'veg', 'animal', 'sea', 'bug', 'food', 'flower', 'toy', 'sky'].includes(t[2]));
for (let i = 0; i < 46; i++) {
  const [emoji, name] = countables[(i * 7) % countables.length];
  const n = (i % 9) + 1;
  const wrong = pickDistinct([n - 2, n - 1, n + 1, n + 2].filter((x) => x >= 1 && x <= 10), 2);
  out.push({ category: 'かず', q: `${name}は いくつ あるかな？`, picture: emoji.repeat(n), choices: [String(n), ...wrong.map(String)], answer: 0 });
}

// 3. くらべる：「どっちが おおきい／ちいさい かず？」
const pairs: [number, number][] = [];
for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 10; b++) pairs.push([a, b]);
for (const [a, b] of pickDistinct(pairs, 30)) {
  const big = out.length % 2 === 0;
  const [x, y] = rand() < 0.5 ? [a, b] : [b, a];
  out.push({
    category: 'かず',
    q: big ? 'おおきい かずは どっち？' : 'ちいさい かずは どっち？',
    picture: `${NUM[x]} と ${NUM[y]}`,
    choices: big ? [String(Math.max(x, y)), String(Math.min(x, y))] : [String(Math.min(x, y)), String(Math.max(x, y))],
    answer: 0,
  });
}

// 4. たしざん：「あわせて いくつ？」（こたえは10まで）
for (let i = 0; i < 20; i++) {
  const [emoji, name] = countables[(i * 11 + 3) % countables.length];
  const a = (i % 4) + 1;
  const b = ((i * 3) % 5) + 1;
  const sum = a + b;
  const wrong = pickDistinct([sum - 2, sum - 1, sum + 1, sum + 2].filter((x) => x >= 1 && x <= 10), 2);
  out.push({ category: 'たしざん', q: `${name} ${a}こと ${b}こ。あわせて いくつ？`, picture: `${emoji.repeat(a)} ➕ ${emoji.repeat(b)}`, choices: [String(sum), ...wrong.map(String)], answer: 0 });
}

// 5. つぎの かず
for (let start = 1; start <= 7; start++) {
  const next = start + 3;
  out.push({ category: 'かず', q: `${start}、${start + 1}、${start + 2} の つぎは なに？`, choices: [String(next), String(next + 1), String(start)], answer: 0 });
}
for (let start = 10; start >= 8; start--) {
  const next = start - 3;
  out.push({ category: 'かず', q: `${start}、${start - 1}、${start - 2} の つぎは なに？`, choices: [String(next), String(next + 2), String(next - 1)], answer: 0 });
}

// 6. なかまはずれ
const groups = Object.keys(GROUP_NAME) as Group[];
for (let i = 0; i < 40; i++) {
  const g = groups[i % groups.length];
  const members = THINGS.filter((t) => t[2] === g);
  if (members.length < 3) continue;
  const three = pickDistinct(members, 3).map((t) => t[0]);
  const oddGroup = pick(groups.filter((x) => x !== g && !(['fruit', 'veg', 'food'].includes(x) && ['fruit', 'veg', 'food'].includes(g)) && !(['animal', 'sea', 'bug'].includes(x) && ['animal', 'sea', 'bug'].includes(g))));
  const odd = pick(THINGS.filter((t) => t[2] === oddGroup))[0];
  out.push({ category: 'なかま', q: `なかまはずれは どれ？（${GROUP_NAME[g]}じゃないのは？）`, choices: [odd, ...three], answer: 0 });
}

// 7. いろ
const COLORS: Record<string, string[]> = {
  あか: ['🍎', '🍓', '🍅', '🍒', '🚒', '🌹', '❤️'],
  きいろ: ['🍌', '🍋', '🌻', '🐥', '⭐', '🌽'],
  みどり: ['🥦', '🐸', '🥒', '🍀', '🌲', '🥬'],
  あお: ['🐳', '💧', '🫐', '👖', '🔵', '💙'],
  しろ: ['🍙', '☁️', '⛄', '🐑', '🥛', '🦢'],
};
const colorNames = Object.keys(COLORS);
for (let i = 0; i < 25; i++) {
  const c = colorNames[i % colorNames.length];
  const right = pick(COLORS[c]);
  const wrongs = pickDistinct(colorNames.filter((x) => x !== c), 2).map((x) => pick(COLORS[x]));
  out.push({ category: 'いろ', q: `${c}の ものは どれ？`, choices: [right, ...wrongs], answer: 0 });
}

// 8. おおきい・ちいさい
const SIZE_PAIRS: [string, string][] = [
  ['🐘', '🐭'], ['🐳', '🐟'], ['🦒', '🐰'], ['🐻', '🐜'], ['🚌', '🚲'], ['🚢', '🦆'], ['🍉', '🍒'], ['🌳', '🌱'],
  ['🐴', '🐱'], ['🐮', '🐥'], ['✈️', '🦋'], ['🏠', '🎁'], ['🎃', '🍇'], ['🦁', '🐞'], ['🐋', '🦐'],
];
SIZE_PAIRS.forEach(([big, small], i) => {
  const askBig = i % 2 === 0;
  out.push({ category: 'くらべる', q: askBig ? 'おおきい のは どっち？' : 'ちいさい のは どっち？', choices: askBig ? [big, small] : [small, big], answer: 0 });
});

// 9. すんでいる ところ
const LIVES: [string, string[], string[]][] = [
  ['うみに すんで いるのは どれ？', ['🐙', '🐳', '🦀', '🐬', '🐟'], ['🐶', '🐘', '🐿️', '🐔', '🦒']],
  ['そらを とぶのは どれ？', ['🦅', '🦋', '🐦', '🐝', '🦆'], ['🐢', '🐌', '🐷', '🐮', '🐊']],
  ['つちの なかに すんで いるのは どれ？', ['🐜', '🪱'], ['🐳', '🦒', '🐧']],
  ['さむい ところに すんで いるのは どれ？', ['🐧', '🐻‍❄️'], ['🐫', '🦁', '🦒']],
];
for (let i = 0; i < 15; i++) {
  const [q, yes, no] = LIVES[i % LIVES.length];
  const right = yes[Math.floor(i / LIVES.length) % yes.length];
  const wrongs = pickDistinct(no, 2);
  out.push({ category: 'いきもの', q, choices: [right, ...wrongs], answer: 0 });
}

// 10. はんたいことば・せいかつ（手書き）
const HAND: Raw[] = [
  { category: 'はんたい', q: '「おおきい」の はんたいは？', picture: '🐘↔️🐭', choices: ['ちいさい', 'ながい', 'あかい'], answer: 0 },
  { category: 'はんたい', q: '「あつい」の はんたいは？', picture: '🔥↔️🧊', choices: ['つめたい', 'おもい', 'はやい'], answer: 0 },
  { category: 'はんたい', q: '「ながい」の はんたいは？', picture: '🦒', choices: ['みじかい', 'ひろい', 'まるい'], answer: 0 },
  { category: 'はんたい', q: '「はやい」の はんたいは？', picture: '🐇↔️🐢', choices: ['おそい', 'たかい', 'しろい'], answer: 0 },
  { category: 'はんたい', q: '「うえ」の はんたいは？', picture: '⬆️', choices: ['した', 'みぎ', 'まえ'], answer: 0 },
  { category: 'はんたい', q: '「みぎ」の はんたいは？', picture: '👉', choices: ['ひだり', 'うしろ', 'した'], answer: 0 },
  { category: 'はんたい', q: '「あさ」の はんたいは？', picture: '🌅', choices: ['よる', 'ひる', 'あした'], answer: 0 },
  { category: 'はんたい', q: '「おもい」の はんたいは？', picture: '🏋️', choices: ['かるい', 'あつい', 'くらい'], answer: 0 },
  { category: 'はんたい', q: '「あかるい」の はんたいは？', picture: '💡', choices: ['くらい', 'おもい', 'ひくい'], answer: 0 },
  { category: 'はんたい', q: '「たかい」の はんたいは？', picture: '🗼', choices: ['ひくい', 'ふとい', 'あまい'], answer: 0 },
  { category: 'はんたい', q: '「あける」の はんたいは？', picture: '🚪', choices: ['しめる', 'たべる', 'ねる'], answer: 0 },
  { category: 'はんたい', q: '「わらう」の はんたいは？', picture: '😄', choices: ['なく', 'はしる', 'うたう'], answer: 0 },
  { category: 'せいかつ', q: 'はを みがく ときに つかうのは？', choices: ['🪥', '🍴', '✏️'], answer: 0 },
  { category: 'せいかつ', q: 'かみを きる ときに つかうのは？', choices: ['✂️', '🥄', '🧽'], answer: 0 },
  { category: 'せいかつ', q: 'じを かく ときに つかうのは？', choices: ['✏️', '🍳', '🧹'], answer: 0 },
];
out.push(...HAND);

export const KIDS_QUIZ_2: Raw[] = out;
