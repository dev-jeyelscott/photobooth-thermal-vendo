import { render, screen } from '@testing-library/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
            {children({
                processing: false,
                errors: formErrors.current,
            })}
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

describe('settings edit', () => {
    beforeEach(() => {
        formErrors.current = {};
    });

    it('associates validation errors with their fields', () => {
        formErrors.current = {
            session_price: 'The session price must be at least 0.01.',
        };

        render(<SettingsEdit settings={settings} />);

        const sessionPriceInput = screen.getByLabelText('Session price');

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
    });

    it('renders the operator settings sections', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.getByRole('heading', { name: 'Pricing & Currency' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Capture Experience' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Session & Gallery' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: 'Booth Identity & Printing',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Maintenance Mode' }),
        ).toBeInTheDocument();
    });

    it('preserves every existing settings field name', () => {
        render(<SettingsEdit settings={settings} />);

        expect(screen.getByLabelText('Session price')).toHaveAttribute(
            'name',
            'session_price',
        );
        expect(
            screen.getByLabelText('Currency (ISO 4217 code)'),
        ).toHaveAttribute('name', 'currency');
        expect(screen.getByLabelText('Default capture count')).toHaveAttribute(
            'name',
            'capture_shot_count',
        );
        expect(
            screen.getByLabelText('Default countdown (seconds)'),
        ).toHaveAttribute('name', 'countdown_seconds');
        expect(
            screen.getByLabelText('Capture countdown (seconds)'),
        ).toHaveAttribute('name', 'capture_countdown_seconds');
        expect(screen.getByLabelText('Retake limit')).toHaveAttribute(
            'name',
            'retake_limit',
        );
        expect(screen.getByLabelText('Idle timeout (seconds)')).toHaveAttribute(
            'name',
            'kiosk_idle_timeout_seconds',
        );
        expect(
            screen.getByLabelText('Session timeout (seconds)'),
        ).toHaveAttribute('name', 'session_timeout_seconds');
        expect(
            screen.getByLabelText('Gallery expiration (hours)'),
        ).toHaveAttribute('name', 'gallery_expiration_hours');
        expect(
            screen.getByLabelText('GIF frame duration (ms)'),
        ).toHaveAttribute('name', 'gif_frame_duration_ms');
        expect(screen.getByLabelText('Default printer')).toHaveAttribute(
            'name',
            'default_printer',
        );
        expect(screen.getByLabelText('Booth display name')).toHaveAttribute(
            'name',
            'booth_display_name',
        );
        expect(screen.getByLabelText('Receipt header')).toHaveAttribute(
            'name',
            'receipt_header',
        );
        expect(screen.getByLabelText('Receipt footer')).toHaveAttribute(
            'name',
            'receipt_footer',
        );
        expect(screen.getByLabelText('Maintenance mode')).toHaveAttribute(
            'name',
            'maintenance_mode',
        );
        expect(screen.getByLabelText('Maintenance message')).toHaveAttribute(
            'name',
            'maintenance_message',
        );
    });

    it('keeps the two countdown settings visually distinct', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.getByLabelText('Default countdown (seconds)'),
        ).toHaveValue(3);
        expect(
            screen.getByLabelText('Capture countdown (seconds)'),
        ).toHaveValue(3);
    });

    it('explains only the currently proven new-session snapshots', () => {
        render(<SettingsEdit settings={settings} />);

        expect(screen.getAllByText('New-session snapshot')).toHaveLength(1);
        expect(
            screen.getByText(
                /Session price, currency, and default capture count are copied into each new session/i,
            ),
        ).toBeInTheDocument();
    });

    it('presents maintenance mode without implying active sessions are destroyed', () => {
        render(<SettingsEdit settings={settings} />);

        const maintenanceMode = screen.getByRole('checkbox', {
            name: 'Maintenance mode',
        });

        expect(maintenanceMode).not.toBeChecked();
        expect(
            screen.getByText(
                /Blocks creation of new kiosk sessions. Already-authorized sessions can continue./i,
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('Maintenance message'),
        ).toBeInTheDocument();
    });

    it('keeps the save action inside the form as a submit button', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.getByRole('button', { name: 'Save changes' }),
        ).toHaveAttribute('type', 'submit');
    });
});
