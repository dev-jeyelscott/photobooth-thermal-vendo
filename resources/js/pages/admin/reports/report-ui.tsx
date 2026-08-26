import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Download, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import {
    daily as dailyReport,
    exportMethod as exportReport,
    monthly as monthlyReport,
    range as rangeReport,
} from '@/routes/admin/reports';

export type ReportView = 'daily' | 'monthly' | 'range';

export type ReportNavigationLinks = {
    daily: string;
    monthly: string;
    range: string;
};

type MetricTone =
    'neutral' | 'primary' | 'success' | 'info' | 'warning' | 'danger';

const metricToneClasses: Record<MetricTone, string> = {
    neutral: 'bg-muted text-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success-subtle text-success',
    info: 'bg-info-subtle text-info',
    warning: 'bg-warning-subtle text-warning',
    danger: 'bg-destructive/10 text-destructive',
};

const paymentMixChartConfig = {
    maya: {
        label: 'Maya',
        color: 'var(--primary)',
    },
    voucher: {
        label: 'Voucher',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

/**
 * Calculates a safe percentage for a portion of a total.
 */
export function calculateShare(value: number, total: number): number {
    if (total <= 0 || value <= 0) {
        return 0;
    }

    return Math.round((value / total) * 1000) / 10;
}

/**
 * Formats monetary values consistently using Philippine peso formatting.
 */
export function formatReportCurrency(value: string | number): string {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value));
}

/**
 * Formats currency compactly for chart axes.
 */
export function formatCompactReportCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        notation: 'compact',
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * Formats an ISO date without allowing browser timezone conversion to change the day.
 */
