import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({
        children,
        href,
        className,
        ...props
    }: {
        children: ReactNode;
        href: string;
        className?: string;
        'aria-current'?: 'page';
    }) => (
        <a href={href} className={className} {...props}>
            {children}
        </a>
    ),
    Form: ({
        children,
        className,
    }: {
        children: ReactNode | (() => ReactNode);
        className?: string;
    }) => (
        <form className={className}>
            {typeof children === 'function' ? children() : children}
        </form>
    ),
    setLayoutProps: vi.fn(),
}));

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    ComposedChart: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    Bar: () => null,
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
}));

import DailyReport from '../reports/daily';
import MonthlyReport from '../reports/monthly';
import RangeReport from '../reports/range';
import {
    buildReportExportHref,
    calculateShare,
    PaymentMixCard,
    ReportNavigation,
} from '../reports/report-ui';

describe('reports workspace', () => {
    it('calculates payment shares safely', () => {
        expect(calculateShare(31, 42)).toBe(73.8);
        expect(calculateShare(11, 42)).toBe(26.2);
        expect(calculateShare(0, 0)).toBe(0);
        expect(calculateShare(10, 0)).toBe(0);
    });

    it('renders accessible report navigation with the active view', () => {
        render(
            <ReportNavigation
                active="daily"
                links={{
                    daily: '/admin/reports/daily?date=2026-08-23',
                    monthly: '/admin/reports/monthly?year=2026&month=8',
                    range: '/admin/reports/range?start=2026-08-23&end=2026-08-23',
                }}
            />,
        );

        expect(screen.getByRole('link', { name: 'Daily' })).toHaveAttribute(
            'aria-current',
            'page',
        );

        expect(screen.getByRole('link', { name: 'Monthly' })).toHaveAttribute(
            'href',
            '/admin/reports/monthly?year=2026&month=8',
        );

        expect(
            screen.getByRole('link', { name: 'Date Range' }),
        ).toHaveAttribute(
            'href',
            '/admin/reports/range?start=2026-08-23&end=2026-08-23',
        );
    });

    it('renders a safe zero-data payment mix', () => {
        render(<PaymentMixCard mayaSessions={0} voucherSessions={0} />);

        expect(screen.getAllByText('0.0%')).toHaveLength(2);
        expect(
            screen.getByText('No Maya or voucher sessions for this period.'),
        ).toBeInTheDocument();
    });

    it('builds the existing CSV export URL with the selected period', () => {
        const exportHref = buildReportExportHref('2026-08-01', '2026-08-31');

        const url = new URL(exportHref, 'http://localhost');

        expect(url.pathname).toBe('/admin/reports/export');
        expect(url.searchParams.get('start')).toBe('2026-08-01');
        expect(url.searchParams.get('end')).toBe('2026-08-31');
    });

    it('renders the daily report without inventing a success-rate percentage', () => {
        render(
            <DailyReport
                date="2026-08-23"
                report={{
                    grossSales: '12450.00',
                    successfulSessions: 42,
                    paidSessions: 31,
                    voucherSessions: 11,
                    failedPayments: 2,
                    averageTransactionValue: '296.43',
                }}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Reports' }),
        ).toBeInTheDocument();

        expect(screen.getByText('Payment mix')).toBeInTheDocument();
        expect(screen.getByText('Transaction health')).toBeInTheDocument();

        expect(
            screen.queryByText('95.5% success rate'),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'Export CSV' }),
        ).toHaveAttribute(
            'href',
            expect.stringContaining('/admin/reports/export'),
        );

        expect(screen.getByLabelText('Date')).toHaveValue('2026-08-23');
    });

    it('renders the monthly chart and daily breakdown from repository-backed data', () => {
        render(
            <MonthlyReport
                year={2026}
                month={8}
                report={{
                    grossSales: '275.00',
                    successfulSessions: 3,
                    paidSessions: 2,
                    voucherSessions: 1,
                    voucherRedemptions: 1,
                    printedJobs: 2,
                    failedPrintJobs: 1,
                    dailyBreakdown: [
                        {
                            date: '2026-08-03',
                            grossSales: '200.00',
                            successfulSessions: 2,
                        },
                        {
                            date: '2026-08-11',
                            grossSales: '75.00',
                            successfulSessions: 1,
                        },
                    ],
                }}
            />,
        );

        expect(screen.getByTestId('monthly-sales-chart')).toBeInTheDocument();

        expect(screen.getByText('Daily breakdown')).toBeInTheDocument();

        expect(screen.getByText('Aug 3, 2026')).toBeInTheDocument();
        expect(screen.getByText('₱200.00')).toBeInTheDocument();
    });

    it('renders deliberate monthly chart and table empty states', () => {
        render(
            <MonthlyReport
                year={2026}
                month={8}
                report={{
                    grossSales: '0.00',
                    successfulSessions: 0,
                    paidSessions: 0,
                    voucherSessions: 0,
                    voucherRedemptions: 0,
                    printedJobs: 0,
                    failedPrintJobs: 0,
                    dailyBreakdown: [],
                }}
            />,
        );

        expect(
            screen.getByText('No sales activity to chart for this period.'),
        ).toBeInTheDocument();

        expect(
            screen.getByText('No activity for this period.'),
        ).toBeInTheDocument();
    });

    it('renders the redesigned date range report from repository-backed aggregates', () => {
        render(
            <RangeReport
                start="2026-08-17"
                end="2026-08-18"
                report={{
                    revenue: '200.00',
                    successfulPayments: 2,
                    failedPayments: 1,
                    completedSessions: 2,
                    voucherSessions: 1,
                    failedPrintJobs: 1,
                    totalSessions: 4,
                    printedJobs: 1,
                    printSuccessRate: 50,
                    averageTicketSize: '100.00',
                    dailyBreakdown: [
                        {
                            date: '2026-08-17',
                            totalSessions: 2,
                            completedSessions: 1,
                            completedRate: 50,
                            expiredOrAbandonedSessions: 1,
                            expiredOrAbandonedRate: 50,
                            revenue: '150.00',
                            successfulPayments: 1,
                            printedJobs: 1,
                            failedPrintJobs: 0,
                            printSuccessRate: 100,
                            averageTicketSize: '150.00',
                        },
                        {
                            date: '2026-08-18',
                            totalSessions: 2,
                            completedSessions: 1,
                            completedRate: 50,
                            expiredOrAbandonedSessions: 1,
                            expiredOrAbandonedRate: 50,
                            revenue: '50.00',
                            successfulPayments: 1,
                            printedJobs: 0,
                            failedPrintJobs: 1,
                            printSuccessRate: 0,
                            averageTicketSize: '50.00',
                        },
                    ],
                }}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Date Range Report' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Total Sessions')).toBeInTheDocument();
        expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0);
        expect(
            screen.getAllByText('Print Success Rate').length,
        ).toBeGreaterThan(0);
        expect(
            screen.getAllByText('Average Ticket Size').length,
        ).toBeGreaterThan(0);
        expect(screen.getByTestId('range-sessions-chart')).toBeInTheDocument();
        expect(screen.getByTestId('range-revenue-chart')).toBeInTheDocument();
        expect(screen.getByText('Daily Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Aug 17, 2026')).toBeInTheDocument();
        expect(screen.getAllByText('₱150.00').length).toBeGreaterThan(0);

        expect(screen.getByLabelText('Start date')).toHaveValue('2026-08-17');
        expect(screen.getByLabelText('End date')).toHaveValue('2026-08-18');
        expect(
            screen.getByRole('link', { name: 'Export Report' }),
        ).toHaveAttribute(
            'href',
            expect.stringContaining('/admin/reports/export'),
        );
        expect(
            screen.getAllByRole('link', { name: 'View' })[0],
        ).toHaveAttribute(
            'href',
            expect.stringContaining('/admin/reports/daily?date=2026-08-17'),
        );

        expect(screen.queryByText('Booth')).not.toBeInTheDocument();
        expect(screen.queryByText('All Booths')).not.toBeInTheDocument();
        expect(screen.queryByText('Active Booth')).not.toBeInTheDocument();
    });

    it('renders deliberate date range empty states without fabricated percentages', () => {
        render(
            <RangeReport
                start="2026-08-01"
                end="2026-08-02"
                report={{
                    revenue: '0.00',
                    successfulPayments: 0,
                    failedPayments: 0,
                    completedSessions: 0,
                    voucherSessions: 0,
                    failedPrintJobs: 0,
                    totalSessions: 0,
                    printedJobs: 0,
                    printSuccessRate: null,
                    averageTicketSize: '0.00',
                    dailyBreakdown: [],
                }}
            />,
        );

        expect(screen.getByText('No terminal print jobs')).toBeInTheDocument();
        expect(
            screen.getByText('No session activity to chart for this period.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('No revenue activity to chart for this period.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('No activity for this period.'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Infinity%')).not.toBeInTheDocument();
    });
});
