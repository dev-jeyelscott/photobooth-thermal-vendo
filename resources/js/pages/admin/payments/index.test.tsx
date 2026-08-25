import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PaymentsIndex, {
    formatPaginationLabel,
    formatPaymentAmount,
    formatPaymentDateTime,
    formatSummaryPercentage,
} from './index';
import type { Filters, Paginated, Payment, PaymentSummary } from './index';

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action?: string;
        method?: string;
        children?: ReactNode;
    }) => (
        <form action={action} method={method}>
            {children}
        </form>
    ),
    Head: () => null,
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
        preserveScroll?: boolean;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
    setLayoutProps: vi.fn(),
}));

const summary: PaymentSummary = {
    total: 1248,
    successful: 1086,
    pending: 102,
    failedOrCancelled: 60,
};

const emptyFilters: Filters = {
    search: null,
    status: null,
    method: null,
    from: null,
    to: null,
};

/**
 * Build a stable payment fixture while allowing focused per-test overrides.
 */
function makePayment(overrides: Partial<Payment> = {}): Payment {
    return {
        id: 1,
        sessionToken: '11111111-1111-4111-8111-000000000013',
        currency: 'PHP',
        method: 'maya',
        status: 'success',
        mayaPaymentId: '20000000-0000-4000-8000-000000000010',
        mayaCheckoutId: '10000000-0000-4000-8000-000000000010',
        amount: '200.00',
        paidAt: '2026-08-22T17:59:35+08:00',
        createdAt: '2026-08-22T17:50:35+08:00',
        updatedAt: '2026-08-22T17:59:35+08:00',
        ...overrides,
    };
}

/**
 * Build the Laravel-compatible pagination payload expected by the page.
 */
function makePagination(data: Payment[]): Paginated<Payment> {
    return {
        data,
        links: [
            { url: null, label: '&laquo; Previous', active: false },
            { url: '/admin/payments?page=1', label: '1', active: true },
            { url: null, label: 'Next &raquo;', active: false },
        ],
        from: data.length > 0 ? 1 : null,
        to: data.length > 0 ? data.length : null,
        total: data.length,
    };
}

/**
 * Render the Payments page with repository-valid defaults.
 */
function renderPage({
    payments = makePagination([makePayment()]),
    filters = emptyFilters,
    pageSummary = summary,
}: {
    payments?: Paginated<Payment>;
    filters?: Filters;
    pageSummary?: PaymentSummary;
} = {}) {
    return render(
        <PaymentsIndex
            payments={payments}
            summary={pageSummary}
            filters={filters}
            statuses={['pending', 'success', 'failed', 'cancelled']}
            methods={['maya', 'voucher']}
        />,
    );
}

describe('payment presentation helpers', () => {
    it('formats persisted amounts without inventing a missing currency', () => {
        expect(formatPaymentAmount('50')).toBe('50.00');
        expect(formatPaymentAmount('1250.5')).toBe('1,250.50');
        expect(formatPaymentAmount('50', 'PHP')).toContain('50.00');
        expect(formatPaymentAmount('unknown', 'PHP')).toBe('unknown');
    });

    it('formats timestamps, percentages, and paginator labels safely', () => {
        expect(formatPaymentDateTime('2026-08-22T17:50:35+08:00')).toContain(
            'Aug',
        );
        expect(formatPaymentDateTime(null)).toBe('Not available');
        expect(formatSummaryPercentage(1086, 1248)).toBe('87.0% of total');
        expect(formatSummaryPercentage(0, 0)).toBe('0.0% of total');
        expect(formatPaginationLabel('&laquo; Previous')).toBe('Previous');
        expect(formatPaginationLabel('Next &raquo;')).toBe('Next');
    });
});

describe('Payments page', () => {
    it('renders all-time summary cards from authoritative props', () => {
        renderPage();

        expect(
            within(screen.getByLabelText('Total Payments')).getByText('1,248'),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Successful Payments')).getByText(
                '1,086',
            ),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Pending Payments')).getByText('102'),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Failed / Cancelled')).getByText('60'),
        ).toBeInTheDocument();
    });

    it('keeps the page explicitly read only with no mutation actions', () => {
        renderPage();

        expect(screen.getByText('Read only')).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /edit/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /delete/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /refund/i }),
        ).not.toBeInTheDocument();
    });

    it('renders supported search, status, method, and date filters only', () => {
        renderPage();

        expect(screen.getByLabelText('Search')).toHaveAttribute(
            'name',
            'search',
        );
        expect(screen.getByLabelText('Status')).toHaveAttribute(
            'name',
            'status',
        );
        expect(screen.getByLabelText('Method')).toHaveAttribute(
            'name',
            'method',
        );
        expect(screen.queryByLabelText(/booth/i)).not.toBeInTheDocument();
        expect(screen.queryByText('Export Payments')).not.toBeInTheDocument();
    });

    it('preserves full provider and session identifiers for troubleshooting', () => {
        renderPage();

        expect(
            screen.getAllByText('11111111-1111-4111-8111-000000000013').length,
        ).toBeGreaterThan(0);
        expect(
            screen.getAllByText('20000000-0000-4000-8000-000000000010').length,
        ).toBeGreaterThan(0);
        expect(
            screen.getAllByText('10000000-0000-4000-8000-000000000010').length,
        ).toBeGreaterThan(0);
        expect(screen.getAllByText('Success').length).toBeGreaterThan(0);
    });

    it('shows a clear-filter action only when server filters are active', () => {
        const { rerender } = render(
            <PaymentsIndex
                payments={makePagination([makePayment()])}
                summary={summary}
                filters={emptyFilters}
                statuses={['pending', 'success', 'failed', 'cancelled']}
                methods={['maya', 'voucher']}
            />,
        );

        expect(
            screen.queryByRole('link', { name: /clear filters/i }),
        ).not.toBeInTheDocument();

        rerender(
            <PaymentsIndex
                payments={makePagination([makePayment()])}
                summary={summary}
                filters={{ ...emptyFilters, search: '20000000' }}
                statuses={['pending', 'success', 'failed', 'cancelled']}
                methods={['maya', 'voucher']}
            />,
        );

        expect(
            screen.getByRole('link', { name: /clear filters/i }),
        ).toHaveAttribute('href', '/admin/payments');
    });

    it('renders a truthful filtered empty state and pagination summary', () => {
        renderPage({
            payments: makePagination([]),
            filters: { ...emptyFilters, status: 'failed' },
        });

        expect(screen.getByText('No payments found')).toBeInTheDocument();
        expect(
            screen.getByText(
                'No payment evidence matches the current filters.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByText('Showing 0 of 0 payments')).toBeInTheDocument();
    });
});
