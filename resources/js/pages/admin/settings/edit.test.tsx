import { render, screen } from '@testing-library/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SettingsEdit from './edit';

const formErrors = vi.hoisted(() => ({
    current: {} as Record<string, string>,
}));

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    setLayoutProps: () => {},
    Form: ({
        children,
    }: {
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form>
            {children({ processing: false, errors: formErrors.current })}
        </form>
    ),
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: (props: InputHTMLAttributes<HTMLInputElement>) => (
        <input type="checkbox" {...props} />
    ),
}));

const settings = {
    session_price: 50,
    currency: 'PHP',
    countdown_seconds: 3,
    capture_shot_count: 4,
    capture_countdown_seconds: 3,
    retake_limit: 2,
    kiosk_idle_timeout_seconds: 60,
    session_timeout_seconds: 300,
    gallery_expiration_hours: 24,
    gif_frame_duration_ms: 200,
    default_printer: 'dnp-ds620',
    booth_display_name: 'Photobooth',
    receipt_header: null,
    receipt_footer: null,
    maintenance_mode: false,
    maintenance_message: null,
};

describe('settings edit accessibility', () => {
    it('associates a validation error with its field via aria-describedby', () => {
        formErrors.current = {
            session_price: 'The session price must be at least 0.01.',
        };

        render(<SettingsEdit settings={settings} />);

        const sessionPriceInput = screen.getByLabelText('Session price (PHP)');
        expect(sessionPriceInput).toHaveAttribute('aria-invalid', 'true');
        expect(sessionPriceInput).toHaveAttribute(
            'aria-describedby',
            'session_price-error',
        );

        const message = screen.getByText(
            'The session price must be at least 0.01.',
        );
        expect(message).toHaveAttribute('id', 'session_price-error');
        expect(message).toHaveAttribute('role', 'alert');

        formErrors.current = {};
    });
});
