import { Form, Head, setLayoutProps } from '@inertiajs/react';
import {
    Banknote,
    CalendarDays,
    CircleCheck,
    Printer,
    ReceiptText,
    TicketCheck,
    TriangleAlert,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import { daily as dailyReport } from '@/routes/admin/reports';
import {
    buildReportExportHref,
    buildReportNavigationLinks,
    calculateShare,
    formatReportCurrency,
    formatReportDate,
    PaymentMixCard,
    ReportExportButton,
    ReportFilterPanel,
    ReportMetricCard,
    ReportShell,
} from './report-ui';

type HourlySessionRow = {
    hour: number;
    sessions: number;
};

type DailyReportData = {
    grossSales: string;
    totalSessions: number;
    successfulSessions: number;
    paidSessions: number;
    voucherSessions: number;
    failedPayments: number;
    printedJobs: number;
    failedPrintJobs: number;
    averageTransactionValue: string;
    hourlyBreakdown: HourlySessionRow[];
};

const hourlyChartConfig = {
    sessions: {
        label: 'Sessions',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

/**
 * Formats an integer hour into the compact 12-hour label used by the daily chart.
 */
function formatHourLabel(hour: number): string {
    const normalizedHour = hour % 24;
    const displayHour = normalizedHour % 12 || 12;
    const suffix = normalizedHour < 12 ? 'AM' : 'PM';

    return `${displayHour} ${suffix}`;
}

/**
 * Formats hourly session tooltip values as whole-number counts.
 */
function formatHourlyTooltipValue(value: unknown): string {
    return String(Number(value ?? 0));
}

/**
 * Renders the redesigned repository-backed daily operations report.
 */
export default function DailyReport({
    date,
    report,
}: {
    date: string;
    report: DailyReportData;
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Reports', href: dailyReport() },
            { title: 'Daily', href: dailyReport() },
        ],
    });

    const [year, month] = date.split('-').map(Number);

    const links = buildReportNavigationLinks({
        dailyDate: date,
        monthlyYear: year,
        monthlyMonth: month,
        rangeStart: date,
        rangeEnd: date,
    });

    const exportHref = buildReportExportHref(date, date);
    const voucherShare = calculateShare(
        report.voucherSessions,
        report.successfulSessions,
    );
    const hasHourlyActivity = report.hourlyBreakdown.some(
        (row) => row.sessions > 0,
    );

    return (
        <>
            <Head title="Daily report" />

            <ReportShell
                active="daily"
                links={links}
                title="Daily Report"
                description="Daily overview of session, payment, and print performance."
            >
                <ReportFilterPanel>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <Form
                            action={dailyReport.url()}
                            method="get"
                            options={{
                                preserveState: true,
                                replace: true,
                            }}
                            className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                            {() => (
                                <>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="daily-report-date">
                                            Date
                                        </Label>
                                        <Input
                                            id="daily-report-date"
                                            type="date"
                                            name="date"
                                            defaultValue={date}
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
                    aria-labelledby="daily-summary-heading"
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
                >
                    <h2 id="daily-summary-heading" className="sr-only">
                        Daily report summary
                    </h2>

                    <ReportMetricCard
                        label="Total Sessions"
                        value={String(report.totalSessions)}
                        supportingText={`${report.successfulSessions} completed`}
                        icon={CalendarDays}
                        tone="primary"
                    />

                    <ReportMetricCard
                        label="Completed Prints"
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
                        label="Revenue"
                        value={formatReportCurrency(report.grossSales)}
                        supportingText={`${report.successfulSessions} completed sessions`}
                        icon={Banknote}
                        tone="warning"
                    />

                    <ReportMetricCard
                        label="Voucher Usage"
                        value={String(report.voucherSessions)}
                        supportingText={`${voucherShare.toFixed(1)}% of completed sessions`}
                        icon={TicketCheck}
                        tone="info"
                    />

                    <ReportMetricCard
                        label="Failed Prints"
                        value={String(report.failedPrintJobs)}
                        supportingText={
                            report.failedPrintJobs > 0
                                ? 'Operator review required'
                                : 'No terminal print failures'
                        }
                        icon={TriangleAlert}
                        tone={report.failedPrintJobs > 0 ? 'danger' : 'neutral'}
                    />
                </section>

                <section
                    aria-label="Daily activity and payment composition"
                    className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]"
                >
                    <Card className="gap-0 rounded-xl py-0 shadow-none">
                        <CardContent className="px-4 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="font-semibold">
                                        Hourly Sessions
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Sessions recorded throughout{' '}
                                        {formatReportDate(date)}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <span className="text-xs text-muted-foreground">
                                        Total
                                    </span>
                                    <strong className="block text-lg font-semibold tabular-nums">
                                        {report.totalSessions}
                                    </strong>
                                </div>
                            </div>

                            {hasHourlyActivity ? (
                                <ChartContainer
                                    data-testid="daily-hourly-chart"
                                    role="img"
                                    aria-label={`Hourly sessions for ${formatReportDate(date)}`}
                                    config={hourlyChartConfig}
                                    className="mt-4 h-72 min-h-72"
                                >
                                    <BarChart
                                        data={report.hourlyBreakdown}
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
                                            dataKey="hour"
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={24}
                                            tickFormatter={formatHourLabel}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            width={36}
                                            allowDecimals={false}
                                        />
                                        <ChartTooltip
                                            labelFormatter={(value) =>
                                                formatHourLabel(Number(value))
                                            }
                                            content={
                                                <ChartTooltipContent
                                                    formatter={
                                                        formatHourlyTooltipValue
                                                    }
                                                />
                                            }
                                        />
                                        <Bar
                                            dataKey="sessions"
                                            fill="var(--color-sessions)"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <div className="mt-4 flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                    No session activity to chart for this day.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <PaymentMixCard
                        mayaSessions={report.paidSessions}
                        voucherSessions={report.voucherSessions}
                    />
                </section>

                <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
                    <CardContent className="p-0">
                        <div className="px-4 py-4">
                            <h2 className="font-semibold">
                                Operational Summary
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Repository-backed daily details without booth or
                                unsupported payment-provider assumptions
                            </p>
                        </div>

                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[48rem] text-sm">
                                <thead className="bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Metric
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Value
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Context
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t">
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-2 font-medium">
                                                <CircleCheck
                                                    className="size-4 text-success"
                                                    aria-hidden="true"
                                                />
                                                Successful sessions
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                                            {report.successfulSessions}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            Completed photobooth sessions
                                        </td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-3 font-medium">
                                            Maya sessions
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                                            {report.paidSessions}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            Completed sessions paid through Maya
                                        </td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-3 font-medium">
                                            Voucher sessions
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                                            {report.voucherSessions}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            Completed sessions authorized by
                                            voucher
                                        </td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-3 font-medium">
                                            Failed payments
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                                            {report.failedPayments}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            Recorded payment failures for this
                                            day
                                        </td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-2 font-medium">
                                                <ReceiptText
                                                    className="size-4 text-info"
                                                    aria-hidden="true"
                                                />
                                                Average transaction value
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                                            {formatReportCurrency(
                                                report.averageTransactionValue,
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            Revenue per successful completed
                                            session
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </ReportShell>
        </>
    );
}
