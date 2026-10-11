import { describe, expect, it } from 'vitest';
import {
  OFFLINE_PHASES,
  OFFLINE_PHASE_KEY,
  currentOfflinePhase,
  nextOfflinePhase,
} from './offline-phases';

describe('offline phase machine', () => {
  it('starts at seed when nothing is stored', () => {
    expect(nextOfflinePhase(null)).toBe('seed');
  });
  it('advances seed to offline-cold-start', () => {
    expect(nextOfflinePhase('seed')).toBe('offline-cold-start');
  });
  it('advances offline-cold-start to done', () => {
    expect(nextOfflinePhase('offline-cold-start')).toBe('done');
  });
  it('stays done once done', () => {
    expect(nextOfflinePhase('done')).toBe('done');
  });
  it('treats garbage as a first launch', () => {
    expect(nextOfflinePhase('nonsense')).toBe('seed');
    expect(nextOfflinePhase('')).toBe('seed');
  });
  it('resolves the phase to run on this launch', () => {
    expect(currentOfflinePhase(null)).toBe('seed');
    expect(currentOfflinePhase('offline-cold-start')).toBe('offline-cold-start');
    expect(currentOfflinePhase('done')).toBe('done');
    expect(currentOfflinePhase('x')).toBe('seed');
  });
  it('exposes the key and ordered phases', () => {
    expect(OFFLINE_PHASE_KEY).toBe('kitcha:e2e-offline-phase');
    expect([...OFFLINE_PHASES]).toEqual(['seed', 'offline-cold-start', 'done']);
  });
});
