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
});