export function formatReportDate(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * Formats the selected year and month for report context labels.
 */
export function formatReportMonth(year: number, month: number): string {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Returns ISO start and end dates for a selected calendar month.
 */
export function getMonthDateRange(
    year: number,
    month: number,
): { start: string; end: string } {
    const monthValue = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
        start: `${year}-${monthValue}-01`,
        end: `${year}-${monthValue}-${String(lastDay).padStart(2, '0')}`,
    };
}

/**
 * Builds typed Wayfinder destinations for the shared Reports sub-navigation.
 */
export function buildReportNavigationLinks({
    dailyDate,
    monthlyYear,
    monthlyMonth,
    rangeStart,
    rangeEnd,
}: {
    dailyDate: string;
    monthlyYear: number;
    monthlyMonth: number;
    rangeStart: string;
    rangeEnd: string;
}): ReportNavigationLinks {
    return {
        daily: dailyReport.url({
            query: { date: dailyDate },
        }),
        monthly: monthlyReport.url({
            query: {
                year: monthlyYear,
                month: monthlyMonth,
            },
        }),
        range: rangeReport.url({
            query: {
                start: rangeStart,
                end: rangeEnd,
            },
        }),
    };
}

/**
 * Builds the existing CSV export route for a concrete reporting period.
 */
export function buildReportExportHref(start: string, end: string): string {
    return exportReport.url({
        query: {
            start,
            end,
        },
    });
}

/**
 * Renders compact sibling navigation for the three report views.
 */
export function ReportNavigation({
    active,
    links,
}: {
    active: ReportView;
    links: ReportNavigationLinks;
}) {
    const items: Array<{
        id: ReportView;
        label: string;
        href: string;
    }> = [
        {
            id: 'daily',
            label: 'Daily',
            href: links.daily,
        },
        {
            id: 'monthly',
            label: 'Monthly',
            href: links.monthly,
        },
        {
            id: 'range',
            label: 'Date Range',
            href: links.range,
        },
    ];

    return (
        <nav aria-label="Report views" className="overflow-x-auto">
            <div className="inline-flex min-w-max items-center gap-1 rounded-lg border bg-muted/40 p-1">
                {items.map((item) => {
                    const isActive = item.id === active;

                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'inline-flex min-h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors',
                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                isActive
                                    ? 'bg-background text-primary shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

/**
 * Renders the shared report page title and report-view navigation.
 */
export function ReportShell({
    active,
    links,
    title,
    description,
    children,
}: {
    active: ReportView;
    links: ReportNavigationLinks;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                </p>
            </header>

            <ReportNavigation active={active} links={links} />

            {children}
        </div>
    );
}

/**
 * Provides the shared bordered surface used for report filter and export controls.
 */
export function ReportFilterPanel({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-xl border bg-card p-3 shadow-none md:p-4">
            {children}
        </div>
    );
}

/**
 * Renders the existing CSV export destination with a consistent report action treatment.
 */
export function ReportExportButton({
    href,
    label = 'Export Report',
}: {
    href: string;
    label?: string;
}) {
    return (
        <Button asChild className="shrink-0">
            <a href={href}>
                <Download className="size-4" aria-hidden="true" />
                {label}
            </a>
        </Button>
    );
}

/**
 * Renders one compact report KPI using the existing semantic design tokens.
 */
export function ReportMetricCard({
    label,
    value,
    supportingText,
    icon: Icon,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    supportingText?: ReactNode;
    icon: LucideIcon;
    tone?: MetricTone;
}) {
    return (
        <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="flex min-h-28 items-center gap-4 px-4 py-4">
                <div
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-full',
                        metricToneClasses[tone],
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
                    {supportingText && (
                        <div className="mt-1 text-xs text-muted-foreground">
                            {supportingText}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the repository-backed Maya and voucher payment composition as a donut and legend.
 */
export function PaymentMixCard({
    mayaSessions,
    voucherSessions,
}: {
    mayaSessions: number;
    voucherSessions: number;
}) {
    const total = mayaSessions + voucherSessions;
    const mayaShare = calculateShare(mayaSessions, total);
    const voucherShare = calculateShare(voucherSessions, total);
    const chartData = [
        {
            name: 'Maya',
            value: mayaSessions,
        },
        {
            name: 'Voucher',
            value: voucherSessions,
        },
    ];

    return (
        <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="px-4 py-4">
                <div>
                    <h2 className="font-semibold">Payment mix</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Completed sessions using the supported payment methods
                    </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
                    <div className="relative mx-auto w-full max-w-44">
                        <ChartContainer
                            config={paymentMixChartConfig}
                            role="img"
                            aria-label={`Payment mix: ${mayaSessions} Maya sessions and ${voucherSessions} voucher sessions`}
                            className="h-44 min-h-44"
                        >
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={54}
                                    outerRadius={76}
                                    paddingAngle={total > 0 ? 2 : 0}
                                    strokeWidth={0}
                                >
                                    <Cell fill="var(--primary)" />
                                    <Cell fill="var(--chart-4)" />
                                </Pie>
                            </PieChart>
                        </ChartContainer>

                        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                            <div>
                                <strong className="block text-xl font-semibold tabular-nums">
                                    {total}
                                </strong>
                                <span className="text-xs text-muted-foreground">
                                    Sessions
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full bg-primary" />
                                <span className="truncate text-sm">Maya</span>
                            </div>
                            <div className="text-right">
                                <strong className="block text-sm tabular-nums">
                                    {mayaSessions}
                                </strong>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {mayaShare.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full bg-chart-4" />
                                <span className="truncate text-sm">
                                    Voucher
                                </span>
                            </div>
                            <div className="text-right">
                                <strong className="block text-sm tabular-nums">
                                    {voucherSessions}
                                </strong>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {voucherShare.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                    {total > 0
                        ? `${total} completed sessions are represented in this mix.`
                        : 'No Maya or voucher sessions for this period.'}
                </p>
            </CardContent>
        </Card>
    );
}

/**
 * Renders one healthy operational count alongside one failure count.
 */
export function HealthSummaryCard({
    title,
    description,
    healthyLabel,
    healthyValue,
    issueLabel,
    issueValue,
    message,
}: {
    title: string;
    description: string;
    healthyLabel: string;
    healthyValue: number;
    issueLabel: string;
    issueValue: number;
    message: string;
}) {
    const hasIssues = issueValue > 0;

    return (
        <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="px-4 py-4">
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2
                                className="size-4 text-success"
                                aria-hidden="true"
                            />
                            {healthyLabel}
                        </div>

                        <strong className="mt-2 block text-2xl font-semibold tabular-nums">
                            {healthyValue}
                        </strong>
                    </div>

                    <div className="border-border sm:border-l sm:pl-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TriangleAlert
                                className={cn(
                                    'size-4',
                                    hasIssues
                                        ? 'text-destructive'
                                        : 'text-muted-foreground',
                                )}
                                aria-hidden="true"
                            />
                            {issueLabel}
                        </div>

                        <strong
                            className={cn(
                                'mt-2 block text-2xl font-semibold tabular-nums',
                                hasIssues && 'text-destructive',
                            )}
                        >
                            {issueValue}
                        </strong>
                    </div>
                </div>

                <div
                    className={cn(
                        'mt-5 rounded-lg border px-3 py-2.5 text-sm',
                        hasIssues
                            ? 'border-warning/25 bg-warning-subtle text-warning-foreground'
                            : 'border-success/25 bg-success-subtle text-success-foreground',
                    )}
                >
                    {message}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Renders two operational issue counters without inventing a success metric.
 */
export function IssueSummaryCard({
    firstLabel,
    firstValue,
    secondLabel,
    secondValue,
}: {
    firstLabel: string;
    firstValue: number;
    secondLabel: string;
    secondValue: number;
}) {
    const totalIssues = firstValue + secondValue;
    const hasIssues = totalIssues > 0;

    return (
        <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="px-4 py-4">
                <div>
                    <h2 className="font-semibold">Operational health</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Payment and printing failures that need operator review
                    </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TriangleAlert
                                className={cn(
                                    'size-4',
                                    firstValue > 0
                                        ? 'text-destructive'
                                        : 'text-muted-foreground',
                                )}
                                aria-hidden="true"
                            />
                            {firstLabel}
                        </div>

                        <strong
                            className={cn(
                                'mt-2 block text-2xl font-semibold tabular-nums',
                                firstValue > 0 && 'text-destructive',
                            )}
                        >
                            {firstValue}
                        </strong>
                    </div>

                    <div className="border-border sm:border-l sm:pl-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TriangleAlert
                                className={cn(
                                    'size-4',
                                    secondValue > 0
                                        ? 'text-destructive'
                                        : 'text-muted-foreground',
                                )}
                                aria-hidden="true"
                            />
                            {secondLabel}
                        </div>

                        <strong
                            className={cn(
                                'mt-2 block text-2xl font-semibold tabular-nums',
                                secondValue > 0 && 'text-destructive',
                            )}
                        >
                            {secondValue}
                        </strong>
                    </div>
                </div>

                <div
                    className={cn(
                        'mt-5 rounded-xl border px-4 py-3 text-sm',
                        hasIssues
                            ? 'border-warning/25 bg-warning-subtle text-warning-foreground'
                            : 'border-success/25 bg-success-subtle text-success-foreground',
                    )}
                >
                    {hasIssues
                        ? `${totalIssues} operational issue${totalIssues === 1 ? '' : 's'} need review.`
                        : 'No payment or printing failures for this period.'}
                </div>
            </CardContent>
        </Card>
    );
}
