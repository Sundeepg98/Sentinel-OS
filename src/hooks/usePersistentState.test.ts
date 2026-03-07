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
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe('usePersistentState hook', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      },
      removeItem: (key: string) => {
        delete store[key];
      },
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

    const { result } = renderHook(() => usePersistentState('test-key', 'default'));
    expect(result.current[0]).toBe('local-val');
  });

  it('initializes with default value if localStorage is empty', async () => {
    const { result } = renderHook(() => usePersistentState('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('updates localStorage on value change', async () => {
    const { result } = renderHook(() => usePersistentState<string>('test-key', 'default'));

    await act(async () => {
      result.current[1]('new-val');
    });

    expect(localStorageMock.getItem('test-key')).toBe(JSON.stringify('new-val'));
  });
});
