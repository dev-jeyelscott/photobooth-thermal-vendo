import { render, screen } from '@testing-library/react';
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
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: (props: InputHTMLAttributes<HTMLInputElement>) => (
        <input type="checkbox" {...props} />
    ),
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

        expect(screen.getByLabelText('Code')).toHaveValue('PROMO-2030');
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
});

describe('voucher form accessibility', () => {
    it('associates a validation error with its field via aria-describedby', () => {
        formErrors.current = { code: 'The code has already been taken.' };

        render(
            <VoucherForm
                form={{ action: '/admin/vouchers', method: 'post' }}
            />,
        );

        const codeInput = screen.getByLabelText('Code');
        expect(codeInput).toHaveAttribute('aria-invalid', 'true');
        expect(codeInput).toHaveAttribute('aria-describedby', 'code-error');

        const message = screen.getByText('The code has already been taken.');
        expect(message).toHaveAttribute('id', 'code-error');
        expect(message).toHaveAttribute('role', 'alert');

        formErrors.current = {};
    });
});
