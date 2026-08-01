import { describe, it, expect } from 'vitest';
import { assignLaunchShortIds } from './launchHasher';

describe('assignLaunchShortIds', () => {
  it('produces deterministic <=6 char ids', () => {
    const a = assignLaunchShortIds(['launch-one', 'launch-two']);
    const b = assignLaunchShortIds(['launch-one', 'launch-two']);
    for (const id of ['launch-one', 'launch-two']) {
      expect(a.get(id)).toBe(b.get(id));
      expect(a.get(id)!.length).toBeLessThanOrEqual(6);
    }
    expect(a.get('launch-one')).not.toBe(a.get('launch-two'));
  });

  it('falls back to full ids when two distinct ids collide on a short id', () => {
    // Force a collision: both ids hash to the same short id.
    const collide = (id: string) => (id === 'x' || id === 'y' ? 'aaaaaa' : id);
    const map = assignLaunchShortIds(['x', 'y', 'z'], collide);
    expect(map.get('x')).toBe('x');
    expect(map.get('y')).toBe('y');
    expect(map.get('z')).toBe('z');
  });

  it('is stable when the same id appears multiple times', () => {
    const map = assignLaunchShortIds(['dup', 'dup', 'dup']);
    expect(map.size).toBe(1);
    expect(map.get('dup')!.length).toBe(6);
  });
});
