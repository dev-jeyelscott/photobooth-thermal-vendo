import { render, screen, within } from '@testing-library/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsEdit, { formatSettingsAmount } from './edit';

const formErrors = vi.hoisted(() => ({
    current: {} as Record<string, string>,
}));

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    setLayoutProps: () => {},
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
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

vi.mock('@/components/ui/switch', () => ({
    Switch: (props: InputHTMLAttributes<HTMLInputElement>) => (
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

    it('formats the configured session price using its persisted currency', () => {
        expect(formatSettingsAmount(50, 'PHP')).toContain('50.00');
        expect(formatSettingsAmount(50, 'INVALID')).toBe('INVALID 50.00');
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

    it('renders the redesigned operator settings groups', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.getByRole('heading', {
                name: 'Booth / Print Information',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: 'Pricing & Currency',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: 'Session Timing',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: 'Capture & Print Settings',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: 'Gallery / Retention',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: 'Maintenance / Status',
            }),
        ).toBeInTheDocument();
    });

    it('preserves every existing settings field name', () => {
        render(<SettingsEdit settings={settings} />);

        expect(screen.getByLabelText('Booth display name')).toHaveAttribute(
            'name',
            'booth_display_name',
        );
        expect(screen.getByLabelText('Default printer')).toHaveAttribute(
            'name',
            'default_printer',
        );
        expect(screen.getByLabelText('Receipt header')).toHaveAttribute(
            'name',
            'receipt_header',
        );
        expect(screen.getByLabelText('Receipt footer')).toHaveAttribute(
            'name',
            'receipt_footer',
        );
        expect(screen.getByLabelText('Session price')).toHaveAttribute(
            'name',
            'session_price',
        );
        expect(
            screen.getByLabelText('Currency (ISO 4217 code)'),
        ).toHaveAttribute('name', 'currency');
        expect(screen.getByLabelText('Idle timeout (seconds)')).toHaveAttribute(
            'name',
            'kiosk_idle_timeout_seconds',
        );
        expect(
            screen.getByLabelText('Session timeout (seconds)'),
        ).toHaveAttribute('name', 'session_timeout_seconds');
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
        expect(
            screen.getByLabelText('Gallery expiration (hours)'),
        ).toHaveAttribute('name', 'gallery_expiration_hours');
        expect(
            screen.getByLabelText('GIF frame duration (ms)'),
        ).toHaveAttribute('name', 'gif_frame_duration_ms');
        expect(screen.getByLabelText('Maintenance mode')).toHaveAttribute(
            'name',
            'maintenance_mode',
        );
        expect(screen.getByLabelText('Maintenance message')).toHaveAttribute(
            'name',
            'maintenance_message',
        );
    });

    it('keeps both countdown settings visually and semantically distinct', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.getByLabelText('Default countdown (seconds)'),
        ).toHaveValue(3);
        expect(
            screen.getByLabelText('Capture countdown (seconds)'),
        ).toHaveValue(3);
    });

    it('explains only the proven new-session snapshot behavior', () => {
        render(<SettingsEdit settings={settings} />);

        expect(screen.getAllByText('New-session snapshot')).toHaveLength(1);
        expect(
            screen.getByText(
                /Session price, currency, and default capture count are copied into each new session/i,
            ),
        ).toBeInTheDocument();
    });

    it('renders a truthful summary from existing saved settings only', () => {
        render(<SettingsEdit settings={settings} />);

        const summary = screen.getByLabelText('Settings summary');

        expect(within(summary).getByText('Photobooth')).toBeInTheDocument();
        expect(within(summary).getByText(/50\.00/)).toBeInTheDocument();
        expect(within(summary).getByText('24 hours')).toBeInTheDocument();
        expect(within(summary).getByText('dnp-ds620')).toBeInTheDocument();
        expect(within(summary).getByText('Available')).toBeInTheDocument();
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

    it('keeps save as the only mutation and provides a safe cancel navigation', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.getByRole('button', {
                name: 'Save changes',
            }),
        ).toHaveAttribute('type', 'submit');

        expect(
            screen.getByRole('link', {
                name: 'Cancel',
            }),
        ).toHaveAttribute('href', '/admin/settings');
    });

    it('does not fabricate unsupported screenshot-only settings', () => {
        render(<SettingsEdit settings={settings} />);

        expect(
            screen.queryByLabelText(/contact email/i),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByLabelText(/contact phone/i),
        ).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/service fee/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/software version/i)).not.toBeInTheDocument();
        expect(
            screen.queryByText(/reset to defaults/i),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/last saved/i)).not.toBeInTheDocument();
    });
});
