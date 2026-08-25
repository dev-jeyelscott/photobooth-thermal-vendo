import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Banknote,
    CalendarDays,
    Download,
    Printer,
    ReceiptText,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import {
    daily as dailyReport,
    range as rangeReport,
} from '@/routes/admin/reports';
import {
    buildReportExportHref,
    buildReportNavigationLinks,
    formatCompactReportCurrency,
    formatReportCurrency,
    formatReportDate,
    ReportNavigation,
} from './report-ui';

type DailyBreakdownRow = {
    date: string;
    totalSessions: number;
    completedSessions: number;
    completedRate: number;
    expiredOrAbandonedSessions: number;
    expiredOrAbandonedRate: number;
    revenue: string;
    successfulPayments: number;
    printedJobs: number;
    failedPrintJobs: number;
    printSuccessRate: number | null;
    averageTicketSize: string;
};

type RangeReportData = {
    revenue: string;
    successfulPayments: number;
    failedPayments: number;
    completedSessions: number;
    voucherSessions: number;
    failedPrintJobs: number;
    totalSessions: number;
    printedJobs: number;
    printSuccessRate: number | null;
    averageTicketSize: string;
    dailyBreakdown: DailyBreakdownRow[];
};

type RangeMetricTone = 'primary' | 'success' | 'warning' | 'info';

const rangeMetricToneClasses: Record<RangeMetricTone, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning',
    info: 'bg-info-subtle text-info',
};

