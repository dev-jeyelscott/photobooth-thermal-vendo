import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Welcome from '@/pages/welcome';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({
        href,
        children,
        ...props
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: string;
        children: ReactNode;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe('welcome page', () => {
    it('renders the public ThermaSnap entry experience', () => {
        render(<Welcome />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Capture it. Print it. Take it with you.',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /A simple public entry point for the ThermaSnap experience\./,
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'Start Photobooth' }),
        ).toHaveAttribute('href', '/kiosk');
        expect(
            screen.getByRole('link', { name: 'How it works' }),
        ).toHaveAttribute('href', '#how-it-works');

        expect(screen.getByText('1. Start')).toBeInTheDocument();
        expect(screen.getByText('2. Capture')).toBeInTheDocument();
        expect(screen.getByText('3. Print & download')).toBeInTheDocument();
    });

    it('keeps the public page free of authenticated navigation', () => {
        const { container } = render(<Welcome />);

        expect(container.querySelector('#how-it-works')).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /dashboard/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /log in/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /register/i }),
        ).not.toBeInTheDocument();
    });
});
