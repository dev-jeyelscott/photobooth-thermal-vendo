import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from '@/pages/settings/profile';

const formState = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
}));

const setLayoutPropsMock = vi.hoisted(() => vi.fn());

const pageState = vi.hoisted(() => ({
    user: {
        id: 17,
        name: 'ThermaSnap Operator',
        email: 'operator@thermasnap.test',
        email_verified_at: '2026-08-20T08:00:00.000000Z' as string | null,
        created_at: '2026-08-01T08:00:00.000000Z',
        updated_at: '2026-08-20T08:00:00.000000Z',
    },
}));

type MockFormProps = {
    action?: string;
    method?: string;
    className?: string;
    children: (state: {
        processing: boolean;
        errors: Record<string, string>;
    }) => ReactNode;
};

type MockLinkProps = {
    href: unknown;
    as?: string;
    className?: string;
    children: ReactNode;
};

type WayfinderRoute = {
    url?: unknown;
};

/**
 * Resolve a string or generated Wayfinder route into a browser href for tests.
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
                user: pageState.user,
            },
        },
    }),

    Form: ({ action, method, className, children }: MockFormProps) => (
        <form action={action} method={method} className={className}>
            {children({
                processing: formState.processing,
                errors: formState.errors,
            })}
        </form>
    ),

    Link: ({ href, as, className, children }: MockLinkProps) => {
        const resolvedHref = resolveHref(href);

        if (as === 'button') {
            return (
                <button
                    type="button"
                    className={className}
                    data-href={resolvedHref}
                >
                    {children}
                </button>
            );
        }

        return (
            <a href={resolvedHref} className={className}>
                {children}
            </a>
        );
    },
}));

vi.mock('@/components/delete-user', () => ({
    default: () => <section aria-label="Delete account" />,
}));

beforeEach(() => {
    formState.processing = false;
    formState.errors = {};

    pageState.user.id = 17;
    pageState.user.name = 'ThermaSnap Operator';
    pageState.user.email = 'operator@thermasnap.test';
    pageState.user.email_verified_at = '2026-08-20T08:00:00.000000Z';
    pageState.user.created_at = '2026-08-01T08:00:00.000000Z';
    pageState.user.updated_at = '2026-08-20T08:00:00.000000Z';

    setLayoutPropsMock.mockReset();
});

describe('ThermaSnap profile settings redesign', () => {
    it('preserves the exact supported profile mutation fields', () => {
        render(
            <Profile
                mustVerifyEmail
                canManageTwoFactor
                twoFactorEnabled={false}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Profile Settings',
            }),
        ).toBeInTheDocument();

        const name = screen.getByLabelText('Full name');
        const email = screen.getByLabelText('Email address');

        expect(name).toHaveAttribute('name', 'name');
        expect(name).toHaveValue('ThermaSnap Operator');

        expect(email).toHaveAttribute('name', 'email');
        expect(email).toHaveValue('operator@thermasnap.test');

        const profileForm = name.closest('form');

        expect(profileForm).toHaveAttribute(
            'action',
            '/settings/profile?_method=PATCH',
        );
        expect(profileForm).toHaveAttribute('method', 'post');

        expect(
            screen.queryByLabelText(/mobile number/i),
        ).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/timezone/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();

        expect(
            document.querySelector('[data-test="update-profile-button"]'),
        ).toBeInTheDocument();
    });

    it('renders only account facts supported by current user data', () => {
        render(
            <Profile
                mustVerifyEmail
                canManageTwoFactor
                twoFactorEnabled={false}
            />,
        );

        expect(screen.getByText('#17')).toBeInTheDocument();
        expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(screen.getAllByText('Not enabled').length).toBeGreaterThan(0);

        expect(screen.queryByText(/linked booths/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/access level/i)).not.toBeInTheDocument();
    });

    it('preserves unverified-email guidance and resend navigation', () => {
        pageState.user.email_verified_at = null;

        render(
            <Profile
                mustVerifyEmail
                status="verification-link-sent"
                canManageTwoFactor
                twoFactorEnabled={false}
            />,
        );

        expect(
            screen.getByText(/email address is not verified/i),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Resend verification email',
            }),
        ).toHaveAttribute('data-href', '/email/verification-notification');

        expect(
            screen.getByText(
                'A new verification link has been sent to your email address.',
            ),
        ).toHaveAttribute('role', 'status');

        expect(screen.getByText('Unverified')).toBeInTheDocument();
    });

    it('routes password and two-factor management to existing security settings', () => {
        render(<Profile mustVerifyEmail canManageTwoFactor twoFactorEnabled />);

        expect(
            screen.getByRole('link', {
                name: /Change password/i,
            }),
        ).toHaveAttribute('href', '/settings/security');

        expect(
            screen.getByRole('link', {
                name: /Manage 2FA/i,
            }),
        ).toHaveAttribute('href', '/settings/security');

        expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);
    });

    it('associates errors and disables save while processing', () => {
        formState.processing = true;
        formState.errors = {
            name: 'The name field is required.',
        };

        render(
            <Profile
                mustVerifyEmail
                canManageTwoFactor
                twoFactorEnabled={false}
            />,
        );

        expect(screen.getByLabelText('Full name')).toHaveAttribute(
            'aria-invalid',
            'true',
        );

        expect(screen.getByText('The name field is required.')).toHaveAttribute(
            'role',
            'alert',
        );

        expect(
            document.querySelector('[data-test="update-profile-button"]'),
        ).toBeDisabled();
    });
});
