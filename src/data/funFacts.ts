import { FUN_FACTS_1 } from './funFacts1';
import { FUN_FACTS_2 } from './funFacts2';

/** トリビア（へぇ〜となる雑学・言葉の由来）。問いかけではなく言い切りの文章で表示する */
export interface FunFact {
  id: number;
  category: string;
  text: string;
}

export const FUN_FACTS: FunFact[] = [...FUN_FACTS_1, ...FUN_FACTS_2].map(([category, text], i) => ({ id: i + 1, category, text }));
