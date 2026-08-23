import { Head, Link, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowRight,
    CircleCheck,
    Clock3,
    CreditCard,
    Images,
    Monitor,
    Play,
    Printer,
    Settings,
    Ticket,
    TriangleAlert,
    Users,
} from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { kiosk } from '@/routes';
import { dashboard } from '@/routes/admin';
import { index as paymentsIndex } from '@/routes/admin/payments';
import { index as sessionsIndex } from '@/routes/admin/sessions';
import { edit as settingsEdit } from '@/routes/admin/settings';
import { index as templatesIndex } from '@/routes/admin/templates';
import {
    create as voucherCreate,
    index as vouchersIndex,
} from '@/routes/admin/vouchers';

type SessionStats = {
    count: number;
    salesTotal: string;
};

type Comparison = {
    todaySalesVsYesterday: number | null;
    todaySessionsVsYesterday: number | null;
    monthSalesVsPreviousPeriod: number | null;
};

type NeedsAttention = {
    failedPayments: number;
    pendingPayments: number;
    failedPrintJobs: number;
    total: number;
};

type Summary = {
    today: SessionStats;
    thisMonth: SessionStats;
    comparison: Comparison;
    needsAttention: NeedsAttention;
};

type TrendPoint = {
    date: string;
    label: string;
    sales: number;
    sessions: number;
};

type PaymentMethods = {
    total: number;
    maya: number;
    voucher: number;
};

type Operations = {
    maintenanceMode: boolean;
    pendingPrintJobs: number;
    printingJobs: number;
    failedPrintJobs: number;
    galleryExpirationHours: number;
};

type ActivityType =
    | 'session_completed'
    | 'payment_success'
    | 'payment_pending'
    | 'payment_failed'
    | 'voucher'
    | 'print_failure';

type ActivityEntry = {
    type: ActivityType;
    title: string;
    description: string;
    occurredAt: string | null;
};

type DashboardProps = {
    currency: string;
    summary: Summary;
    trend: TrendPoint[];
    paymentMethods: PaymentMethods;
    operations: Operations;
    recentActivity: ActivityEntry[];
};

type Tone = 'success' | 'warning' | 'info' | 'danger';

type NextAction = {
    icon: LucideIcon;
    title: string;
    description: string;
    label: string;
    tone: Tone;
    href: string | null;
};

const trendChartConfig = {
    sales: {
        label: 'Sales',
        color: 'var(--foreground)',
    },
    sessions: {
        label: 'Completed Sessions',
        color: 'var(--info)',
    },
} satisfies ChartConfig;

const statusToneClasses: Record<Tone, string> = {
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning',
    info: 'bg-info-subtle text-info',
    danger: 'bg-destructive/10 text-destructive',
};

const badgeToneClasses: Record<Tone, string> = {
    success: 'border-success/20 bg-success-subtle text-success',
    warning: 'border-warning/20 bg-warning-subtle text-warning',
    info: 'border-info/20 bg-info-subtle text-info',
    danger: 'border-destructive/20 bg-destructive/10 text-destructive',
};

/**
 * Formats a numeric value using the configured ISO currency code.
 */
function formatCurrency(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `₱${value.toFixed(2)}`;
    }
}

/**
 * Formats currency compactly for the sales chart axis.
 */
function formatChartCurrency(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
            notation: 'compact',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `₱${Math.round(value)}`;
    }
}

/**
 * Converts an ISO timestamp to a compact relative timestamp.
 */
