import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from '@/pages/auth/forgot-password';
import Login from '@/pages/auth/login';
import Register from '@/pages/auth/register';
import ResetPassword from '@/pages/auth/reset-password';

const formState = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
}));

type MockFormProps = {
    action?: string;
    method?: string;
    className?: string;
    transform?: (data: Record<string, unknown>) => Record<string, unknown>;
    children: (state: {
        processing: boolean;
        errors: Record<string, string>;
    }) => ReactNode;
};

vi.mock('@inertiajs/react', () => ({
    Head: () => null,

    Link: ({
        href,
        children,
        ...props
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: unknown;
        children: ReactNode;
    }) => {
        const resolvedHref =
            typeof href === 'string'
                ? href
                : typeof href === 'object' && href !== null && 'url' in href
                  ? String((href as { url: unknown }).url)
                  : '#';

        return (
            <a href={resolvedHref} {...props}>
                {children}
            </a>
        );
    },

    Form: ({
        action,
        method,
        className,
        transform,
        children,
    }: MockFormProps) => {
        const transformedData = transform?.({
            password: 'Example123!',
            password_confirmation: 'Example123!',
        });

        return (
            <form action={action} method={method} className={className}>
                {transformedData &&
                    typeof transformedData.token === 'string' && (
                        <input
                            type="hidden"
                            data-testid="mock-transform-token"
                            value={transformedData.token}
                            readOnly
                        />
                    )}

                {transformedData &&
                    typeof transformedData.email === 'string' && (
                        <input
                            type="hidden"
                            data-testid="mock-transform-email"
                            value={transformedData.email}
                            readOnly
                        />
                    )}

                {children({
                    processing: formState.processing,
                    errors: formState.errors,
                })}
            </form>
        );
    },
}));

vi.mock('@/components/passkey-verify', () => ({
    default: () => null,
}));

beforeEach(() => {
    formState.processing = false;
    formState.errors = {};
});

describe('ThermaSnap authentication redesign', () => {
    it('preserves the login browser payload and navigation contract', () => {
        render(<Login canResetPassword status="Password reset successful." />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Sign in',
            }),
        ).toBeInTheDocument();

        expect(screen.getByLabelText('Email address')).toHaveAttribute(
            'name',
            'email',
        );
        expect(screen.getByLabelText('Email address')).toHaveAttribute(
            'autocomplete',
            'email',
        );

        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'name',
            'password',
        );
        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'autocomplete',
            'current-password',
        );

        expect(
            screen.getByRole('checkbox', {
                name: 'Remember me',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: 'Forgot password?',
            }),
        ).toHaveAttribute('href', '/forgot-password');

        expect(
            screen.getByRole('link', {
                name: 'Create an account',
            }),
        ).toHaveAttribute('href', '/register');

        expect(screen.getByText('Password reset successful.')).toHaveAttribute(
            'role',
            'status',
        );

        expect(
            document.querySelector('[data-test="login-button"]'),
        ).toBeInTheDocument();
    });

    it('keeps login validation, processing, and password visibility accessible', async () => {
        const user = userEvent.setup();

        formState.processing = true;
        formState.errors = {
            email: 'These credentials do not match our records.',
        };

        render(<Login canResetPassword />);

        expect(screen.getByLabelText('Email address')).toHaveAttribute(
            'aria-invalid',
            'true',
        );

        expect(
            screen.getByText('These credentials do not match our records.'),
        ).toHaveAttribute('role', 'alert');

        expect(
            document.querySelector('[data-test="login-button"]'),
        ).toBeDisabled();

        const password = screen.getByLabelText('Password');

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

    it('preserves registration fields and derives password guidance from server rules', () => {
        const passwordRules =
            'minlength: 12; required: upper; required: lower; required: digit; required: special;';

        render(<Register passwordRules={passwordRules} />);

        expect(screen.getByLabelText('Full name')).toHaveAttribute(
            'name',
            'name',
        );
        expect(screen.getByLabelText('Email address')).toHaveAttribute(
            'name',
            'email',
        );
        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'name',
            'password',
        );
        expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
            'name',
            'password_confirmation',
        );

        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'passwordrules',
            passwordRules,
        );

        expect(
            screen.getByText(
                'Password must include at least 12 characters, upper and lowercase letters, a number, and a symbol.',
            ),
        ).toBeInTheDocument();

        expect(
            document.querySelector('[data-test="register-user-button"]'),
        ).toBeInTheDocument();

        const backToLoginLinks = screen.getAllByRole('link', {
            name: 'Back to login',
        });

        expect(backToLoginLinks.length).toBeGreaterThan(0);

        backToLoginLinks.forEach((link) => {
            expect(link).toHaveAttribute('href', '/login');
        });
    });

    it('preserves the forgot-password status and email submission contract', () => {
        render(
            <ForgotPassword status="We have emailed your password reset link." />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Forgot your password?',
            }),
        ).toBeInTheDocument();

        expect(screen.getByLabelText('Email address')).toHaveAttribute(
            'name',
            'email',
        );
        expect(screen.getByLabelText('Email address')).toBeRequired();

        expect(
            document.querySelector(
                '[data-test="email-password-reset-link-button"]',
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByText('We have emailed your password reset link.'),
        ).toHaveAttribute('role', 'status');

        expect(
            screen.getByRole('link', {
                name: /Back to login/i,
            }),
        ).toHaveAttribute('href', '/login');
    });

    it('keeps the reset token and authoritative email in the Fortify transform', () => {
        const passwordRules = 'minlength: 8;';

        render(
            <ResetPassword
                token="reset-token"
                email="operator@example.com"
                passwordRules={passwordRules}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Reset password',
            }),
        ).toBeInTheDocument();

        expect(screen.getByLabelText('Email address')).toHaveValue(
            'operator@example.com',
        );
        expect(screen.getByLabelText('Email address')).toHaveAttribute(
            'readonly',
        );

        expect(screen.getByTestId('mock-transform-token')).toHaveValue(
            'reset-token',
        );
        expect(screen.getByTestId('mock-transform-email')).toHaveValue(
            'operator@example.com',
        );

        expect(screen.getByLabelText('New password')).toHaveAttribute(
            'name',
            'password',
        );
        expect(screen.getByLabelText('Confirm new password')).toHaveAttribute(
            'name',
            'password_confirmation',
        );

        expect(
            document.querySelector('[data-test="reset-password-button"]'),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: /Back to login/i,
            }),
        ).toHaveAttribute('href', '/login');
    });
});
