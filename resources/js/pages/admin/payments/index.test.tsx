import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PaymentsIndex, {
    formatPaginationLabel,
    formatPaymentAmount,
    formatPaymentDateTime,
} from './index';
import type { Payment } from './index';

type MockFormState = {
    processing: boolean;
};

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action?: string;
        method?: string;
        children?: ReactNode | ((state: MockFormState) => ReactNode);
    }) => (
        <form action={action} method={method}>
            {typeof children === 'function'
                ? children({ processing: false })
                : children}
        </form>
    ),
    Head: () => null,
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
    setLayoutProps: vi.fn(),
}));

/**
 * Build a stable payment fixture while allowing each test to override only
 * fields relevant to the behavior under test.
 */
function makePayment(overrides: Partial<Payment> = {}): Payment {
    return {
        id: 1,
        sessionToken: '11111111-1111-4111-8111-000000000013',
        method: 'maya',
        status: 'success',
        mayaPaymentId: '20000000-0000-4000-8000-000000000010',
        mayaCheckoutId: '10000000-0000-4000-8000-000000000010',
        amount: '50.00',
        createdAt: '2026-08-22T17:50:35+08:00',
        updatedAt: '2026-08-22T17:59:35+08:00',
        ...overrides,
    };
}

/**
 * Build the Laravel-compatible pagination payload expected by the page.
 */
function makePagination(data: Payment[]) {
    return {
        data,
        links: [
            {
                url: null,
                label: '&laquo; Previous',
                active: false,
            },
            {
                url: '/admin/payments?page=1',
                label: '1',
                active: true,
            },
            {
                url: null,
                label: 'Next &raquo;',
                active: false,
            },
        ],
        from: data.length > 0 ? 1 : null,
        to: data.length > 0 ? data.length : null,
        total: data.length,
    };
}

describe('payment presentation helpers', () => {
    it('formats payment amounts without inventing a currency', () => {
        expect(formatPaymentAmount('50')).toBe('50.00');
        expect(formatPaymentAmount('1250.5')).toBe('1,250.50');
        expect(formatPaymentAmount('unknown')).toBe('unknown');
    });

    it('formats timestamps for operator readability', () => {
        expect(formatPaymentDateTime('2026-08-22T17:50:35+08:00')).toContain(
            'Aug',
        );

        expect(formatPaymentDateTime(null)).toBe('Not available');
    });

    it('normalizes Laravel pagination labels without rendering HTML', () => {
        expect(formatPaginationLabel('&laquo; Previous')).toBe('Previous');
        expect(formatPaginationLabel('Next &raquo;')).toBe('Next');
        expect(formatPaginationLabel('<span>3</span>')).toBe('3');
    });
});

describe('Payments page', () => {
    it('renders payment evidence as explicitly read only', () => {
        render(
            <PaymentsIndex
                payments={makePagination([makePayment()])}
                filters={{
                    status: null,
                    from: null,
                    to: null,
                }}
                statuses={['pending', 'success', 'failed', 'cancelled']}
            />,
        );

        expect(screen.getByText('Read only')).toBeInTheDocument();
        expect(screen.getAllByText('Success').length).toBeGreaterThan(0);
        expect(screen.getAllByText('50.00').length).toBeGreaterThan(0);

        expect(
            screen.getAllByText('20000000-0000-4000-8000-000000000010').length,
        ).toBeGreaterThan(0);

        expect(
            screen.queryByRole('link', { name: /edit/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /delete/i }),
        ).not.toBeInTheDocument();
    });

    it('shows a clear-filter action only when server filters are active', () => {
        const { rerender } = render(
            <PaymentsIndex
                payments={makePagination([makePayment()])}
                filters={{
                    status: null,
                    from: null,
                    to: null,
                }}
                statuses={['success']}
            />,
        );

        expect(
            screen.queryByRole('link', { name: /clear filters/i }),
        ).not.toBeInTheDocument();

        rerender(
            <PaymentsIndex
                payments={makePagination([makePayment()])}
                filters={{
                    status: 'success',
                    from: null,
                    to: null,
                }}
                statuses={['success']}
            />,
        );

        expect(
            screen.getByRole('link', { name: /clear filters/i }),
        ).toHaveAttribute('href', '/admin/payments');
    });

    it('renders a truthful filtered empty state', () => {
        render(
            <PaymentsIndex
                payments={makePagination([])}
                filters={{
                    status: 'failed',
                    from: null,
                    to: null,
                }}
                statuses={['failed']}
            />,
        );

        expect(screen.getByText('No payments found')).toBeInTheDocument();

        expect(
            screen.getByText(
                'No payment evidence matches the current filters.',
            ),
        ).toBeInTheDocument();
    });

    it('renders accessible pagination labels instead of Laravel HTML entities', () => {
        render(
            <PaymentsIndex
                payments={makePagination([makePayment()])}
                filters={{
                    status: null,
                    from: null,
                    to: null,
                }}
                statuses={['success']}
            />,
        );

        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
        expect(screen.queryByText('&laquo; Previous')).not.toBeInTheDocument();
    });
});
