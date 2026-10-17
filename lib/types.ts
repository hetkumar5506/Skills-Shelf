export type Theme = 'dark' | 'light';

export interface SkillItem {
  id: string;
  name: string;
  command: string;
}

export const STORAGE_KEYS = {
  skills: 'skillshelf:skills',
  theme: 'skillshelf:theme',
} as const;

// The app intentionally stores text-only data and caps it at 5 MiB.
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export const DEFAULT_SKILLS: SkillItem[] = [
  { id: 'hallmark', name: 'Hallmark', command: 'npx skills add nutlope/hallmark' },
  { id: 'frontend-design', name: 'Frontend Design', command: 'npx skills add anthropics/skills --skill frontend-design' },
  { id: 'emilkowalski', name: 'Emil Kowalski Skills', command: 'npx skills add emilkowalski/skills' },
  { id: 'impeccable', name: 'Impeccable', command: 'npx skills add pbakaus/impeccable --skill impeccable' },
  { id: 'design-taste-frontend', name: 'Design Taste · Frontend', command: 'npx skills add Leonxlnx/taste-skill --skill design-taste-frontend' },
  { id: 'ponytail', name: 'Ponytail', command: 'npx skills add dietrichgebert/ponytail' },
];
