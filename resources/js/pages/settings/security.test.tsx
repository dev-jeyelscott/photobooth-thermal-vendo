import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Security from '@/pages/settings/security';

const setLayoutPropsMock = vi.hoisted(() => vi.fn());

const formState = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
}));

type MockFormProps = {
    action?: string;
    method?: string;
    children: (state: {
        processing: boolean;
        errors: Record<string, string>;
    }) => ReactNode;
};

type MockLinkProps = {
    href: unknown;
    children: ReactNode;
};

type WayfinderRoute = {
    url?: unknown;
};

/**
 * Resolve generated Wayfinder routes for DOM assertions.
 */
function resolveHref(href: unknown): string {
    if (typeof href === 'string') {
        return href;
    }

    if (typeof href === 'object' && href !== null && 'url' in href) {
        return String((href as WayfinderRoute).url);
    }

    return '#';
}

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    setLayoutProps: setLayoutPropsMock,

    usePage: () => ({
        props: {
            auth: {
                user: {
                    id: 17,
                    name: 'ThermaSnap Operator',
                    email: 'operator@thermasnap.test',
                    email_verified_at: '2026-08-20T08:00:00.000000Z',
                    created_at: '2026-08-01T08:00:00.000000Z',
                    updated_at: '2026-08-20T08:00:00.000000Z',
                },
            },
        },
    }),

    Link: ({ href, children }: MockLinkProps) => (
        <a href={resolveHref(href)}>{children}</a>
    ),

    Form: ({ action, method, children }: MockFormProps) => (
        <form action={action} method={method}>
            {children({
                processing: formState.processing,
                errors: formState.errors,
            })}
        </form>
    ),
}));

vi.mock('@/hooks/use-appearance', () => ({
    useAppearance: () => ({
        density: 'balanced',
    }),
}));

vi.mock('@/components/manage-two-factor', () => ({
    default: ({
        canManageTwoFactor,
        twoFactorEnabled,
    }: {
        canManageTwoFactor?: boolean;
        twoFactorEnabled?: boolean;
    }) =>
        canManageTwoFactor ? (
            <section aria-label="Two-factor authentication">
                {twoFactorEnabled ? '2FA enabled' : '2FA not enabled'}
            </section>
        ) : null,
}));

vi.mock('@/components/manage-passkeys', () => ({
    default: ({ canManagePasskeys }: { canManagePasskeys?: boolean }) =>
        canManagePasskeys ? (
            <section aria-label="Passkeys">Passkey management</section>
        ) : null,
}));

beforeEach(() => {
    formState.processing = false;
    formState.errors = {};
    setLayoutPropsMock.mockReset();
});

describe('ThermaSnap security settings redesign', () => {
    it('preserves the password mutation contract', () => {
        render(
            <Security
                passwordRules="required|min:8"
                activeSessions={[]}
                canManageTwoFactor
                twoFactorEnabled={false}
                canManagePasskeys
                passkeys={[]}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Security Settings',
            }),
        ).toBeInTheDocument();

        expect(screen.getByLabelText('Current Password')).toHaveAttribute(
            'name',
            'current_password',
        );
        expect(screen.getByLabelText('New Password')).toHaveAttribute(
            'name',
            'password',
        );
        expect(screen.getByLabelText('Confirm New Password')).toHaveAttribute(
            'name',
            'password_confirmation',
        );

        expect(
            document.querySelector('[data-test="update-password-button"]'),
        ).toBeInTheDocument();
    });

    it('renders only truthful security summary evidence', () => {
        render(
            <Security
                passwordRules="required|min:8"
                activeSessions={[]}
                canManageTwoFactor
                twoFactorEnabled
                canManagePasskeys
                passkeys={[
                    {
                        id: 1,
                        name: 'Laptop',
                        authenticator: null,
                        created_at_diff: 'today',
                        last_used_at_diff: null,
                    },
                ]}
            />,
        );

        expect(
            screen.getByText('operator@thermasnap.test'),
        ).toBeInTheDocument();
        expect(screen.getByText('1 enrolled')).toBeInTheDocument();

        expect(screen.queryByText(/strong password/i)).not.toBeInTheDocument();
        expect(
            screen.queryByText(/suspicious activity/i),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(/mandaluyong|quezon city/i),
        ).not.toBeInTheDocument();
    });

    it('does not expose a revoke action for the current session', () => {
        render(
            <Security
                passwordRules="required|min:8"
                activeSessions={[
                    {
                        id: 'current',
                        device: 'Chrome on Windows',
                        ipAddress: '192.0.2.10',
                        lastActiveAt: '2026-08-20T08:00:00.000Z',
                        isCurrent: true,
                    },
                    {
                        id: 'other',
                        device: 'Safari on iOS',
                        ipAddress: '192.0.2.20',
                        lastActiveAt: '2026-08-19T08:00:00.000Z',
                        isCurrent: false,
                    },
                ]}
                canManageTwoFactor
                twoFactorEnabled={false}
                canManagePasskeys
                passkeys={[]}
            />,
        );

        const currentSession = screen
            .getByText('Current session')
            .closest('tr');

        expect(currentSession).not.toBeNull();
        expect(currentSession?.querySelector('button')).toBeNull();

        expect(
            screen.getByRole('button', {
                name: 'Revoke',
            }),
        ).toBeInTheDocument();
    });
});
