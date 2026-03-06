import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges tailwind classes correctly', () => {
    expect(cn('bg-red-500', 'p-4')).toBe('bg-red-500 p-4');
  });

  it('handles conditional classes', () => {
    expect(cn('p-4', true && 'm-2', false && 'hidden')).toBe('p-4 m-2');
  });

  it('merges conflicting tailwind classes (tw-merge)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });
});
