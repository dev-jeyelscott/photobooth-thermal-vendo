import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PaymentsIndex, {
    formatPaginationLabel,
    formatPaymentAmount,
    formatPaymentDateTime,
    formatSummaryPercentage,
    getPaymentPaginationSummary,
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
        ...props
    }: {
        href: string | { url: string };
        children: ReactNode;
        preserveScroll?: boolean;
        'aria-current'?: 'page';
    }) => (
        <a
            href={typeof href === 'string' ? href : href.url}
            aria-current={props['aria-current']}
        >
            {children}
        </a>
    ),
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
 * Build one repository-valid payment fixture with focused overrides.
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
 * Build the Laravel paginator shape consumed by the Payments page.
 */
function makePagination(
    data: Payment[],
    overrides: Partial<Paginated<Payment>> = {},
): Paginated<Payment> {
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
        ...overrides,
    };
}

/**
 * Render Payments with repository-valid defaults for focused UI assertions.
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

    it('builds a compact locale-aware pagination summary', () => {
        expect(
            getPaymentPaginationSummary(
                makePagination([makePayment()], {
                    from: 1,
                    to: 20,
                    total: 1248,
                }),
            ),
        ).toBe('Showing 1–20 of 1,248 payments');

        expect(getPaymentPaginationSummary(makePagination([]))).toBe(
            'Showing 0 of 0 payments',
        );
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

    it('keeps immutable payment evidence explicitly read only', () => {
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

        expect(screen.queryByText('Export Payments')).not.toBeInTheDocument();

        expect(
            screen.queryByRole('button', { name: /^view$/i }),
        ).not.toBeInTheDocument();
    });

    it('renders only the supported server-side filter contract', () => {
        renderPage();

        expect(screen.getByLabelText('Search')).toHaveAttribute(
            'name',
            'search',
        );

        expect(screen.getByLabelText('Status')).toHaveAttribute(
            'name',
            'status',
        );

        expect(screen.getByLabelText('Payment Method')).toHaveAttribute(
            'name',
            'method',
        );

        expect(
            screen.getByRole('group', { name: 'Date Range' }),
        ).toBeInTheDocument();

        expect(screen.getByLabelText('From')).toHaveAttribute('name', 'from');
        expect(screen.getByLabelText('To')).toHaveAttribute('name', 'to');

        expect(
            screen.getByRole('button', { name: 'Apply filters' }),
        ).toHaveAttribute('type', 'submit');

        expect(screen.queryByLabelText(/booth/i)).not.toBeInTheDocument();
    });

    it('preserves complete troubleshooting identifiers in the consolidated reference presentation', () => {
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

        expect(
            screen.getByRole('columnheader', { name: 'Reference' }),
        ).toBeInTheDocument();
    });

    it('renders accessible semantic payment status and method badges', () => {
        renderPage();

        expect(
            screen.getAllByLabelText('Payment status: Success').length,
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByLabelText('Payment method: Maya').length,
        ).toBeGreaterThan(0);
    });

    it('shows clear filters only when server filters are active', () => {
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

    it('marks the active paginator link for assistive technology', () => {
        renderPage();

        expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
            'aria-current',
            'page',
        );
    });
});
