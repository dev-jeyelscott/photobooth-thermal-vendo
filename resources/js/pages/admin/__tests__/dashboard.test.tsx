import { render, screen, within } from '@testing-library/react';
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
    ComposedChart: ({ children }: { children: ReactNode }) => (
        <div data-testid="sales-sessions-trend">{children}</div>
    ),
    PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Area: () => null,
    Line: () => null,
    Cell: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
}));

import Dashboard from '../dashboard';

const baseProps: ComponentProps<typeof Dashboard> = {
    currency: 'PHP',
    period: {
        startDate: '2026-08-17',
        endDate: '2026-08-23',
    },
    summary: {
        today: {
            count: 6,
            salesTotal: '150.00',
        },
        thisMonth: {
            count: 9,
            salesTotal: '250.00',
        },
        comparison: {
            todaySalesVsYesterday: 25,
            todaySessionsVsYesterday: 20,
            monthSalesVsPreviousPeriod: 18,
        },
        needsAttention: {
            failedPayments: 1,
            pendingPayments: 2,
            pendingPaymentTotal: '50.00',
            failedPrintJobs: 1,
            total: 4,
        },
    },
    trend: [
        {
            date: '2026-08-17',
            label: 'Mon Aug 17',
            sales: 80,
            sessions: 3,
        },
        {
            date: '2026-08-18',
            label: 'Tue Aug 18',
            sales: 120,
            sessions: 4,
        },
        {
            date: '2026-08-19',
            label: 'Wed Aug 19',
            sales: 60,
            sessions: 2,
        },
        {
            date: '2026-08-20',
            label: 'Thu Aug 20',
            sales: 100,
            sessions: 4,
        },
        {
            date: '2026-08-21',
            label: 'Fri Aug 21',
            sales: 110,
            sessions: 5,
        },
        {
            date: '2026-08-22',
            label: 'Sat Aug 22',
            sales: 130,
            sessions: 5,
        },
        {
            date: '2026-08-23',
            label: 'Sun Aug 23',
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
    recentSessions: [
        {
            reference: 'TS-000101',
            startedAt: '2026-08-23T10:30:00+08:00',
            paymentMethod: 'maya',
            status: 'completed',
            printStatus: 'printed',
            amount: '150.00',
            currency: 'PHP',
        },
        {
            reference: 'TS-000100',
            startedAt: '2026-08-23T10:15:00+08:00',
            paymentMethod: 'voucher',
            status: 'payment_pending',
            printStatus: null,
            amount: '150.00',
            currency: 'PHP',
        },
    ],
    resources: {
        templates: {
            active: 12,
            inactive: 2,
        },
        stickers: {
            active: 18,
            inactive: 3,
        },
        vouchers: {
            available: 56,
            remainingUses: 74,
        },
    },
};

describe('admin dashboard', () => {
    it('renders the reference-oriented operator dashboard from real props', () => {
        render(<Dashboard {...baseProps} />);

        expect(
            screen.getByRole('heading', { name: 'Dashboard' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Operator overview for ThermaSnap.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Aug 17, 2026 - Aug 23, 2026'),
        ).toBeInTheDocument();

        const kpiRegion = screen.getByRole('region', {
            name: 'Dashboard key performance indicators',
        });

        expect(
            within(kpiRegion).getByText("Today's Sales"),
        ).toBeInTheDocument();
        expect(
            within(kpiRegion).getByText('Sessions Today'),
        ).toBeInTheDocument();
        expect(screen.getAllByText('Pending Payments')).toHaveLength(2);
        expect(screen.getAllByText('Failed Print Jobs')).toHaveLength(2);
        expect(within(kpiRegion).getByText('₱150')).toBeInTheDocument();
        expect(within(kpiRegion).getByText('₱50')).toBeInTheDocument();
        expect(screen.getByText('₱50 total')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
        expect(screen.getAllByText('vs yesterday')).toHaveLength(2);

        expect(screen.getByTestId('sales-sessions-trend')).toBeInTheDocument();
        expect(
            screen.getByRole('img', {
                name: 'Payment methods today: 4 Maya sessions, 2 voucher sessions',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Payment Methods Breakdown'),
        ).toBeInTheDocument();
        expect(screen.getByText('Needs Attention')).toBeInTheDocument();

        expect(
            screen.getByRole('table', { name: 'Recent sessions' }),
        ).toBeInTheDocument();
        expect(screen.getByText('TS-000101')).toBeInTheDocument();
        expect(screen.getAllByText('Maya QR').length).toBeGreaterThan(0);
        expect(screen.getByText('Not queued')).toBeInTheDocument();

        expect(screen.getByText('Active Templates')).toBeInTheDocument();
        expect(screen.getByText('Active Stickers')).toBeInTheDocument();
        expect(screen.getByText('Available Vouchers')).toBeInTheDocument();
        expect(screen.getByText('2 inactive')).toBeInTheDocument();
        expect(screen.getByText('3 inactive')).toBeInTheDocument();
        expect(screen.getByText('74 uses remaining')).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: /Open Kiosk/i }),
        ).toHaveAttribute('href', '/kiosk');
        expect(
            screen.getByRole('link', { name: /Create Voucher/i }),
        ).toHaveAttribute('href', '/admin/vouchers/create');
        expect(
            screen.getByRole('link', { name: 'Manage Templates' }),
        ).toHaveAttribute('href', '/admin/templates');
        expect(
            screen.getByRole('link', { name: 'Manage Stickers' }),
        ).toHaveAttribute('href', '/admin/stickers');
        expect(
            screen.getByRole('link', { name: 'Manage Vouchers' }),
        ).toHaveAttribute('href', '/admin/vouchers');

        const issueLinks = screen
            .getAllByRole('link')
            .filter((link) => link.getAttribute('href')?.includes('status='));

        expect(issueLinks.length).toBeGreaterThan(0);
    });

    it('renders safe empty states without fabricating comparisons or activity', () => {
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
                    comparison: {
                        todaySalesVsYesterday: null,
                        todaySessionsVsYesterday: null,
                        monthSalesVsPreviousPeriod: null,
                    },
                    needsAttention: {
                        failedPayments: 0,
                        pendingPayments: 0,
                        pendingPaymentTotal: '0.00',
                        failedPrintJobs: 0,
                        total: 0,
                    },
                }}
                trend={baseProps.trend.map((point) => ({
                    ...point,
                    sales: 0,
                    sessions: 0,
                }))}
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
                recentSessions={[]}
                resources={{
                    templates: { active: 0, inactive: 0 },
                    stickers: { active: 0, inactive: 0 },
                    vouchers: { available: 0, remainingUses: 0 },
                }}
            />,
        );

        expect(screen.getAllByText('No prior-period comparison')).toHaveLength(
            2,
        );
        expect(
            screen.getByText('No completed session trend data yet.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('No completed sessions today.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('No operator action required'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('No customer sessions yet.'),
        ).toBeInTheDocument();
        expect(screen.getByText('No failed print jobs')).toBeInTheDocument();
    });
});
