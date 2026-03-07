import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('test-token'),
  }),
}));

// Mock API
const fetchWithAuthMock = vi.fn();
vi.mock('@/lib/api', () => ({
  fetchWithAuth: (...args: any[]) => fetchWithAuthMock(...args),
}));

describe('usePersistentState hook', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value.toString(); },
      clear: () => { store = {}; },
      removeItem: (key: string) => { delete store[key]; }
    };
  })();

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
    vi.clearAllMocks();
    fetchWithAuthMock.mockResolvedValue({ value: null }); // Default no cloud value
  });

  it('initializes with value from localStorage if present', async () => {
    localStorageMock.setItem('test-key', JSON.stringify('local-val'));
    
    let result: any;
    await act(async () => {
      const hook = renderHook(() => usePersistentState('test-key', 'default'));
      result = hook.result;
    });

    expect(result.current[0]).toBe('local-val');
  });

  it('initializes with default value if localStorage is empty', async () => {
    let result: any;
    await act(async () => {
      const hook = renderHook(() => usePersistentState('test-key', 'default'));
      result = hook.result;
    });
    expect(result.current[0]).toBe('default');
  });

  it('updates localStorage on value change', async () => {
    let result: any;
    await act(async () => {
      const hook = renderHook(() => usePersistentState('test-key', 'default'));
      result = hook.result;
    });
    
    await act(async () => {
      result.current[1]('new-val');
    });

    expect(localStorageMock.getItem('test-key')).toBe(JSON.stringify('new-val'));
  });
});
