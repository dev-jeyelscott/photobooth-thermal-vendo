import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SessionsIndex, {
    formatEnumLabel,
    formatPaginationLabel,
    formatSessionAmount,
    formatSummaryPercentage,
    getActiveFilterLabels,
    getPaginationSummary,
    getPrintStatusPresentation,
    getSessionStatusPresentation,
} from './index';
import type { Filters, Paginated, Session, SessionSummary } from './index';

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

const statuses = [
    'new',
    'payment_pending',
    'paid',
    'template_selected',
    'capturing',
    'customizing',
    'processing',
    'printing',
    'completed',
    'expired',
    'abandoned',
];
const paymentStatuses = ['pending', 'success', 'failed', 'cancelled'];
const paymentMethods = ['maya', 'voucher'];
const printStatuses = ['pending', 'printing', 'printed', 'failed'];

const emptyFilters: Filters = {
    search: null,
    status: null,
    from: null,
    to: null,
    payment_status: null,
    payment_method: null,
    authorization_type: null,
    print_status: null,
};

const summary: SessionSummary = {
    total: 1248,
    completed: 842,
    inProgress: 176,
    expiredOrAbandoned: 230,
};

/**
 * Build a stable session fixture while allowing each test to override only the
 * fields required by that scenario.
 */
function makeSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 1,
        sessionToken: '465dfc8f-4550-4a7f-9dcf-2edcf248a835',
        status: 'completed',
        startedAt: '2026-08-22T18:00:47+08:00',
        expiresAt: '2026-08-22T19:00:47+08:00',
        templateName: 'Classic 4R',
        voucherCode: null,
        price: '200.00',
        currency: 'PHP',
        paymentMethod: 'maya',
        payment: {
            method: 'maya',
            status: 'success',
            amount: '200.00',
        },
        printJob: {
            status: 'printed',
            attemptCount: 1,
            completedAt: '2026-08-22T18:01:47+08:00',
        },
        ...overrides,
    };
}

/**
 * Build a predictable paginator fixture matching Laravel's Inertia payload.
 */
function makePagination(
    data: Session[],
    overrides: Partial<Paginated<Session>> = {},
): Paginated<Session> {
    return {
        data,
        links: [
            { url: null, label: '&laquo; Previous', active: false },
            { url: '/admin/sessions?page=1', label: '1', active: true },
            { url: null, label: 'Next &raquo;', active: false },
        ],
        from: data.length > 0 ? 1 : null,
        to: data.length > 0 ? data.length : null,
        total: data.length,
        ...overrides,
    };
}

/**
 * Render the Sessions page with repository-valid defaults.
 */
function renderPage({
    sessions = makePagination([makeSession()]),
    filters = emptyFilters,
    pageSummary = summary,
}: {
    sessions?: Paginated<Session>;
    filters?: Filters;
    pageSummary?: SessionSummary;
} = {}) {
    return render(
        <SessionsIndex
            sessions={sessions}
            summary={pageSummary}
            filters={filters}
            statuses={statuses}
            paymentStatuses={paymentStatuses}
            paymentMethods={paymentMethods}
            printStatuses={printStatuses}
        />,
    );
}

/**
 * Locate the exact session row so assertions do not collide with filter labels.
 */
function getSessionRow(sessionToken: string): HTMLElement {
    const token = screen.getByText(sessionToken);
    const row = token.closest('tr');

    if (row === null) {
        throw new Error(`Session row not found for ${sessionToken}`);
    }

    return row;
}

