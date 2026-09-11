export type TopicId = 'items' | 'heroes' | 'map';

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
  aliases: readonly string[];
  values: Readonly<Record<string, number>>;
  source: SourceReference;
  verification: Verification;
}

export interface GameFact {
  id: string;
  entityId: string;
  topic: TopicId;
  value: number;
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
  distractors: readonly number[];
}

export interface QuestionBank {
  id: string;
  patch: string;
  entities: readonly GameEntity[];
  facts: readonly GameFact[];
  questions: readonly ChoiceQuestion[];
}