const sessionsChartConfig = {
    totalSessions: {
        label: 'Sessions',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

const revenueChartConfig = {
    revenue: {
        label: 'Revenue',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

/**
 * Formats one percentage value consistently for report KPIs and table cells.
 */
function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
}

/**
 * Formats one range chart date into the compact month/day style used by the admin charts.
 */
function formatRangeChartDate(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * Formats range chart tooltip values without losing currency or count semantics.
 */
function formatRangeTooltipValue(value: unknown, name: string): string {
    if (name === 'revenue') {
        return formatReportCurrency(Number(value));
    }

    return String(value ?? '');
}

/**
 * Resolves a semantic badge treatment for a daily terminal print success rate.
 */
function getPrintSuccessBadgeClass(value: number | null): string {
    if (value === null) {
        return 'border-border bg-muted text-muted-foreground';
    }

    if (value >= 95) {
        return 'border-success/20 bg-success-subtle text-success-foreground';
    }

    if (value >= 80) {
        return 'border-warning/20 bg-warning-subtle text-warning-foreground';
    }

    return 'border-destructive/20 bg-destructive/10 text-destructive';
}

/**
 * Renders one compact date-range KPI card using only canonical semantic tokens.
 */
function RangeMetricCard({
    label,
    value,
    supportingText,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    supportingText: ReactNode;
    icon: LucideIcon;
    tone: RangeMetricTone;
}) {
    return (
        <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="flex min-h-28 items-center gap-4 px-4 py-4">
                <div
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-full',
                        rangeMetricToneClasses[tone],
                    )}
                >
                    <Icon className="size-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                        {label}
                    </p>
                    <strong className="mt-1 block truncate text-2xl font-semibold tracking-tight tabular-nums">
                        {value}
                    </strong>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {supportingText}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the redesigned sales and operations report for an arbitrary date range.
 */
export default function RangeReport({
    start,
    end,
    report,
}: {
    start: string;
    end: string;
    report: RangeReportData;
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Reports', href: rangeReport() }],
    });

    const [year, month] = start.split('-').map(Number);

    const links = buildReportNavigationLinks({
        dailyDate: start,
        monthlyYear: year,
        monthlyMonth: month,
        rangeStart: start,
        rangeEnd: end,
    });

    const exportHref = buildReportExportHref(start, end);
    const chartData = report.dailyBreakdown.map((row) => ({
        date: row.date,
        totalSessions: row.totalSessions,
        revenue: Number(row.revenue),
    }));
    const hasSessionActivity = chartData.some((row) => row.totalSessions > 0);
    const hasRevenueActivity = chartData.some((row) => row.revenue > 0);
    const hasDailyActivity = report.dailyBreakdown.some(
        (row) =>
            row.totalSessions > 0 ||
            row.successfulPayments > 0 ||
            row.printedJobs > 0 ||
            row.failedPrintJobs > 0,
    );

    return (
        <>
            <Head title="Date range report" />

            <div className="flex flex-col gap-4 p-4 md:p-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Date Range Report
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Compare sales and operational performance across a
                        selected date range.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-info-subtle px-3 py-1.5 text-xs font-medium text-info">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatReportDate(start)} to {formatReportDate(end)}
                    </div>
                </header>

                <ReportNavigation active="range" links={links} />

                <Card className="gap-0 rounded-xl py-0 shadow-none">
                    <CardContent className="p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <Form
                                action={rangeReport.url()}
                                method="get"
                                options={{
                                    preserveState: true,
                                    replace: true,
                                }}
                                className="grid flex-1 gap-3 md:grid-cols-[minmax(0,14rem)_auto_minmax(0,14rem)_auto] md:items-end"
                            >
                                {() => (
                                    <>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="range-report-start">
                                                Start date
                                            </Label>
                                            <Input
                                                id="range-report-start"
                                                type="date"
                                                name="start"
                                                defaultValue={start}
                                            />
                                        </div>

                                        <span
                                            className="hidden h-9 items-center text-sm text-muted-foreground sm:flex"
                                            aria-hidden="true"
                                        >
                                            to
                                        </span>

                                        <div className="grid gap-1.5">
                                            <Label htmlFor="range-report-end">
                                                End date
                                            </Label>
                                            <Input
                                                id="range-report-end"
                                                type="date"
                                                name="end"
                                                defaultValue={end}
                                            />
                                        </div>

                                        <Button type="submit" variant="outline">
                                            View report
                                        </Button>
                                    </>
                                )}
                            </Form>

                            <Button asChild className="xl:self-end">
                                <a href={exportHref}>
                                    <Download
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Export Report
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <section
                    aria-labelledby="range-summary-heading"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                    <h2 id="range-summary-heading" className="sr-only">
                        Date range report summary
                    </h2>

                    <RangeMetricCard
                        label="Total Sessions"
                        value={String(report.totalSessions)}
                        supportingText={`${report.completedSessions} completed, ${report.voucherSessions} voucher`}
                        icon={CalendarDays}
                        tone="primary"
                    />

                    <RangeMetricCard
                        label="Revenue"
                        value={formatReportCurrency(report.revenue)}
                        supportingText={`${report.successfulPayments} successful, ${report.failedPayments} failed`}
                        icon={Banknote}
                        tone="success"
                    />

                    <RangeMetricCard
                        label="Print Success Rate"
                        value={
                            report.printSuccessRate === null
                                ? '—'
                                : formatPercentage(report.printSuccessRate)
                        }
                        supportingText={
                            report.printSuccessRate === null
                                ? 'No terminal print jobs'
                                : `${report.printedJobs} printed, ${report.failedPrintJobs} failed`
                        }
                        icon={Printer}
                        tone="warning"
                    />

                    <RangeMetricCard
                        label="Average Ticket Size"
                        value={formatReportCurrency(report.averageTicketSize)}
                        supportingText={
                            report.successfulPayments > 0
                                ? 'Per successful payment'
                                : 'No successful payments'
                        }
                        icon={ReceiptText}
                        tone="info"
                    />
                </section>

                <section
                    aria-label="Date range performance charts"
                    className="grid gap-4 xl:grid-cols-2"
                >
                    <Card className="gap-0 rounded-xl py-0 shadow-none">
                        <CardContent className="px-4 py-4">
                            <div>
                                <h2 className="font-semibold">
                                    Sessions Over Time
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Total sessions recorded on each active day
                                </p>
                            </div>

                            {hasSessionActivity ? (
                                <ChartContainer
                                    data-testid="range-sessions-chart"
                                    role="img"
                                    aria-label={`Sessions from ${formatReportDate(start)} to ${formatReportDate(end)}`}
                                    config={sessionsChartConfig}
                                    className="mt-5 h-64 min-h-64"
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
                                            tickFormatter={formatRangeChartDate}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            width={36}
                                            allowDecimals={false}
                                        />
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    formatter={
                                                        formatRangeTooltipValue
                                                    }
                                                />
                                            }
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="totalSessions"
                                            stroke="var(--color-totalSessions)"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 4 }}
                                        />
                                    </ComposedChart>
                                </ChartContainer>
                            ) : (
                                <div className="mt-5 flex min-h-52 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                    No session activity to chart for this
                                    period.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="gap-0 rounded-xl py-0 shadow-none">
                        <CardContent className="px-4 py-4">
                            <div>
                                <h2 className="font-semibold">
                                    Revenue Over Time
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Successful completed-session payments by day
                                </p>
                            </div>

                            {hasRevenueActivity ? (
                                <ChartContainer
                                    data-testid="range-revenue-chart"
                                    role="img"
                                    aria-label={`Revenue from ${formatReportDate(start)} to ${formatReportDate(end)}`}
                                    config={revenueChartConfig}
                                    className="mt-5 h-64 min-h-64"
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
                                            tickFormatter={formatRangeChartDate}
                                        />
                                        <YAxis
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
                                                        formatRangeTooltipValue
                                                    }
                                                />
                                            }
                                        />
                                        <Bar
                                            dataKey="revenue"
                                            fill="var(--color-revenue)"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </ComposedChart>
                                </ChartContainer>
                            ) : (
                                <div className="mt-5 flex min-h-52 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                    No revenue activity to chart for this
                                    period.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
                    <CardContent className="p-0">
                        <div className="px-4 py-4">
                            <h2 className="font-semibold">Daily Breakdown</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Session, payment, and terminal print performance
                                by active day
                            </p>
                        </div>

                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[76rem] text-sm">
                                <thead className="bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Sessions
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Completed
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Expired / Abandoned
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Revenue
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Successful Payments
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Print Success Rate
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Average Ticket Size
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {!hasDailyActivity ? (
                                        <tr>
                                            <td
                                                colSpan={9}
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
                                                <td className="px-4 py-3 font-medium whitespace-nowrap">
                                                    {formatReportDate(row.date)}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.totalSessions}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <span className="font-medium text-foreground">
                                                        {row.completedSessions}
                                                    </span>{' '}
                                                    <span className="text-muted-foreground">
                                                        (
                                                        {formatPercentage(
                                                            row.completedRate,
                                                        )}
                                                        )
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <span
                                                        className={cn(
                                                            'font-medium',
                                                            row.expiredOrAbandonedSessions >
                                                                0
                                                                ? 'text-destructive'
                                                                : 'text-foreground',
                                                        )}
                                                    >
                                                        {
                                                            row.expiredOrAbandonedSessions
                                                        }
                                                    </span>{' '}
                                                    <span className="text-muted-foreground">
                                                        (
                                                        {formatPercentage(
                                                            row.expiredOrAbandonedRate,
                                                        )}
                                                        )
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                                                    {formatReportCurrency(
                                                        row.revenue,
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.successfulPayments}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'font-medium tabular-nums',
                                                            getPrintSuccessBadgeClass(
                                                                row.printSuccessRate,
                                                            ),
                                                        )}
                                                    >
                                                        {row.printSuccessRate ===
                                                        null
                                                            ? 'No terminal prints'
                                                            : formatPercentage(
                                                                  row.printSuccessRate,
                                                              )}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                                                    {formatReportCurrency(
                                                        row.averageTicketSize,
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <Link
                                                            href={dailyReport.url(
                                                                {
                                                                    query: {
                                                                        date: row.date,
                                                                    },
                                                                },
                                                            )}
                                                        >
                                                            View
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