function formatRelativeTime(value: string | null): string {
    if (!value) {
        return '';
    }

    const elapsedMilliseconds = Math.max(
        0,
        Date.now() - new Date(value).getTime(),
    );

    const minutes = Math.floor(elapsedMilliseconds / 60_000);

    if (minutes < 1) {
        return 'Just now';
    }

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Formats a real percentage comparison without inventing a baseline.
 */
function ComparisonText({
    value,
    label,
}: {
    value: number | null;
    label: string;
}) {
    if (value === null) {
        return (
            <span className="text-xs text-muted-foreground">
                No prior-period comparison
            </span>
        );
    }

    const isPositive = value >= 0;

    return (
        <div className="flex items-center gap-1 text-xs">
            <ArrowRight
                className={cn(
                    'size-3.5',
                    isPositive
                        ? '-rotate-45 text-success'
                        : 'rotate-45 text-destructive',
                )}
                aria-hidden="true"
            />
            <span
                className={cn(
                    'font-semibold tabular-nums',
                    isPositive ? 'text-success' : 'text-destructive',
                )}
            >
                {Math.abs(value)}%
            </span>
            <span className="text-muted-foreground">{label}</span>
        </div>
    );
}

/**
 * Renders one dashboard KPI card using the visual hierarchy from the reference.
 */
function MetricCard({
    label,
    value,
    comparison,
    comparisonLabel,
    icon: Icon,
}: {
    label: string;
    value: string;
    comparison: number | null;
    comparisonLabel: string;
    icon: LucideIcon;
}) {
    return (
        <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <CardContent className="px-5 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="size-4.5" aria-hidden="true" />
                    </div>

                    <span className="text-sm font-medium">{label}</span>
                </div>

                <div className="mt-5">
                    <strong className="block text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl">
                        {value}
                    </strong>

                    <div className="mt-3">
                        <ComparisonText
                            value={comparison}
                            label={comparisonLabel}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Builds a compact human-readable issue summary for the attention card.
 */
function issueSummary(attention: NeedsAttention): string {
    const parts: string[] = [];

    if (attention.pendingPayments > 0) {
        parts.push(
            `${attention.pendingPayments} pending payment${
                attention.pendingPayments === 1 ? '' : 's'
            }`,
        );
    }

    if (attention.failedPayments > 0) {
        parts.push(
            `${attention.failedPayments} failed payment${
                attention.failedPayments === 1 ? '' : 's'
            }`,
        );
    }

    if (attention.failedPrintJobs > 0) {
        parts.push(
            `${attention.failedPrintJobs} failed print job${
                attention.failedPrintJobs === 1 ? '' : 's'
            }`,
        );
    }

    return parts.join(', ');
}

/**
 * Renders the payment and printing issue summary.
 */
function AttentionCard({ attention }: { attention: NeedsAttention }) {
    const hasIssues = attention.total > 0;

    return (
        <Card
            className={cn(
                'gap-0 rounded-2xl py-0 shadow-none',
                hasIssues
                    ? 'border-destructive/35 bg-destructive/[0.02]'
                    : 'border-success/25',
            )}
        >
            <CardContent className="px-5 py-5">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full',
                            hasIssues
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-success-subtle text-success',
                        )}
                    >
                        {hasIssues ? (
                            <TriangleAlert
                                className="size-5"
                                aria-hidden="true"
                            />
                        ) : (
                            <CircleCheck
                                className="size-5"
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <span
                        className={cn(
                            'text-sm font-semibold',
                            hasIssues && 'text-destructive',
                        )}
                    >
                        Needs Attention
                    </span>
                </div>

                <strong
                    className={cn(
                        'mt-5 block text-3xl font-semibold tabular-nums lg:text-4xl',
                        hasIssues && 'text-destructive',
                    )}
                >
                    {attention.total}
                </strong>

                <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {hasIssues
                        ? issueSummary(attention)
                        : 'No payment or printing issues require review.'}
                </p>
            </CardContent>
        </Card>
    );
}

/**
 * Renders one operational status row.
 */
function StatusRow({
    icon: Icon,
    title,
    description,
    label,
    tone,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    label: string;
    tone: Tone;
}) {
    return (
        <div className="flex min-h-14 items-center gap-3 border-b py-2.5 last:border-b-0">
            <div className="flex size-8 shrink-0 items-center justify-center">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {description}
                </p>
            </div>

            <Badge
                variant="outline"
                className={cn('shrink-0', badgeToneClasses[tone])}
            >
                {label}
            </Badge>
        </div>
    );
}

/**
 * Selects the highest-priority truthful operator action.
 */
function resolveNextAction(
    attention: NeedsAttention,
    operations: Operations,
): NextAction {
    if (attention.failedPrintJobs > 0) {
        return {
            icon: Printer,
            title: 'Next Action',
            description: 'Review the failed print job',
            label: 'View issue',
            tone: 'danger',
            href: sessionsIndex.url({
                query: { print_status: 'failed' },
            }),
        };
    }

    if (attention.failedPayments > 0) {
        return {
            icon: CreditCard,
            title: 'Next Action',
            description: 'Review the failed payment',
            label: 'View issue',
            tone: 'danger',
            href: paymentsIndex.url({
                query: { status: 'failed' },
            }),
        };
    }

    if (attention.pendingPayments > 0) {
        return {
            icon: Clock3,
            title: 'Next Action',
            description: 'Review pending payments',
            label: 'Review',
            tone: 'warning',
            href: paymentsIndex.url({
                query: { status: 'pending' },
            }),
        };
    }

    if (operations.maintenanceMode) {
        return {
            icon: Settings,
            title: 'Next Action',
            description: 'Kiosk is currently in maintenance mode',
            label: 'Settings',
            tone: 'warning',
            href: settingsEdit.url(),
        };
    }

    return {
        icon: CircleCheck,
        title: 'Next Action',
        description: 'No operator action is required',
        label: 'Clear',
        tone: 'success',
        href: null,
    };
}

/**
 * Renders the deterministic next operator action.
 */
function NextActionRow({ action }: { action: NextAction }) {
    const Icon = action.icon;

    return (
        <div className="flex min-h-14 items-center gap-3 py-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{action.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {action.description}
                </p>
            </div>

            {action.href ? (
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'h-7 shrink-0 px-2 text-xs',
                        statusToneClasses[action.tone],
                    )}
                >
                    <Link href={action.href}>{action.label}</Link>
                </Button>
            ) : (
                <Badge
                    variant="outline"
                    className={badgeToneClasses[action.tone]}
                >
                    {action.label}
                </Badge>
            )}
        </div>
    );
}

/**
 * Maps activity types to semantic icons and colors.
 */
function activityPresentation(type: ActivityType): {
    icon: LucideIcon;
    tone: Tone;
} {
    switch (type) {
        case 'session_completed':
            return { icon: CircleCheck, tone: 'success' };
        case 'payment_success':
            return { icon: CreditCard, tone: 'success' };
        case 'payment_pending':
            return { icon: Clock3, tone: 'warning' };
        case 'payment_failed':
            return { icon: TriangleAlert, tone: 'danger' };
        case 'voucher':
            return { icon: Ticket, tone: 'success' };
        case 'print_failure':
            return { icon: TriangleAlert, tone: 'warning' };
    }
}

/**
 * Resolves activity entries to existing real administration screens.
 */
function activityDestination(type: ActivityType): string {
    switch (type) {
        case 'session_completed':
            return sessionsIndex.url();
        case 'payment_success':
            return paymentsIndex.url({
                query: { status: 'success' },
            });
        case 'payment_pending':
            return paymentsIndex.url({
                query: { status: 'pending' },
            });
        case 'payment_failed':
            return paymentsIndex.url({
                query: { status: 'failed' },
            });
        case 'voucher':
            return vouchersIndex.url();
        case 'print_failure':
            return sessionsIndex.url({
                query: { print_status: 'failed' },
            });
    }
}

/**
 * Returns contextual action copy for each activity type.
 */
function activityActionLabel(type: ActivityType): string {
    switch (type) {
        case 'session_completed':
            return 'View session';
        case 'payment_success':
        case 'payment_pending':
        case 'payment_failed':
            return 'Open payment';
        case 'voucher':
            return 'View vouchers';
        case 'print_failure':
            return 'See issue';
    }
}

/**
 * Renders one compact recent activity row.
 */
function ActivityItem({ entry }: { entry: ActivityEntry }) {
    const presentation = activityPresentation(entry.type);
    const Icon = presentation.icon;

    return (
        <li className="border-b last:border-b-0">
            <Link
                href={activityDestination(entry.type)}
                className="group flex min-h-12 items-center gap-3 py-2.5"
            >
                <Icon
                    className={cn(
                        'size-4 shrink-0',
                        presentation.tone === 'success' && 'text-success',
                        presentation.tone === 'warning' && 'text-warning',
                        presentation.tone === 'danger' && 'text-destructive',
                        presentation.tone === 'info' && 'text-info',
                    )}
                    aria-hidden
                />

                <p className="min-w-0 flex-1 truncate text-xs">
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-muted-foreground">
                        {' '}
                        · {entry.description}
                    </span>
                </p>

                <span className="hidden shrink-0 text-xs text-muted-foreground md:block">
                    {formatRelativeTime(entry.occurredAt)}
                </span>

                <span className="hidden shrink-0 text-xs font-medium text-info xl:block">
                    {activityActionLabel(entry.type)}
                </span>

                <ArrowRight
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                />
            </Link>
        </li>
    );
}

/**
 * Renders today's Maya and voucher session distribution.
 */
function SessionMix({ paymentMethods }: { paymentMethods: PaymentMethods }) {
    const mayaPercentage =
        paymentMethods.total > 0
            ? Math.round((paymentMethods.maya / paymentMethods.total) * 100)
            : 0;

    const voucherPercentage =
        paymentMethods.total > 0 ? 100 - mayaPercentage : 0;

    return (
        <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle>
                    <h2 className="text-sm font-semibold">Session Mix Today</h2>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Completed sessions by payment type
                </p>
            </CardHeader>

            <CardContent className="px-5 pt-5 pb-5">
                {paymentMethods.total === 0 ? (
                    <div className="flex h-14 items-center justify-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
                        No completed sessions today.
                    </div>
                ) : (
                    <div
                        role="img"
                        aria-label={`Session mix today: ${paymentMethods.maya} Maya sessions, ${paymentMethods.voucher} voucher sessions`}
                        className="flex h-9 overflow-hidden rounded-md"
                    >
                        {paymentMethods.maya > 0 && (
                            <div
                                className="flex items-center justify-center bg-success px-2 text-xs font-semibold text-white"
                                style={{ width: `${mayaPercentage}%` }}
                            >
                                {mayaPercentage >= 15
                                    ? `${paymentMethods.maya} (${mayaPercentage}%)`
                                    : null}
                            </div>
                        )}

                        {paymentMethods.voucher > 0 && (
                            <div
                                className="flex items-center justify-center bg-info px-2 text-xs font-semibold text-white"
                                style={{ width: `${voucherPercentage}%` }}
                            >
                                {voucherPercentage >= 15
                                    ? `${paymentMethods.voucher} (${voucherPercentage}%)`
                                    : null}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap gap-5">
                        <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full bg-success" />
                            Maya: {paymentMethods.maya} sessions
                        </span>

                        <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full bg-info" />
                            Voucher: {paymentMethods.voucher} sessions
                        </span>
                    </div>

                    <span className="text-muted-foreground">
                        Total: {paymentMethods.total} sessions
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the ThermaSnap administration dashboard.
 */
export default function Dashboard({
    currency,
    summary,
    trend,
    paymentMethods,
    operations,
    recentActivity,
}: DashboardProps) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
    });

    const queuedPrintJobs =
        operations.pendingPrintJobs + operations.printingJobs;

    const reviewIssuesUrl =
        summary.needsAttention.failedPrintJobs > 0
            ? sessionsIndex.url({
                  query: { print_status: 'failed' },
              })
            : summary.needsAttention.failedPayments > 0
              ? paymentsIndex.url({
                    query: { status: 'failed' },
                })
              : summary.needsAttention.pendingPayments > 0
                ? paymentsIndex.url({
                      query: { status: 'pending' },
                  })
                : sessionsIndex.url();

    const printerTone: Tone =
        operations.failedPrintJobs > 0
            ? 'danger'
            : queuedPrintJobs > 0
              ? 'warning'
              : 'success';

    const printerLabel =
        operations.failedPrintJobs > 0
            ? 'Needs attention'
            : queuedPrintJobs > 0
              ? 'Processing'
              : 'Ready';

    const printerDescription =
        operations.failedPrintJobs > 0
            ? `${operations.failedPrintJobs} failed print job${
                  operations.failedPrintJobs === 1 ? '' : 's'
              }`
            : queuedPrintJobs > 0
              ? `${queuedPrintJobs} print job${
                    queuedPrintJobs === 1 ? '' : 's'
                } queued or processing`
              : 'Printer queue is clear';

    const nextAction = resolveNextAction(summary.needsAttention, operations);

    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-4 p-4 lg:gap-5 lg:p-6">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Your booth performance at a glance
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild>
                            <a
                                href={kiosk.url()}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Play className="fill-current" aria-hidden />
                                Open Kiosk
                            </a>
                        </Button>

                        <Button asChild variant="outline">
                            <Link href={voucherCreate.url()}>
                                <Ticket aria-hidden />
                                Create Voucher
                            </Link>
                        </Button>

                        <Button asChild variant="outline">
                            <Link href={templatesIndex.url()}>
                                <Images aria-hidden />
                                Manage Templates
                            </Link>
                        </Button>

                        <Button asChild variant="outline">
                            <Link href={reviewIssuesUrl}>
                                <TriangleAlert aria-hidden />
                                View Issues
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    <MetricCard
                        label="Today's Sales"
                        value={formatCurrency(
                            Number(summary.today.salesTotal),
                            currency,
                        )}
                        comparison={summary.comparison.todaySalesVsYesterday}
                        comparisonLabel="vs yesterday"
                        icon={Ticket}
                    />

                    <MetricCard
                        label="Completed Sessions Today"
                        value={String(summary.today.count)}
                        comparison={summary.comparison.todaySessionsVsYesterday}
                        comparisonLabel="vs yesterday"
                        icon={Users}
                    />

                    <MetricCard
                        label="Monthly Sales"
                        value={formatCurrency(
                            Number(summary.thisMonth.salesTotal),
                            currency,
                        )}
                        comparison={
                            summary.comparison.monthSalesVsPreviousPeriod
                        }
                        comparisonLabel="vs previous month to date"
                        icon={CreditCard}
                    />

                    <AttentionCard attention={summary.needsAttention} />
                </div>

                <div className="grid gap-4 xl:grid-cols-12">
                    <div className="grid min-w-0 gap-4 xl:col-span-8">
                        <Card className="gap-0 rounded-2xl py-0 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between gap-4 px-5 pt-5 pb-0">
                                <CardTitle>
                                    <h2 className="text-sm font-semibold">
                                        Sales and Completed Sessions, Last 7
                                        Days
                                    </h2>
                                </CardTitle>

                                <Badge variant="outline" className="shrink-0">
                                    Last 7 days
                                </Badge>
                            </CardHeader>

                            <CardContent className="px-3 pt-5 pb-4 sm:px-5">
                                <div className="mb-4 flex flex-wrap justify-end gap-4 text-xs">
                                    <span className="flex items-center gap-2">
                                        <span className="size-2.5 rounded-sm bg-foreground" />
                                        Sales
                                    </span>

                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <span className="h-0.5 w-4 bg-info" />
                                        Completed Sessions
                                    </span>
                                </div>

                                {trend.length === 0 ? (
                                    <div className="flex h-[290px] items-center justify-center text-sm text-muted-foreground">
                                        No trend data yet.
                                    </div>
                                ) : (
                                    <ChartContainer
                                        config={trendChartConfig}
                                        className="h-[290px] min-h-[290px]"
                                    >
                                        <ComposedChart
                                            accessibilityLayer
                                            data={trend}
                                            margin={{
                                                top: 12,
                                                right: 4,
                                                left: 4,
                                                bottom: 0,
                                            }}
                                        >
                                            <CartesianGrid vertical={false} />

                                            <XAxis
                                                dataKey="label"
                                                axisLine={false}
                                                tickLine={false}
                                                tickMargin={10}
                                            />

                                            <YAxis
                                                yAxisId="sales"
                                                axisLine={false}
                                                tickLine={false}
                                                tickMargin={8}
                                                width={64}
                                                tickFormatter={(value) =>
                                                    formatChartCurrency(
                                                        Number(value),
                                                        currency,
                                                    )
                                                }
                                            />

                                            <YAxis
                                                yAxisId="sessions"
                                                orientation="right"
                                                axisLine={false}
                                                tickLine={false}
                                                tickMargin={8}
                                                width={28}
                                                allowDecimals={false}
                                            />

                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(
                                                            value,
                                                            name,
                                                        ) =>
                                                            name === 'sales'
                                                                ? formatCurrency(
                                                                      Number(
                                                                          value,
                                                                      ),
                                                                      currency,
                                                                  )
                                                                : `${Number(
                                                                      value,
                                                                  )} sessions`
                                                        }
                                                    />
                                                }
                                            />

                                            <Bar
                                                yAxisId="sales"
                                                dataKey="sales"
                                                fill="var(--color-sales)"
                                                radius={[4, 4, 0, 0]}
                                                maxBarSize={34}
                                                isAnimationActive={false}
                                            />

                                            <Line
                                                yAxisId="sessions"
                                                type="monotone"
                                                dataKey="sessions"
                                                stroke="var(--color-sessions)"
                                                strokeWidth={2.5}
                                                dot={{
                                                    r: 4,
                                                    fill: 'var(--background)',
                                                    strokeWidth: 2,
                                                }}
                                                activeDot={{ r: 5 }}
                                                isAnimationActive={false}
                                            />
                                        </ComposedChart>
                                    </ChartContainer>
                                )}
                            </CardContent>
                        </Card>

                        <SessionMix paymentMethods={paymentMethods} />
                    </div>

                    <div className="grid content-start gap-4 xl:col-span-4">
                        <Card className="gap-0 rounded-2xl py-0 shadow-none">
                            <CardHeader className="px-5 pt-5 pb-1">
                                <CardTitle>
                                    <h2 className="text-sm font-semibold">
                                        Booth Status / Operations
                                    </h2>
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="px-5 pb-3">
                                <StatusRow
                                    icon={Monitor}
                                    title="Kiosk"
                                    description={
                                        operations.maintenanceMode
                                            ? 'New customer sessions are paused'
                                            : 'The kiosk is available for use'
                                    }
                                    label={
                                        operations.maintenanceMode
                                            ? 'Closed'
                                            : 'Open'
                                    }
                                    tone={
                                        operations.maintenanceMode
                                            ? 'warning'
                                            : 'success'
                                    }
                                />

                                <StatusRow
                                    icon={Settings}
                                    title="Maintenance Mode"
                                    description={
                                        operations.maintenanceMode
                                            ? 'Maintenance restrictions active'
                                            : 'Regular operation'
                                    }
                                    label={
                                        operations.maintenanceMode
                                            ? 'On'
                                            : 'Off'
                                    }
                                    tone={
                                        operations.maintenanceMode
                                            ? 'warning'
                                            : 'success'
                                    }
                                />

                                <StatusRow
                                    icon={Printer}
                                    title="Printer"
                                    description={printerDescription}
                                    label={printerLabel}
                                    tone={printerTone}
                                />

                                <NextActionRow action={nextAction} />
                            </CardContent>
                        </Card>

                        <Card className="gap-0 rounded-2xl py-0 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-1">
                                <CardTitle>
                                    <h2 className="text-sm font-semibold">
                                        Recent Activity
                                    </h2>
                                </CardTitle>

                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                >
                                    <Link href={sessionsIndex.url()}>
                                        View sessions
                                        <ArrowRight aria-hidden />
                                    </Link>
                                </Button>
                            </CardHeader>

                            <CardContent className="px-5 pb-3">
                                {recentActivity.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No recent activity yet.
                                    </div>
                                ) : (
                                    <ul>
                                        {recentActivity.map((entry, index) => (
                                            <ActivityItem
                                                key={`${entry.type}-${entry.occurredAt ?? index}`}
                                                entry={entry}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
