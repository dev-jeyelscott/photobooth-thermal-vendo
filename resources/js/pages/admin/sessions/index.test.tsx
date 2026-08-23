import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SessionsIndex, {
    formatEnumLabel,
    getActiveFilterLabels,
    getPaginationSummary,
    getPrintStatusPresentation,
    getSessionStatusPresentation,
} from './index';
import type { Filters, Paginated, Session } from './index';

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action?: string;
        method?: string;
        children?: ReactNode | (() => ReactNode);
    }) => (
        <form action={action} method={method}>
            {typeof children === 'function' ? children() : children}
        </form>
    ),
    Head: () => null,
    Link: ({
        href,
        children,
        dangerouslySetInnerHTML,
    }: {
        href: string | { url: string };
        children?: ReactNode;
        dangerouslySetInnerHTML?: { __html: string };
        preserveScroll?: boolean;
    }) => (
        <a
            href={typeof href === 'string' ? href : href.url}
            dangerouslySetInnerHTML={dangerouslySetInnerHTML}
        >
            {dangerouslySetInnerHTML === undefined ? children : undefined}
        </a>
    ),
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
    status: null,
    from: null,
    to: null,
    payment_status: null,
    payment_method: null,
    authorization_type: null,
    print_status: null,
};

/**
 * Build a stable session fixture while allowing each test to override only the
 * fields needed by that scenario.
 */
function makeSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 1,
        sessionToken: '465dfc8f-4550-4a7f-9dcf-2edcf248a835',
        status: 'completed',
        startedAt: '2026-08-22T18:00:47+08:00',
        expiresAt: '2026-08-22T19:00:47+08:00',
        payment: null,
        printJob: {
            status: 'printed',
            attemptCount: 1,
            completedAt: '2026-08-22T18:01:47+08:00',
        },
        ...overrides,
    };
}

/**
 * Build a predictable paginator fixture matching Laravel's Inertia payload
 * shape used by the Sessions page.
 */