describe('Sessions presentation helpers', () => {
    it('humanizes durable enum values without changing their meaning', () => {
        expect(formatEnumLabel('payment_pending')).toBe('Payment pending');
        expect(formatEnumLabel('template_selected')).toBe('Template selected');
    });

    it('maps session and print states to canonical semantic tokens', () => {
        expect(getSessionStatusPresentation('completed').className).toContain(
            'bg-success-subtle',
        );
        expect(
            getSessionStatusPresentation('payment_pending').className,
        ).toContain('bg-warning-subtle');
        expect(getPrintStatusPresentation('failed').badgeClassName).toContain(
            'text-destructive',
        );
    });

    it('formats summary percentages and pagination safely', () => {
        expect(formatSummaryPercentage(842, 1248)).toBe('67.5% of total');
        expect(formatSummaryPercentage(0, 0)).toBe('0.0% of total');
        expect(formatPaginationLabel('&laquo; Previous')).toBe('Previous');
        expect(
            getPaginationSummary(
                makePagination([makeSession()], {
                    from: 1,
                    to: 20,
                    total: 1248,
                }),
            ),
        ).toBe('Showing 1–20 of 1248');
    });

    it('uses persisted currency when formatting session amounts', () => {
        expect(formatSessionAmount('200.00', 'PHP')).toContain('200.00');
        expect(formatSessionAmount('200.00', null)).toBe('200.00');
        expect(formatSessionAmount(null, 'PHP')).toBe('Not available');
    });

    it('shows only authoritative active filters', () => {
        expect(
            getActiveFilterLabels(
                {
                    ...emptyFilters,
                    search: '465dfc8f',
                    status: 'completed',
                    payment_method: 'maya',
                    print_status: 'printed',
                },
                statuses,
                paymentStatuses,
                paymentMethods,
                printStatuses,
            ),
        ).toEqual([
            'Search: 465dfc8f',
            'Status: Completed',
            'Payment method: Maya',
            'Print status: Printed',
        ]);
    });
});

describe('Sessions monitoring page', () => {
    it('renders the approved dashboard hierarchy and all-time summaries', () => {
        renderPage();

        expect(
            screen.getByRole('heading', { name: 'Sessions' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Read only')).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Total Sessions')).getByText('1,248'),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Completed Sessions')).getByText(
                '842',
            ),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Active / Pending')).getByText('176'),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Expired / Abandoned')).getByText(
                '230',
            ),
        ).toBeInTheDocument();
    });

    it('renders searchable server-backed filters without unsupported booth fields', () => {
        renderPage();

        expect(screen.getByLabelText('Search')).toHaveAttribute(
            'name',
            'search',
        );
        expect(screen.getByLabelText('Session status')).toHaveAttribute(
            'name',
            'status',
        );
        expect(screen.queryByLabelText(/booth/i)).not.toBeInTheDocument();
    });

    it('keeps the full session UUID and truthful template evidence visible', () => {
        const sessionToken = '11111111-1111-4111-8111-000000000013';
        renderPage({
            sessions: makePagination([
                makeSession({ sessionToken, templateName: 'Floral Classic' }),
            ]),
        });

        const row = getSessionRow(sessionToken);
        expect(within(row).getByText(sessionToken)).toBeInTheDocument();
        expect(within(row).getByText('Floral Classic')).toBeInTheDocument();
        expect(within(row).getByText('Success')).toBeInTheDocument();
        expect(within(row).getByText('Printed')).toBeInTheDocument();
    });

    it('renders voucher and missing evidence without fabricating payment records', () => {
        renderPage({
            sessions: makePagination([
                makeSession({
                    id: 1,
                    sessionToken: '11111111-1111-4111-8111-000000000014',
                    payment: null,
                    paymentMethod: 'voucher',
                    voucherCode: 'BDAY2025',
                    printJob: null,
                }),
                makeSession({
                    id: 2,
                    sessionToken: '11111111-1111-4111-8111-000000000015',
                    payment: null,
                    paymentMethod: null,
                    voucherCode: null,
                    printJob: null,
                }),
            ]),
        });

        expect(screen.getByText('BDAY2025')).toBeInTheDocument();
        expect(screen.getByText('No payment')).toBeInTheDocument();
        expect(screen.getAllByText('No print job')).toHaveLength(2);
    });

    it('renders active filter evidence and a clear action only when needed', () => {
        renderPage({
            filters: {
                ...emptyFilters,
                search: '11111111',
                status: 'completed',
            },
        });

        expect(screen.getByText('Search: 11111111')).toBeInTheDocument();
        expect(screen.getByText('Status: Completed')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Clear filters' }),
        ).toHaveAttribute('href', '/admin/sessions');
    });

    it('renders a truthful empty result state', () => {
        renderPage({ sessions: makePagination([]) });

        expect(screen.getByText('No sessions found')).toBeInTheDocument();
        expect(
            screen.getByText('No session records match the current filters.'),
        ).toBeInTheDocument();
        expect(screen.getByText('Showing 0 of 0 sessions')).toBeInTheDocument();
    });
});
