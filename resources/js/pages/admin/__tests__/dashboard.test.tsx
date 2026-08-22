import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({
        children,
        href,
        className,
    }: {
        children: ReactNode;
        href: string;
        className?: string;
    }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
    setLayoutProps: vi.fn(),
}));

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    LineChart: ({ children }: { children: ReactNode }) => (
        <div data-testid="sales-sessions-trend">{children}</div>
    ),
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    PieChart: ({ children }: { children: ReactNode }) => (
        <div data-testid="payment-methods-chart">{children}</div>
    ),
    Pie: () => null,
}));

import Dashboard from '../dashboard';

const baseProps: ComponentProps<typeof Dashboard> = {
    currency: 'PHP',
    summary: {
        today: {
            count: 6,
            salesTotal: '150.00',
        },
        thisMonth: {
            count: 9,
            salesTotal: '250.00',
        },
        needsAttention: {
            failedPayments: 1,
            pendingPayments: 1,
            failedPrintJobs: 1,
            total: 3,
        },
    },
    trend: [
        {
            date: '2026-08-17',
            label: 'Aug 17',
            sales: 80,
            sessions: 3,
        },
        {
            date: '2026-08-18',
            label: 'Aug 18',
            sales: 120,
            sessions: 4,
        },
        {
            date: '2026-08-19',
            label: 'Aug 19',
            sales: 60,
            sessions: 2,
        },
        {
            date: '2026-08-20',
            label: 'Aug 20',
            sales: 100,
            sessions: 4,
        },
        {
            date: '2026-08-21',
            label: 'Aug 21',
            sales: 110,
            sessions: 5,
        },
        {
            date: '2026-08-22',
            label: 'Aug 22',
            sales: 130,
            sessions: 5,
        },
        {
            date: '2026-08-23',
            label: 'Aug 23',
            sales: 150,
            sessions: 6,
        },
    ],
    paymentMethods: {
        total: 6,
        maya: 4,
        voucher: 2,
    },
    operations: {
        maintenanceMode: false,
        pendingPrintJobs: 1,
        printingJobs: 0,
        failedPrintJobs: 1,
        galleryExpirationHours: 168,
    },
    recentActivity: [
        {
            type: 'session_completed',
            title: 'Session completed',
            description: 'PHP 100.00 via Maya',
            occurredAt: new Date().toISOString(),
        },
        {
            type: 'voucher',
            title: 'Voucher redeemed',
            description: 'THERMA-DEMO-1, 1 of 1 uses',
            occurredAt: new Date().toISOString(),
        },
    ],
};

describe('admin dashboard', () => {
    it('renders the operator metrics, charts, issues, and quick actions', () => {
        render(<Dashboard {...baseProps} />);

        expect(
            screen.getByRole('heading', { name: 'Dashboard' }),
        ).toBeInTheDocument();

        expect(screen.getByText("Today's Sales")).toBeInTheDocument();
        expect(screen.getByText('₱150.00')).toBeInTheDocument();
        expect(
            screen.getByText('Completed Sessions Today'),
        ).toBeInTheDocument();
        expect(screen.getByText('Needs Attention')).toBeInTheDocument();

        expect(screen.getByTestId('sales-sessions-trend')).toBeInTheDocument();
        expect(screen.getByTestId('payment-methods-chart')).toBeInTheDocument();

        expect(screen.getByText('Booth Status')).toBeInTheDocument();
        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: /Create Voucher/i }),
        ).toHaveAttribute('href', '/admin/vouchers/create');

        expect(
            screen.getByRole('link', { name: /Manage Templates/i }),
        ).toHaveAttribute('href', '/admin/templates');

        expect(
            screen.getByRole('link', { name: /Review issues/i }),
        ).toHaveAttribute(
            'href',
            expect.stringContaining('print_status=failed'),
        );
    });

    it('renders safe empty states when there is no dashboard activity', () => {
        render(
            <Dashboard
                {...baseProps}
                summary={{
                    today: {
                        count: 0,
                        salesTotal: '0.00',
                    },
                    thisMonth: {
                        count: 0,
                        salesTotal: '0.00',
                    },
                    needsAttention: {
                        failedPayments: 0,
                        pendingPayments: 0,
                        failedPrintJobs: 0,
                        total: 0,
                    },
                }}
                trend={[]}
                paymentMethods={{
                    total: 0,
                    maya: 0,
                    voucher: 0,
                }}
                operations={{
                    maintenanceMode: false,
                    pendingPrintJobs: 0,
                    printingJobs: 0,
                    failedPrintJobs: 0,
                    galleryExpirationHours: 168,
                }}
                recentActivity={[]}
            />,
        );

        expect(screen.getByText('System healthy')).toBeInTheDocument();
        expect(screen.getByText('No trend data yet.')).toBeInTheDocument();
        expect(
            screen.getByText('No completed sessions today.'),
        ).toBeInTheDocument();
        expect(screen.getByText('No recent activity yet.')).toBeInTheDocument();
    });
});
