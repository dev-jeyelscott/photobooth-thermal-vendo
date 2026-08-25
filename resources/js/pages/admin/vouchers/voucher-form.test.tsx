import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import VoucherForm from './voucher-form';

const formErrors = vi.hoisted(() => ({
    current: {} as Record<string, string>,
}));

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action: string;
        method: string;
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form action={action} method={method}>
            {children({ processing: false, errors: formErrors.current })}
        </form>
    ),
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: ({
        checked,
        onCheckedChange,
        ...props
    }: Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange'> & {
        checked?: boolean | 'indeterminate';
        onCheckedChange?: (checked: boolean) => void;
    }) => (
        <input
            type="checkbox"
            {...props}
            checked={checked === true}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
    ),
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: () => null,
    DialogDescription: ({ children }: { children: ReactNode }) => (
        <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const existingVoucher = {
    id: 42,
    code: 'PROMO-2030',
    active: false,
    validFrom: '2030-01-02T03:04:00.000000Z',
    expiresAt: '2030-02-03T04:05:00.000000Z',
    usageLimit: 10,
    usageCount: 3,
    redemptions: [],
};

describe('voucher form browser payload contract', () => {
    it('submits an explicit Laravel boolean value for active', () => {
        const { container } = render(
            <VoucherForm
                form={{ action: '/admin/vouchers', method: 'post' }}
            />,
        );

        expect(
            container.querySelector(
                'input[type="hidden"][name="active"][value="0"]',
            ),
        ).toBeInTheDocument();

        const activeCheckbox = screen.getByRole('checkbox', {
            name: 'Active',
        });

        expect(activeCheckbox).toBeChecked();
        expect(activeCheckbox).toHaveAttribute('value', '1');
    });

    it('prepopulates existing voucher values and preserves inactive state', () => {
        render(
            <VoucherForm
                form={{
                    action: '/admin/vouchers/42?_method=PUT',
                    method: 'post',
                }}
                voucher={existingVoucher}
            />,
        );

        expect(screen.getByLabelText('Voucher code')).toHaveValue('PROMO-2030');
        expect(screen.getByLabelText('Valid from (optional)')).toHaveValue(
            '2030-01-02T03:04',
        );
        expect(screen.getByLabelText('Expiration date (optional)')).toHaveValue(
            '2030-02-03T04:05',
        );
        expect(screen.getByLabelText('Usage limit')).toHaveValue(10);
        expect(
            screen.getByRole('checkbox', { name: 'Active' }),
        ).not.toBeChecked();
    });

    it('displays usage count without submitting it as editable form data', () => {
        const { container } = render(
            <VoucherForm
                form={{
                    action: '/admin/vouchers/42?_method=PUT',
                    method: 'post',
                }}
                voucher={existingVoucher}
            />,
        );

        expect(screen.getByLabelText('Usage count')).toHaveValue(3);
        expect(
            container.querySelector('input[name="usage_count"]'),
        ).not.toBeInTheDocument();
    });

    it('keeps the live summary and voucher preview synchronized with draft inputs', async () => {
        const user = userEvent.setup();

        render(
            <VoucherForm
                form={{ action: '/admin/vouchers', method: 'post' }}
            />,
        );

        const codeInput = screen.getByLabelText('Voucher code');
        const usageInput = screen.getByLabelText('Usage limit');

        await user.type(codeInput, 'SUMMER25');
        await user.clear(usageInput);
        await user.type(usageInput, '25');

        expect(screen.getAllByText('SUMMER25').length).toBeGreaterThanOrEqual(
            2,
        );
        expect(
            screen.getByText('Up to 25 total redemptions'),
        ).toBeInTheDocument();
    });

    it('updates presentation state without changing the active field contract', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <VoucherForm
                form={{ action: '/admin/vouchers', method: 'post' }}
            />,
        );

        await user.click(screen.getByRole('checkbox', { name: 'Active' }));

        expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
        expect(
            container.querySelector(
                'input[type="hidden"][name="active"][value="0"]',
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('checkbox', { name: 'Active' }),
        ).not.toBeChecked();
    });
});

describe('voucher form edit evidence', () => {
    it('renders redemption evidence and disables client deletion when history exists', () => {
        render(
            <VoucherForm
                form={{
                    action: '/admin/vouchers/42?_method=PUT',
                    method: 'post',
                }}
                voucher={{
                    ...existingVoucher,
                    redemptions: [
                        {
                            sessionToken:
                                '11111111-1111-4111-8111-000000000042',
                            startedAt: '2030-01-05T12:00:00.000000Z',
                        },
                    ],
                }}
            />,
        );

        expect(
            screen.getByText('11111111-1111-4111-8111-000000000042'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Delete voucher' }),
        ).toBeDisabled();
    });
});

describe('voucher form accessibility', () => {
    it('associates a validation error with its field via aria-describedby', () => {
        formErrors.current = { code: 'The code has already been taken.' };

        render(
            <VoucherForm
                form={{ action: '/admin/vouchers', method: 'post' }}
            />,
        );

        const codeInput = screen.getByLabelText('Voucher code');
        expect(codeInput).toHaveAttribute('aria-invalid', 'true');
        expect(codeInput).toHaveAttribute('aria-describedby', 'code-error');

        const message = screen.getByText('The code has already been taken.');
        expect(message).toHaveAttribute('id', 'code-error');
        expect(message).toHaveAttribute('role', 'alert');

        formErrors.current = {};
    });
});
