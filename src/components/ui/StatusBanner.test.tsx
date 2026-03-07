import { render } from '@testing-library/react';
import { StatusBanner } from './StatusBanner';
import { describe, it, expect } from 'vitest';

describe('StatusBanner', () => {
  it('renders correctly when offline', () => {
    const { getByRole, getByText } = render(<StatusBanner online={false} syncing={false} />);
    expect(getByRole('alert')).toBeDefined();
    expect(getByText(/Connection Lost/i)).toBeDefined();
  });

  it('renders correctly when syncing', () => {
    const { getByRole, getByText } = render(<StatusBanner online={true} syncing={true} />);
    expect(getByRole('status')).toBeDefined();
    expect(getByText(/Re-Indexing/i)).toBeDefined();
  });

  it('renders nothing when online and not syncing', () => {
    const { container } = render(<StatusBanner online={true} syncing={false} />);
    // Check if the container has no visible children from motion.div
    expect(container.querySelector('.fixed')).toBeNull();
  });
});
