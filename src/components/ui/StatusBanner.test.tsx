import { render, screen } from '@testing-library/react';
import { StatusBanner } from './StatusBanner';
import { describe, it, expect } from 'vitest';

describe('StatusBanner', () => {
  it('renders correctly when offline', () => {
    render(<StatusBanner online={false} />);
    expect(screen.getByText(/Connection Lost/i)).toBeInTheDocument();
  });

  it('renders correctly when syncing', () => {
    render(<StatusBanner online={true} syncing={true} />);
    expect(screen.getByText(/Neural Re-Indexing/i)).toBeInTheDocument();
  });

  it('is hidden when online and not syncing', () => {
    const { container } = render(<StatusBanner online={true} syncing={false} />);
    // Check if the container has no visible children from motion.div
    expect(container.querySelector('.fixed')).toBeNull();
  });
});
