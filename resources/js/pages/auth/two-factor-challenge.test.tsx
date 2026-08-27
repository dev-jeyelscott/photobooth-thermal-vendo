import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
    AnchorHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TwoFactorChallenge from '@/pages/auth/two-factor-challenge';

const formState = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
}));

const clearErrorsMock = vi.hoisted(() => vi.fn());

type MockFormProps = {
    action?: string;
    method?: string;
    className?: string;
    children: (state: {
        processing: boolean;
        errors: Record<string, string>;
        clearErrors: () => void;
    }) => ReactNode;
};

type MockInputOtpProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'children' | 'onChange'
> & {
    children?: ReactNode;
    containerClassName?: string;
    onChange?: (value: string) => void;
};

vi.mock('@/components/ui/input-otp', () => ({
    /**
     * Represent the OTP primitive with its page-facing input contract only.
     *
     * The third-party input-otp implementation owns browser measurement and
     * password-manager timers that are outside this page contract test. Keeping
     * those timers out of this test prevents work from surviving jsdom teardown
     * while preserving controlled-value and accessibility behavior.
     */
    InputOTP: ({ onChange, ...props }: MockInputOtpProps) => (
        <input
            {...props}
            onChange={(event) => onChange?.(event.currentTarget.value)}
        />
    ),

    /**
     * Preserve the child structure expected by the authentication page without
     * introducing any third-party OTP runtime behavior.
     */
    InputOTPGroup: ({ children }: { children?: ReactNode }) => <>{children}</>,

    /**
     * Individual visual OTP slots are presentation-only for these page contract
     * tests because the mocked input above owns the actual form value.
     */
    InputOTPSlot: () => null,
}));

vi.mock('@inertiajs/react', () => ({
    Head: () => null,

    /**
     * Render generated Inertia links as plain anchors for DOM contract tests.
     */
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

    Form: ({ action, method, className, children }: MockFormProps) => (
        <form action={action} method={method} className={className}>
            {children({
                processing: formState.processing,
                errors: formState.errors,
                clearErrors: clearErrorsMock,
            })}
        </form>
    ),
}));

beforeEach(() => {
    formState.processing = false;
    formState.errors = {};
    clearErrorsMock.mockReset();
});

describe('ThermaSnap two-factor challenge redesign', () => {
    it('preserves the Fortify authentication-code field and route contract', async () => {
        const user = userEvent.setup();

        render(<TwoFactorChallenge />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Two-factor authentication',
            }),
        ).toBeInTheDocument();

        const authenticationCode = screen.getByLabelText('Authentication code');

        expect(authenticationCode).toHaveAttribute('name', 'code');
        expect(authenticationCode).toHaveAttribute('maxlength', '6');

        await user.type(authenticationCode, '123456');

        expect(authenticationCode).toHaveValue('123456');

        const verifyButton = screen.getByRole('button', {
            name: 'Verify',
        });

        expect(verifyButton.closest('form')).toHaveAttribute(
            'action',
            '/two-factor-challenge',
        );
        expect(verifyButton.closest('form')).toHaveAttribute('method', 'post');

        expect(
            document.querySelector('input[name="recovery_code"]'),
        ).not.toBeInTheDocument();
    });

    it('switches to the exact recovery-code field and clears stale state', async () => {
        const user = userEvent.setup();

        render(<TwoFactorChallenge />);

        const authenticationMethodGroup = screen.getByRole('radiogroup', {
            name: 'Authentication method',
        });

        expect(
            screen.getByRole('radio', {
                name: 'Authentication code',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        await user.click(
            screen.getByRole('radio', {
                name: 'Recovery code',
            }),
        );

        const recoveryCode = screen.getByLabelText('Recovery code');

        expect(recoveryCode).toHaveAttribute('name', 'recovery_code');
        expect(recoveryCode).toBeRequired();

        expect(
            document.querySelector('input[name="code"]'),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole('radio', {
                name: 'Recovery code',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        expect(authenticationMethodGroup).toBeInTheDocument();
        expect(clearErrorsMock).toHaveBeenCalledTimes(1);

        await user.click(
            screen.getByRole('radio', {
                name: 'Authentication code',
            }),
        );

        expect(screen.getByLabelText('Authentication code')).toHaveAttribute(
            'name',
            'code',
        );

        expect(
            screen.getByRole('radio', {
                name: 'Authentication code',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        expect(clearErrorsMock).toHaveBeenCalledTimes(2);
    });

    it('associates the authentication-code validation error accessibly', () => {
        formState.errors = {
            code: 'The provided two factor authentication code was invalid.',
        };

        render(<TwoFactorChallenge />);

        const authenticationCode = screen.getByLabelText('Authentication code');

        expect(authenticationCode).toHaveAttribute('aria-invalid', 'true');
        expect(authenticationCode).toHaveAttribute(
            'aria-describedby',
            'two-factor-code-help two-factor-code-error',
        );

        expect(
            screen.getByText(
                'The provided two factor authentication code was invalid.',
            ),
        ).toHaveAttribute('role', 'alert');
    });

    it('disables verification and the active code field while processing', () => {
        formState.processing = true;

        render(<TwoFactorChallenge />);

        const verifyButton = document.querySelector(
            '[data-test="two-factor-challenge-button"]',
        );

        expect(verifyButton).toBeInstanceOf(HTMLButtonElement);
        expect(verifyButton).toBeDisabled();

        expect(screen.getByLabelText('Authentication code')).toBeDisabled();

        expect(
            screen.getByRole('status', {
                name: 'Loading',
            }),
        ).toBeInTheDocument();
    });
});
