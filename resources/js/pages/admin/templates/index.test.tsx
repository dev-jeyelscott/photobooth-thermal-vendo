import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TemplatesIndex from './index';

vi.mock('@inertiajs/react', () => ({
    Form: () => null,
    Head: () => null,
    Link: ({ children }: { children: ReactNode }) => (
        <a href="/admin/templates/create">{children}</a>
    ),
    router: {
        patch: vi.fn(),
    },
    setLayoutProps: vi.fn(),
}));

describe('templates index page contract', () => {
    it('renders the templates payload without requiring sticker props', () => {
        render(<TemplatesIndex templates={[]} />);

        expect(
            screen.getByRole('heading', { name: 'Templates' }),
        ).toBeInTheDocument();

        expect(screen.getByText('No templates yet.')).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'New template' }),
        ).toBeInTheDocument();
    });
});
