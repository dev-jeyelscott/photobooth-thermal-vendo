import { Form, Head, setLayoutProps } from '@inertiajs/react';
import {
    Banknote,
    CalendarDays,
    BarChart3,
    Printer,
    TicketCheck,
} from 'lucide-react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { monthly as monthlyReport } from '@/routes/admin/reports';
import {
    buildReportExportHref,
    buildReportNavigationLinks,
    formatCompactReportCurrency,
    formatReportCurrency,
    formatReportDate,
    formatReportMonth,
    getMonthDateRange,
    HealthSummaryCard,
    PaymentMixCard,
    ReportExportButton,
    ReportFilterPanel,
    ReportMetricCard,
    ReportShell,
} from './report-ui';

type DailyBreakdownRow = {
    date: string;
    grossSales: string;
    totalSessions: number;
    successfulSessions: number;
};

type MonthlyReportData = {
    grossSales: string;
    totalSessions: number;
    successfulSessions: number;
    averageDailySessions: string;
    paidSessions: number;
    voucherSessions: number;
    voucherRedemptions: number;
    printedJobs: number;
    failedPrintJobs: number;
    dailyBreakdown: DailyBreakdownRow[];
};

const monthlyChartConfig = {
    totalSessions: {
        label: 'Sessions',
        color: 'var(--primary)',
    },
    grossSales: {
        label: 'Revenue',
        color: 'var(--info)',
    },
} satisfies ChartConfig;

/**
 * Formats the mixed revenue/session tooltip values without losing their semantic units.
 */
function formatMonthlyTooltipValue(value: unknown, name: string): string {
    if (name === 'grossSales') {
        return formatReportCurrency(Number(value));
    }

    return String(value ?? '');
}

/**
 * Formats one monthly chart date into a compact day label.
 */
