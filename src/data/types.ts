export type TopicId = 'items' | 'heroes' | 'map';
export type AnswerValue = number | string;
export type QuestionCategory = 'recognition' | 'price' | 'stats' | 'mana' | 'cooldown' | 'effect' | 'damage' | 'dispel' | 'tier' | 'timing';

export interface SourceReference {
  title: string;
  url: string;
  retrievedAt: string;
}

export interface Verification {
  patch: string;
  checkedAt: string;
  status: 'verified' | 'needs-review';
}

export interface GameEntity {
  id: string;
  topic: TopicId;
  valveId?: number;
  name: string;
  image?: string;
  aliases: readonly string[];
  values: Readonly<Record<string, number>>;
  source: SourceReference;
  verification: Verification;
}

export interface GameFact {
  id: string;
  entityId: string;
  topic: TopicId;
  value: AnswerValue;
  unit: string;
  conditions: string;
  explanation: string;
  evidence: readonly string[];
  source: SourceReference;
  verification: Verification;
}

export interface ChoiceQuestion {
  id: string;
  factId: string;
  prompt: string;
  distractors: readonly AnswerValue[];
  category?: QuestionCategory;
}

export interface QuestionBank {
  id: string;
  patch: string;
  entities: readonly GameEntity[];
  facts: readonly GameFact[];
  questions: readonly ChoiceQuestion[];
}
