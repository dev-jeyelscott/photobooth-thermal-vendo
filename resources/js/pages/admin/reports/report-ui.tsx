import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarDays,
    CheckCircle2,
    Download,
    TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

type MetricTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

const metricToneClasses: Record<MetricTone, string> = {
    neutral: 'bg-muted text-foreground',
    success: 'bg-success-subtle text-success',
    info: 'bg-info-subtle text-info',
    warning: 'bg-warning-subtle text-warning',
    danger: 'bg-destructive/10 text-destructive',
};

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
 * Renders the report-level Daily, Monthly, and Date Range navigation.
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
        <nav
            aria-label="Report views"
            className="overflow-x-auto rounded-xl border bg-muted/40 p-1"
        >
            <div className="grid min-w-[30rem] grid-cols-3 gap-1">
                {items.map((item) => {
                    const isActive = item.id === active;

                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                isActive
                                    ? 'border bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                            )}
                        >
                            <CalendarDays
                                className="size-4"
                                aria-hidden="true"
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

/**
 * Renders the shared Reports page heading, export action, and sub-navigation.
 */
export function ReportShell({
    active,
    links,
    periodLabel,
    exportHref,
    children,
}: {
    active: ReportView;
    links: ReportNavigationLinks;
    periodLabel: string;
    exportHref: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-5 p-4 md:p-6">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Reports
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sales and operational performance for your photobooth
                    </p>

                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-info-subtle px-3 py-1.5 text-xs font-medium text-info">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {periodLabel}
                    </div>
                </div>

                <Button asChild variant="outline" className="self-start">
                    <a href={exportHref}>
                        <Download className="size-4" aria-hidden="true" />
                        Export CSV
                    </a>
                </Button>
            </header>

            <ReportNavigation active={active} links={links} />

            {children}
        </div>
    );
}

/**
 * Provides the shared bordered surface used for report filter controls.
 */
export function ReportFilterPanel({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-xl border bg-card px-4 py-4 shadow-none">
            {children}
        </div>
    );
}

/**
 * Renders one dominant report KPI using the existing semantic design tokens.
 */
export function ReportMetricCard({
    label,
    value,
    icon: Icon,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    icon: LucideIcon;
    tone?: MetricTone;
}) {
    return (
        <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <CardContent className="flex min-h-32 items-center gap-4 px-5 py-5">
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
                    <strong className="mt-1 block truncate text-3xl font-semibold tracking-tight tabular-nums">
                        {value}
                    </strong>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the repository-backed Maya and voucher payment composition.
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

    return (
        <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <CardContent className="px-5 py-5">
                <div>
                    <h2 className="font-semibold">Payment mix</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        How completed Maya and voucher sessions were paid
                    </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="size-2.5 rounded-full bg-info" />
                            Maya sessions
                        </div>

                        <div className="mt-2 flex items-baseline gap-2">
                            <strong className="text-2xl font-semibold tabular-nums">
                                {mayaSessions}
                            </strong>
                            <span className="text-sm font-semibold text-info tabular-nums">
                                {mayaShare.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="border-border sm:border-l sm:pl-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="size-2.5 rounded-full bg-chart-4" />
                            Voucher sessions
                        </div>

                        <div className="mt-2 flex items-baseline gap-2">
                            <strong className="text-2xl font-semibold tabular-nums">
                                {voucherSessions}
                            </strong>
                            <span className="text-sm font-semibold text-warning tabular-nums">
                                {voucherShare.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Payment mix: ${mayaSessions} Maya sessions and ${voucherSessions} voucher sessions`}
                >
                    {total > 0 && (
                        <>
                            <span
                                className="bg-info"
                                style={{ width: `${mayaShare}%` }}
                            />
                            <span
                                className="bg-chart-4"
                                style={{ width: `${voucherShare}%` }}
                            />
                        </>
                    )}
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                    {total > 0
                        ? `${total} tracked payment sessions in this mix`
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
        <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <CardContent className="px-5 py-5">
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
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

                    <div className="border-border sm:border-l sm:pl-5">
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
                        'mt-6 rounded-xl border px-4 py-3 text-sm',
                        hasIssues
                            ? 'border-warning/25 bg-warning-subtle text-warning-foreground'
                            : 'border-success/25 bg-success-subtle text-success',
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
        <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <CardContent className="px-5 py-5">
                <div>
                    <h2 className="font-semibold">Operational health</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Payment and printing failures that need operator review
                    </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
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

                    <div className="border-border sm:border-l sm:pl-5">
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
                        'mt-6 rounded-xl border px-4 py-3 text-sm',
                        hasIssues
                            ? 'border-warning/25 bg-warning-subtle text-warning-foreground'
                            : 'border-success/25 bg-success-subtle text-success',
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