function makePagination(
    data: Session[],
    overrides: Partial<Paginated<Session>> = {},
): Paginated<Session> {
    return {
        data,
        links: [
            {
                url: null,
                label: '&laquo; Previous',
                active: false,
            },
            {
                url: '/admin/sessions?page=1',
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
        ...overrides,
    };
}

/**
 * Render the Sessions page with repository-valid defaults while allowing tests
 * to override the session paginator or server-provided filters.
 */
function renderPage({
    sessions = makePagination([makeSession()]),
    filters = emptyFilters,
}: {
    sessions?: Paginated<Session>;
    filters?: Filters;
} = {}) {
    return render(
        <SessionsIndex
            sessions={sessions}
            filters={filters}
            statuses={statuses}
            paymentStatuses={paymentStatuses}
            paymentMethods={paymentMethods}
            printStatuses={printStatuses}
        />,
    );
}

describe('Sessions presentation helpers', () => {
    it('humanizes durable enum-style values without changing their meaning', () => {
        expect(formatEnumLabel('payment_pending')).toBe('Payment pending');
        expect(formatEnumLabel('template_selected')).toBe('Template selected');
        expect(formatEnumLabel('completed')).toBe('Completed');
    });

    it('maps session states to the expected semantic token groups', () => {
        expect(getSessionStatusPresentation('completed').className).toContain(
            'bg-success-subtle',
        );

        expect(
            getSessionStatusPresentation('payment_pending').className,
        ).toContain('bg-warning-subtle');

        expect(getSessionStatusPresentation('printing').className).toContain(
            'bg-info-subtle',
        );

        expect(getSessionStatusPresentation('abandoned').className).toContain(
            'bg-muted',
        );
    });

    it('maps print failures and successes to semantic dot colors', () => {
        expect(getPrintStatusPresentation('printed').dotClassName).toBe(
            'bg-success',
        );

        expect(getPrintStatusPresentation('failed').dotClassName).toBe(
            'bg-destructive',
        );
    });

    it('shows only valid server-recognized query filters as active', () => {
        const labels = getActiveFilterLabels(
            {
                status: 'payment_pending',
                from: '2026-08-20',
                to: null,
                payment_status: 'not-a-status',
                payment_method: 'maya',
                authorization_type: 'voucher',
                print_status: 'printed',
            },
            statuses,
            paymentStatuses,
            paymentMethods,
            printStatuses,
        );

        expect(labels).toEqual([
            'Status: Payment pending',
            'From: 2026-08-20',
            'Payment method: Maya',
            'Authorization: Voucher',
            'Print status: Printed',
        ]);
    });

    it('builds truthful populated and empty pagination summaries', () => {
        expect(
            getPaginationSummary(
                makePagination([makeSession()], {
                    from: 1,
                    to: 10,
                    total: 28,
                }),
            ),
        ).toBe('Showing 1–10 of 28');

        expect(getPaginationSummary(makePagination([]))).toBe('Showing 0 of 0');
    });
});

describe('Sessions monitoring page', () => {
    it('renders the approved read-only monitoring hierarchy', () => {
        renderPage();

        expect(
            screen.getByRole('heading', {
                name: 'Sessions',
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('Read only')).toBeInTheDocument();

        expect(
            screen.getByText(
                'Read-only view of photobooth sessions, payments, and print jobs',
            ),
        ).toBeInTheDocument();

        expect(screen.getByText('None')).toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: 'Clear filters',
            }),
        ).toHaveAttribute('href', '/admin/sessions');
    });

    it('keeps the complete session UUID visible for troubleshooting', () => {
        const sessionToken = '11111111-1111-4111-8111-000000000013';

        renderPage({
            sessions: makePagination([
                makeSession({
                    sessionToken,
                    status: 'printing',
                }),
            ]),
        });

        expect(screen.getByText(sessionToken)).toBeInTheDocument();
        expect(screen.getByText('Printing')).toBeInTheDocument();
    });

    it('renders payment and print evidence without inventing missing records', () => {
        renderPage({
            sessions: makePagination([
                makeSession({
                    payment: null,
                    printJob: null,
                }),
            ]),
        });

        expect(screen.getByText('No payment')).toBeInTheDocument();
        expect(screen.getByText('No print job')).toBeInTheDocument();
    });

    it('renders real payment evidence with semantic status treatment', () => {
        renderPage({
            sessions: makePagination([
                makeSession({
                    status: 'payment_pending',
                    payment: {
                        method: 'maya',
                        status: 'pending',
                        amount: '50.00',
                    },
                    printJob: null,
                }),
            ]),
        });

        expect(screen.getByText('Payment pending')).toBeInTheDocument();
        expect(screen.getByText('maya')).toBeInTheDocument();
        expect(screen.getByText('pending')).toHaveClass('text-warning');
        expect(screen.getByText('50.00')).toBeInTheDocument();
    });

    it('renders the semantic failed print-job state', () => {
        renderPage({
            sessions: makePagination([
                makeSession({
                    status: 'printing',
                    printJob: {
                        status: 'failed',
                        attemptCount: 2,
                        completedAt: null,
                    },
                }),
            ]),
        });

        expect(screen.getByText('Failed')).toHaveClass('text-destructive');
    });

    it('renders active filters from the authoritative server filter props', () => {
        renderPage({
            filters: {
                ...emptyFilters,
                status: 'completed',
                payment_method: 'maya',
                print_status: 'printed',
            },
        });

        expect(screen.getByText('Status: Completed')).toBeInTheDocument();
        expect(screen.getByText('Payment method: Maya')).toBeInTheDocument();
        expect(screen.getByText('Print status: Printed')).toBeInTheDocument();
        expect(screen.queryByText('None')).not.toBeInTheDocument();
    });

    it('renders a truthful empty result state', () => {
        renderPage({
            sessions: makePagination([]),
        });

        expect(screen.getByText('No sessions found.')).toBeInTheDocument();

        expect(
            screen.getByText('No session records match the current filters.'),
        ).toBeInTheDocument();

        expect(screen.getAllByText('Showing 0 of 0')).toHaveLength(2);
    });
});