function formatChartDate(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * Renders the redesigned monthly sales and operational report.
 */
export default function MonthlyReport({
    year,
    month,
    report,
}: {
    year: number;
    month: number;
    report: MonthlyReportData;
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Reports', href: monthlyReport() },
            { title: 'Monthly', href: monthlyReport() },
        ],
    });

    const monthValue = `${year}-${String(month).padStart(2, '0')}`;
    const monthRange = getMonthDateRange(year, month);

    const links = buildReportNavigationLinks({
        dailyDate: monthRange.start,
        monthlyYear: year,
        monthlyMonth: month,
        rangeStart: monthRange.start,
        rangeEnd: monthRange.end,
    });

    const exportHref = buildReportExportHref(monthRange.start, monthRange.end);

    const operationalMessage =
        report.failedPrintJobs > 0
            ? `${report.failedPrintJobs} failed print job${report.failedPrintJobs === 1 ? '' : 's'} need review.`
            : 'No failed print jobs were recorded for this month.';

    const chartData = report.dailyBreakdown.map((row) => ({
        date: row.date,
        grossSales: Number(row.grossSales),
        totalSessions: row.totalSessions,
    }));
    const hasChartActivity = chartData.some(
        (row) => row.totalSessions > 0 || row.grossSales > 0,
    );

    return (
        <>
            <Head title="Monthly report" />

            <ReportShell
                active="monthly"
                links={links}
                title="Monthly Report"
                description="Overview of monthly sales, session, and print performance."
            >
                <ReportFilterPanel>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <Form
                            action={monthlyReport.url()}
                            method="get"
                            options={{
                                preserveState: true,
                                replace: true,
                            }}
                            transform={(data) => {
                                const [selectedYear, selectedMonth] = String(
                                    data.month,
                                ).split('-');

                                return {
                                    year: selectedYear,
                                    month: selectedMonth,
                                };
                            }}
                            className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                            {() => (
                                <>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="monthly-report-month">
                                            Month
                                        </Label>
                                        <Input
                                            id="monthly-report-month"
                                            type="month"
                                            name="month"
                                            defaultValue={monthValue}
                                            className="sm:w-64"
                                        />
                                    </div>

                                    <Button type="submit" variant="outline">
                                        View report
                                    </Button>
                                </>
                            )}
                        </Form>

                        <ReportExportButton href={exportHref} />
                    </div>
                </ReportFilterPanel>

                <section
                    aria-labelledby="monthly-summary-heading"
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
                >
                    <h2 id="monthly-summary-heading" className="sr-only">
                        Monthly report summary
                    </h2>

                    <ReportMetricCard
                        label="Monthly Revenue"
                        value={formatReportCurrency(report.grossSales)}
                        supportingText={`${report.successfulSessions} completed sessions`}
                        icon={Banknote}
                        tone="primary"
                    />

                    <ReportMetricCard
                        label="Total Sessions"
                        value={String(report.totalSessions)}
                        supportingText={`${report.successfulSessions} completed`}
                        icon={CalendarDays}
                        tone="info"
                    />

                    <ReportMetricCard
                        label="Average Daily Sessions"
                        value={report.averageDailySessions}
                        supportingText={formatReportMonth(year, month)}
                        icon={BarChart3}
                        tone="warning"
                    />

                    <ReportMetricCard
                        label="Successful Prints"
                        value={String(report.printedJobs)}
                        supportingText={
                            report.failedPrintJobs > 0
                                ? `${report.failedPrintJobs} failed`
                                : 'No failed terminal prints'
                        }
                        icon={Printer}
                        tone="success"
                    />

                    <ReportMetricCard
                        label="Voucher Redemptions"
                        value={String(report.voucherRedemptions)}
                        supportingText={`${report.voucherSessions} completed voucher sessions`}
                        icon={TicketCheck}
                        tone="info"
                    />
                </section>

                <section
                    aria-label="Monthly performance and payment composition"
                    className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]"
                >
                    <Card className="gap-0 rounded-xl py-0 shadow-none">
                        <CardContent className="px-4 py-4">
                            <div>
                                <h2 className="font-semibold">
                                    Daily Sessions Trend
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Total sessions and successful
                                    completed-session revenue throughout{' '}
                                    {formatReportMonth(year, month)}
                                </p>
                            </div>

                            {hasChartActivity ? (
                                <ChartContainer
                                    data-testid="monthly-sales-chart"
                                    role="img"
                                    aria-label={`Daily sessions and revenue for ${formatReportMonth(year, month)}`}
                                    config={monthlyChartConfig}
                                    className="mt-4 h-80 min-h-80"
                                >
                                    <ComposedChart
                                        data={chartData}
                                        margin={{
                                            top: 8,
                                            right: 8,
                                            bottom: 0,
                                            left: 0,
                                        }}
                                    >
                                        <CartesianGrid
                                            vertical={false}
                                            strokeDasharray="3 3"
                                        />

                                        <XAxis
                                            dataKey="date"
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={20}
                                            tickFormatter={formatChartDate}
                                        />

                                        <YAxis
                                            yAxisId="sessions"
                                            tickLine={false}
                                            axisLine={false}
                                            width={36}
                                            allowDecimals={false}
                                        />

                                        <YAxis
                                            yAxisId="sales"
                                            orientation="right"
                                            tickLine={false}
                                            axisLine={false}
                                            width={60}
                                            tickFormatter={
                                                formatCompactReportCurrency
                                            }
                                        />

                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    formatter={
                                                        formatMonthlyTooltipValue
                                                    }
                                                />
                                            }
                                        />

                                        <Area
                                            yAxisId="sessions"
                                            type="monotone"
                                            dataKey="totalSessions"
                                            stroke="var(--color-totalSessions)"
                                            fill="var(--color-totalSessions)"
                                            fillOpacity={0.12}
                                            strokeWidth={2}
                                        />

                                        <Line
                                            yAxisId="sales"
                                            type="monotone"
                                            dataKey="grossSales"
                                            stroke="var(--color-grossSales)"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </ComposedChart>
                                </ChartContainer>
                            ) : (
                                <div className="mt-4 flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                    No sales activity to chart for this period.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-4">
                        <PaymentMixCard
                            mayaSessions={report.paidSessions}
                            voucherSessions={report.voucherSessions}
                        />

                        <HealthSummaryCard
                            title="Print health"
                            description="Terminal thermal print outcomes for the selected month"
                            healthyLabel="Printed jobs"
                            healthyValue={report.printedJobs}
                            issueLabel="Failed print jobs"
                            issueValue={report.failedPrintJobs}
                            message={operationalMessage}
                        />
                    </div>
                </section>

                <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
                    <CardContent className="p-0">
                        <div className="px-4 py-4">
                            <h2 className="font-semibold">Daily Breakdown</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Session completion and sales totals by active
                                day
                            </p>
                        </div>

                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[48rem] text-sm">
                                <thead className="bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Total Sessions
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Completed
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Revenue
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {report.dailyBreakdown.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-4 py-10 text-center text-muted-foreground"
                                            >
                                                No activity for this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        report.dailyBreakdown.map((row) => (
                                            <tr
                                                key={row.date}
                                                className="border-t"
                                            >
                                                <td className="px-4 py-3 font-medium">
                                                    {formatReportDate(row.date)}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.totalSessions}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.successfulSessions}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium tabular-nums">
                                                    {formatReportCurrency(
                                                        row.grossSales,
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </ReportShell>
        </>
    );
}
