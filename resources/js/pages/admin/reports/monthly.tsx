import { Form, Head, setLayoutProps } from '@inertiajs/react';
import { Banknote, CircleCheck, TicketCheck } from 'lucide-react';
import {
    Bar,
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
    ReportFilterPanel,
    ReportMetricCard,
    ReportShell,
} from './report-ui';

type DailyBreakdownRow = {
    date: string;
    grossSales: string;
    successfulSessions: number;
};

type MonthlyReportData = {
    grossSales: string;
    successfulSessions: number;
    paidSessions: number;
    voucherSessions: number;
    voucherRedemptions: number;
    printedJobs: number;
    failedPrintJobs: number;
    dailyBreakdown: DailyBreakdownRow[];
};

const monthlyChartConfig = {
    grossSales: {
        label: 'Gross sales',
        color: 'var(--foreground)',
    },
    successfulSessions: {
        label: 'Successful sessions',
        color: 'var(--info)',
    },
} satisfies ChartConfig;

/**
 * Formats the mixed sales/session tooltip values without losing their semantic units.
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
 * Renders the richer monthly sales and operational report.
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
        breadcrumbs: [{ title: 'Reports', href: monthlyReport() }],
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
        successfulSessions: row.successfulSessions,
    }));

    return (
        <>
            <Head title="Monthly report" />

            <ReportShell
                active="monthly"
                links={links}
                periodLabel={`Reporting period: ${formatReportMonth(year, month)}`}
                exportHref={exportHref}
            >
                <ReportFilterPanel>
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
                                        className="sm:w-56"
                                    />
                                </div>

                                <Button type="submit">View report</Button>
                            </>
                        )}
                    </Form>
                </ReportFilterPanel>

                <section
                    aria-labelledby="monthly-summary-heading"
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                    <h2 id="monthly-summary-heading" className="sr-only">
                        Monthly report summary
                    </h2>

                    <ReportMetricCard
                        label="Gross sales"
                        value={formatReportCurrency(report.grossSales)}
                        icon={Banknote}
                        tone="success"
                    />

                    <ReportMetricCard
                        label="Successful sessions"
                        value={String(report.successfulSessions)}
                        icon={CircleCheck}
                        tone="info"
                    />

                    <ReportMetricCard
                        label="Voucher redemptions"
                        value={String(report.voucherRedemptions)}
                        icon={TicketCheck}
                        tone="warning"
                    />
                </section>

                <section
                    aria-label="Monthly payment and operational insights"
                    className="grid gap-4 xl:grid-cols-2"
                >
                    <PaymentMixCard
                        mayaSessions={report.paidSessions}
                        voucherSessions={report.voucherSessions}
                    />

                    <HealthSummaryCard
                        title="Operational health"
                        description="Thermal print fulfillment for the selected month"
                        healthyLabel="Printed jobs"
                        healthyValue={report.printedJobs}
                        issueLabel="Failed print jobs"
                        issueValue={report.failedPrintJobs}
                        message={operationalMessage}
                    />
                </section>

                <Card className="gap-0 rounded-2xl py-0 shadow-none">
                    <CardContent className="px-5 py-5">
                        <div>
                            <h2 className="font-semibold">
                                Daily sales performance
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Gross sales and successful sessions throughout
                                the selected month
                            </p>
                        </div>

                        {chartData.length > 0 ? (
                            <ChartContainer
                                data-testid="monthly-sales-chart"
                                role="img"
                                aria-label={`Daily sales performance for ${formatReportMonth(year, month)}`}
                                config={monthlyChartConfig}
                                className="mt-6 h-72 min-h-72"
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
                                        tickFormatter={formatChartDate}
                                    />

                                    <YAxis
                                        yAxisId="sales"
                                        tickLine={false}
                                        axisLine={false}
                                        width={60}
                                        tickFormatter={
                                            formatCompactReportCurrency
                                        }
                                    />

                                    <YAxis
                                        yAxisId="sessions"
                                        orientation="right"
                                        tickLine={false}
                                        axisLine={false}
                                        width={36}
                                        allowDecimals={false}
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

                                    <Bar
                                        yAxisId="sales"
                                        dataKey="grossSales"
                                        fill="var(--color-grossSales)"
                                        radius={[4, 4, 0, 0]}
                                    />

                                    <Line
                                        yAxisId="sessions"
                                        type="monotone"
                                        dataKey="successfulSessions"
                                        stroke="var(--color-successfulSessions)"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </ComposedChart>
                            </ChartContainer>
                        ) : (
                            <div className="mt-6 flex min-h-56 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                No sales activity to chart for this period.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none">
                    <CardContent className="p-0">
                        <div className="px-5 py-5">
                            <h2 className="font-semibold">Daily breakdown</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Detailed sales and session totals by day
                            </p>
                        </div>

                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[40rem] text-sm">
                                <thead className="bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">
                                            Date
                                        </th>
                                        <th className="px-5 py-3 text-right font-medium">
                                            Successful sessions
                                        </th>
                                        <th className="px-5 py-3 text-right font-medium">
                                            Gross sales
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {report.dailyBreakdown.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={3}
                                                className="px-5 py-10 text-center text-muted-foreground"
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
                                                <td className="px-5 py-3">
                                                    {formatReportDate(row.date)}
                                                </td>
                                                <td className="px-5 py-3 text-right tabular-nums">
                                                    {row.successfulSessions}
                                                </td>
                                                <td className="px-5 py-3 text-right font-medium tabular-nums">
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
