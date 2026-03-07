import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}));

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// Mock EventSource
class EventSourceMock {
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: any) => void) | null = null; // message data can be any, but we cast usage
  onerror: ((event: unknown) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  close() {}
}

vi.stubGlobal('EventSource', EventSourceMock);

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
