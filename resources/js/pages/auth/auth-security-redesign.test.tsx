import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmPassword from '@/pages/auth/confirm-password';
import VerifyEmail from '@/pages/auth/verify-email';

const formState = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
}));

const pageState = vi.hoisted(() => ({
    email: 'operator@example.com',
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
    method?: string;
    as?: string;
    className?: string;
    children: ReactNode;
};

type WayfinderRoute = {
    url?: unknown;
    method?: unknown;
};

/**
 * Resolves the URL portion of a string or Wayfinder route for test rendering.
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

/**
 * Resolves the HTTP method supplied explicitly or by a Wayfinder route object.
 */
function resolveMethod(href: unknown, method?: string): string {
    if (method) {
        return method;
    }

    if (typeof href === 'object' && href !== null && 'method' in href) {
        const routeMethod = (href as WayfinderRoute).method;

        if (typeof routeMethod === 'string') {
            return routeMethod;
        }
    }

    return 'get';
}

vi.mock('@inertiajs/react', () => ({
    Head: () => null,

    usePage: () => ({
        props: {
            auth: {
                user: {
                    id: 1,
                    name: 'ThermaSnap Operator',
                    email: pageState.email,
                    avatar: undefined,
                    email_verified_at: null,
                    created_at: '2026-01-01T00:00:00.000000Z',
                    updated_at: '2026-01-01T00:00:00.000000Z',
                },
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

    Link: ({ href, method, as, className, children }: MockLinkProps) => {
        const resolvedHref = resolveHref(href);
        const resolvedMethod = resolveMethod(href, method);

        if (as === 'button') {
            return (
                <button
                    type="button"
                    className={className}
                    data-href={resolvedHref}
                    data-method={resolvedMethod}
                >
                    {children}
                </button>
            );
        }

        return (
            <a
                href={resolvedHref}
                className={className}
                data-method={resolvedMethod}
            >
                {children}
            </a>
        );
    },
}));

vi.mock('@/components/passkey-verify', () => ({
    default: ({ label }: { label?: string }) => (
        <button type="button">{label ?? 'Sign in with a passkey'}</button>
    ),
}));

beforeEach(() => {
    formState.processing = false;
    formState.errors = {};
    pageState.email = 'operator@example.com';
});

describe('ThermaSnap password confirmation redesign', () => {
    it('preserves the Fortify password and passkey confirmation contracts', () => {
        render(<ConfirmPassword />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Confirm password',
            }),
        ).toBeInTheDocument();

        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'name',
            'password',
        );
        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'autocomplete',
            'current-password',
        );

        expect(
            screen.getByRole('button', {
                name: 'Confirm with passkey',
            }),
        ).toBeInTheDocument();

        expect(
            document.querySelector('[data-test="confirm-password-button"]'),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: /Back to settings/i,
            }),
        ).toHaveAttribute('href', '/settings/profile');
    });

    it('keeps validation, processing, helper text, and password visibility accessible', async () => {
        const user = userEvent.setup();

        formState.processing = true;
        formState.errors = {
            password: 'The password is incorrect.',
        };

        render(<ConfirmPassword />);

        const password = screen.getByLabelText('Password');

        expect(password).toHaveAttribute('aria-invalid', 'true');
        expect(password).toHaveAttribute(
            'aria-describedby',
            'confirm-password-security confirm-password-error',
        );

        expect(screen.getByText('The password is incorrect.')).toHaveAttribute(
            'role',
            'alert',
        );

        expect(screen.getByText(/Your security matters/i)).toBeInTheDocument();

        expect(
            document.querySelector('[data-test="confirm-password-button"]'),
        ).toBeDisabled();

        expect(password).toHaveAttribute('type', 'password');

        await user.click(
            screen.getByRole('button', {
                name: 'Show password',
            }),
        );

        expect(password).toHaveAttribute('type', 'text');

        expect(
            screen.getByRole('button', {
                name: 'Hide password',
            }),
        ).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('ThermaSnap email verification redesign', () => {
    it('renders the authenticated email and preserves resend and logout contracts', () => {
        pageState.email = 'verified-target@example.com';

        render(<VerifyEmail />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Verify your email',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText('verified-target@example.com'),
        ).toBeInTheDocument();

        expect(
            screen.queryByText('alyssa@thermasnap.com'),
        ).not.toBeInTheDocument();

        const resendButton = document.querySelector(
            '[data-test="resend-verification-email-button"]',
        );

        expect(resendButton).toBeInTheDocument();

        const resendForm = resendButton?.closest('form');

        expect(resendForm).toHaveAttribute(
            'action',
            '/email/verification-notification',
        );
        expect(resendForm).toHaveAttribute('method', 'post');

        const logoutButton = screen.getByRole('button', {
            name: /Log out/i,
        });

        expect(logoutButton).toHaveAttribute('data-href', '/logout');
        expect(logoutButton).toHaveAttribute('data-method', 'post');
    });

    it('announces a successful resend and disables resend while processing', () => {
        formState.processing = true;

        render(<VerifyEmail status="verification-link-sent" />);

        expect(
            screen
                .getByText('New verification link sent to')
                .closest('[role="status"]'),
        ).toBeInTheDocument();

        expect(
            document.querySelector(
                '[data-test="resend-verification-email-button"]',
            ),
        ).toBeDisabled();
    });
});
