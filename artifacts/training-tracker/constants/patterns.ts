export const PATTERNS = [
  'squat',
  'hinge',
  'horizontal push',
  'vertical push',
  'horizontal pull',
  'vertical pull',
] as const;

export type Pattern = (typeof PATTERNS)[number];

/** One fixed color per movement pattern, used consistently everywhere. */
export const PATTERN_COLORS: Record<Pattern, string> = {
  squat: '#ef6461',
  hinge: '#f2a65a',
  'horizontal push': '#e8c547',
  'vertical push': '#63c77b',
  'horizontal pull': '#5aa9e6',
  'vertical pull': '#9b72cf',
};

export const PATTERN_LABELS: Record<Pattern, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  'horizontal push': 'H. Push',
  'vertical push': 'V. Push',
  'horizontal pull': 'H. Pull',
  'vertical pull': 'V. Pull',
};
