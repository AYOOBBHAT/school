import { GenderBreakdown } from './types';

export const createEmptyBreakdown = (): GenderBreakdown => ({
  total: 0,
  male: 0,
  female: 0,
  other: 0,
  unknown: 0,
});

export const normalizeGenderKey = (value?: string | null): keyof GenderBreakdown => {
  if (!value) return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (['male', 'm', 'boy', 'boys'].includes(normalized)) return 'male';
  if (['female', 'f', 'girl', 'girls'].includes(normalized)) return 'female';
  if (normalized.length > 0 && normalized !== 'male' && normalized !== 'female') return 'other';
  return 'unknown';
};

export const buildGenderBreakdown = (values: Array<string | null | undefined>): GenderBreakdown => {
  const breakdown = createEmptyBreakdown();
  values.forEach((value) => {
    const key = normalizeGenderKey(value);
    breakdown.total += 1;
    breakdown[key] += 1;
  });
  return breakdown;
};

export const hydrateBreakdown = (incoming?: Partial<GenderBreakdown>): GenderBreakdown => ({
  total: incoming?.total ?? 0,
  male: incoming?.male ?? 0,
  female: incoming?.female ?? 0,
  other: incoming?.other ?? 0,
  unknown: incoming?.unknown ?? 0,
});

export const getExamplePlaceholder = (typeName: string): string => {
  const lower = typeName.toLowerCase();
  if (lower.includes('grade')) return 'Grade 9, Grade 10, Grade 11';
  if (lower.includes('section')) return 'A, B, C, D';
  if (lower.includes('house')) return 'Blue House, Red House, Green House';
  if (lower.includes('gender')) return 'Boys, Girls, Mixed';
  if (lower.includes('stream')) return 'Science, Arts, Commerce';
  if (lower.includes('level')) return 'Junior, Senior, Advanced';
  return 'Enter value';
};

export const getExampleHint = (typeName: string): string => {
  const lower = typeName.toLowerCase();
  if (lower.includes('grade')) return 'Examples: Grade 9, Grade 10, Grade 11, Grade 12';
  if (lower.includes('section')) return 'Examples: A, B, C, D, E';
  if (lower.includes('house')) return 'Examples: Blue House, Red House, Green House, Yellow House';
  if (lower.includes('gender')) return 'Examples: Boys, Girls, Mixed';
  if (lower.includes('stream')) return 'Examples: Science, Arts, Commerce, Vocational';
  if (lower.includes('level')) return 'Examples: Junior Group, Senior Group, Advanced';
  return 'Enter a value for this classification type';
};
