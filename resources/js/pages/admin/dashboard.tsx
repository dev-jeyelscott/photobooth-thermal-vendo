import { Head, Link, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowRight,
    BarChart3,
    CircleCheck,
    Clock3,
    CreditCard,
    ExternalLink,
    Images,
    Monitor,
    Printer,
    Ticket,
    TriangleAlert,
    Users,
} from 'lucide-react';
import {
    CartesianGrid,
    Line,
    LineChart,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { kiosk } from '@/routes';
import { dashboard } from '@/routes/admin';
import { index as paymentsIndex } from '@/routes/admin/payments';
import { index as sessionsIndex } from '@/routes/admin/sessions';
import { index as templatesIndex } from '@/routes/admin/templates';
import {
    create as voucherCreate,
    index as vouchersIndex,
} from '@/routes/admin/vouchers';

type SessionStats = {
    count: number;
    salesTotal: string;
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

const trendChartConfig = {
    sales: {
        label: 'Sales',
        color: 'var(--chart-1)',
    },
    sessions: {
        label: 'Sessions',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

const paymentChartConfig = {
    maya: {
        label: 'Maya',
        color: 'var(--chart-1)',
    },
    voucher: {
        label: 'Voucher',
        color: 'var(--chart-2)',
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
 * Formats a numeric value using the dashboard's configured ISO currency code.
 */
function formatCurrency(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `₱${value.toFixed(2)}`;
    }
}

/**
 * Formats currency compactly for the chart's vertical axis.
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
 * Converts an ISO timestamp to an operator-friendly relative timestamp.
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
 * Renders one primary dashboard KPI using the shared card treatment.
 */
function MetricCard({
    label,
    value,
    hint,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: 'info' | 'success' | 'chart';
}) {
    const iconClassName = {
        info: 'bg-info-subtle text-info',
        success: 'bg-success-subtle text-success',
        chart: 'bg-chart-3/10 text-chart-3',
    }[tone];

    return (
        <Card className="gap-4 py-5">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="mt-2 text-3xl tabular-nums">
                        {value}
                    </CardTitle>
                </div>

                <div
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-full',
                        iconClassName,
                    )}
                >
                    <Icon className="size-5" aria-hidden="true" />
                </div>
            </CardHeader>

            <CardContent>
                <p className="text-sm text-muted-foreground">{hint}</p>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the consolidated payment and printing issue summary.
 */
function AttentionCard({
    attention,
    reviewHref,
}: {
    attention: NeedsAttention;
    reviewHref: string;
}) {
    const hasIssues = attention.total > 0;

    return (
        <Card
            className={cn(
                'gap-4 py-5',
                hasIssues
                    ? 'border-destructive/25 bg-destructive/5'
                    : 'border-success/20 bg-success-subtle/30',
            )}
        >
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardDescription>Needs Attention</CardDescription>
                    <CardTitle className="mt-2 text-3xl tabular-nums">
                        {hasIssues ? `${attention.total} items` : 'All clear'}
                    </CardTitle>
                </div>

                <div
                    className={cn(
                        'flex size-11 items-center justify-center rounded-full',
                        hasIssues
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-success-subtle text-success',
                    )}
                >
                    {hasIssues ? (
                        <TriangleAlert className="size-5" aria-hidden="true" />
                    ) : (
                        <CircleCheck className="size-5" aria-hidden="true" />
                    )}
                </div>
            </CardHeader>

            <CardContent className="grid gap-4">
                {hasIssues ? (
                    <>
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Failed payments
                                </span>
                                <strong className="tabular-nums">
                                    {attention.failedPayments}
                                </strong>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Pending payments
                                </span>
                                <strong className="tabular-nums">
                                    {attention.pendingPayments}
                                </strong>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Failed print jobs
                                </span>
                                <strong className="tabular-nums">
                                    {attention.failedPrintJobs}
                                </strong>
                            </div>
                        </div>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-fit border-destructive/20 text-destructive hover:bg-destructive/10"
                        >
                            <Link href={reviewHref}>
                                Review issues
                                <ArrowRight aria-hidden="true" />
                            </Link>
                        </Button>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No payment or printing issues currently need review.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Renders one plain-language booth operational status row.
 */
function StatusRow({
    icon: Icon,
    label,
    description,
    badge,
    tone,
}: {
    icon: LucideIcon;
    label: string;
    description: string;
    badge: string;
    tone: Tone;
}) {
    return (
        <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <div
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    statusToneClasses[tone],
                )}
            >
                <Icon className="size-4" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {description}
                </p>
            </div>

            <Badge variant="outline" className={badgeToneClasses[tone]}>
                {badge}
            </Badge>
        </div>
    );
}

/**
 * Renders a large navigational action tile for frequent operator tasks.
 */
function QuickActionCard({
    href,
    title,
    description,
    icon: Icon,
    tone,
    external = false,
}: {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
    tone: Tone | 'chart';
    external?: boolean;
}) {
    const iconClassName =
        tone === 'chart'
            ? 'bg-chart-3/10 text-chart-3'
            : statusToneClasses[tone];

    const className =
        'group flex min-h-36 flex-col rounded-xl border p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

    const content = (
        <>
            <div
                className={cn(
                    'mb-5 flex size-10 items-center justify-center rounded-lg',
                    iconClassName,
                )}
            >
                <Icon className="size-5" aria-hidden="true" />
            </div>

            <div className="mt-auto">
                <p className="font-medium">{title}</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                    <ArrowRight
                        className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                    />
                </div>
            </div>
        </>
    );

    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={className}
            >
                {content}
            </a>
        );
    }

    return (
        <Link href={href} className={className}>
            {content}
        </Link>
    );
}

/**
 * Maps each activity type to its icon and semantic color.
 */
function activityPresentation(type: ActivityType): {
    icon: LucideIcon;
    tone: Tone;
} {
    switch (type) {
        case 'session_completed':
            return { icon: CircleCheck, tone: 'success' };
        case 'payment_success':
            return { icon: CreditCard, tone: 'info' };
        case 'payment_pending':
            return { icon: Clock3, tone: 'warning' };
        case 'payment_failed':
            return { icon: TriangleAlert, tone: 'danger' };
        case 'voucher':
            return { icon: Ticket, tone: 'success' };
        case 'print_failure':
            return { icon: Printer, tone: 'danger' };
    }
}

/**
 * Resolves an activity item to the closest existing admin management screen.
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
 * Renders one human-readable recent activity entry.
 */
function ActivityItem({ entry }: { entry: ActivityEntry }) {
    const presentation = activityPresentation(entry.type);
    const Icon = presentation.icon;

    return (
        <li>
            <Link
                href={activityDestination(entry.type)}
                className="group flex items-center gap-3 border-b py-3 last:border-b-0 hover:bg-accent/30"
            >
                <div
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        statusToneClasses[presentation.tone],
                    )}
                >
                    <Icon className="size-4" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {entry.description}
                    </p>
                </div>

                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {formatRelativeTime(entry.occurredAt)}
                </span>

                <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                />
            </Link>
        </li>
    );
}

/**
 * Renders the operator-focused ThermaSnap administration dashboard.
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

    const systemHealthy =
        !operations.maintenanceMode && summary.needsAttention.total === 0;

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

    const paymentMethodData = [
        {
            method: 'maya',
            value: paymentMethods.maya,
            fill: 'var(--color-maya)',
        },
        {
            method: 'voucher',
            value: paymentMethods.voucher,
            fill: 'var(--color-voucher)',
        },
    ];

    const mayaPercentage =
        paymentMethods.total > 0
            ? Math.round((paymentMethods.maya / paymentMethods.total) * 100)
            : 0;

    const voucherPercentage =
        paymentMethods.total > 0
            ? Math.round((paymentMethods.voucher / paymentMethods.total) * 100)
            : 0;

    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-6 p-4 lg:p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Overview of today's activity and booth status.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div
                            className={cn(
                                'flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium',
                                systemHealthy
                                    ? 'border-success/20 bg-success-subtle text-success'
                                    : 'border-warning/20 bg-warning-subtle text-warning',
                            )}
                        >
                            {systemHealthy ? (
                                <CircleCheck
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            ) : (
                                <TriangleAlert
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            )}
                            {systemHealthy
                                ? 'System healthy'
                                : `${summary.needsAttention.total} items need attention`}
                        </div>

                        <Badge
                            variant="outline"
                            className={
                                operations.maintenanceMode
                                    ? badgeToneClasses.warning
                                    : badgeToneClasses.success
                            }
                        >
                            Maintenance mode:{' '}
                            {operations.maintenanceMode ? 'On' : 'Off'}
                        </Badge>

                        <Button asChild variant="outline">
                            <a
                                href={kiosk.url()}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open Kiosk
                                <ExternalLink aria-hidden="true" />
                            </a>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Today's Sales"
                        value={formatCurrency(
                            Number(summary.today.salesTotal),
                            currency,
                        )}
                        hint="Successful online payments today"
                        icon={CreditCard}
                        tone="info"
                    />

                    <MetricCard
                        label="Completed Sessions Today"
                        value={String(summary.today.count)}
                        hint="Maya and voucher sessions"
                        icon={Users}
                        tone="success"
                    />

                    <MetricCard
                        label="Monthly Sales"
                        value={formatCurrency(
                            Number(summary.thisMonth.salesTotal),
                            currency,
                        )}
                        hint="Successful online payments this month"
                        icon={BarChart3}
                        tone="chart"
                    />

                    <AttentionCard
                        attention={summary.needsAttention}
                        reviewHref={reviewIssuesUrl}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-12">
                    <Card className="xl:col-span-6">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle>
                                    <h2>Sales & Sessions Trend</h2>
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Successful sales and completed sessions over
                                    the last seven days
                                </CardDescription>
                            </div>

                            <Badge variant="secondary">Last 7 days</Badge>
                        </CardHeader>

                        <CardContent>
                            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <span className="size-2.5 rounded-full bg-chart-1" />
                                    Sales
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="size-2.5 rounded-full bg-chart-2" />
                                    Completed sessions
                                </span>
                            </div>

                            {trend.length === 0 ? (
                                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                                    No trend data yet.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={trendChartConfig}
                                    className="h-[260px] min-h-[260px]"
                                >
                                    <LineChart
                                        accessibilityLayer
                                        data={trend}
                                        margin={{
                                            top: 8,
                                            right: 4,
                                            bottom: 0,
                                            left: 4,
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
                                            width={72}
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
                                                    formatter={(value, name) =>
                                                        name === 'sales'
                                                            ? formatCurrency(
                                                                  Number(value),
                                                                  currency,
                                                              )
                                                            : `${Number(
                                                                  value,
                                                              )} sessions`
                                                    }
                                                />
                                            }
                                        />

                                        <Line
                                            yAxisId="sales"
                                            type="monotone"
                                            dataKey="sales"
                                            stroke="var(--color-sales)"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            isAnimationActive={false}
                                        />

                                        <Line
                                            yAxisId="sessions"
                                            type="monotone"
                                            dataKey="sessions"
                                            stroke="var(--color-sessions)"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            isAnimationActive={false}
                                        />
                                    </LineChart>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="xl:col-span-3">
                        <CardHeader>
                            <CardTitle>
                                <h2>Payment Methods</h2>
                            </CardTitle>
                            <CardDescription>
                                Today's completed sessions
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="grid gap-5">
                            {paymentMethods.total > 0 ? (
                                <div className="relative mx-auto h-[180px] w-full max-w-[220px]">
                                    <ChartContainer
                                        config={paymentChartConfig}
                                        className="h-full min-h-[180px]"
                                    >
                                        <PieChart accessibilityLayer>
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        hideLabel
                                                        formatter={(value) =>
                                                            `${Number(
                                                                value,
                                                            )} sessions`
                                                        }
                                                    />
                                                }
                                            />
                                            <Pie
                                                data={paymentMethodData}
                                                dataKey="value"
                                                nameKey="method"
                                                innerRadius={52}
                                                outerRadius={76}
                                                strokeWidth={4}
                                                isAnimationActive={false}
                                            />
                                        </PieChart>
                                    </ChartContainer>

                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <strong className="text-2xl tabular-nums">
                                            {paymentMethods.total}
                                        </strong>
                                        <span className="text-xs text-muted-foreground">
                                            sessions
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-[180px] items-center justify-center text-center text-sm text-muted-foreground">
                                    No completed sessions today.
                                </div>
                            )}

                            <div className="grid gap-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2">
                                        <span className="size-2.5 rounded-full bg-chart-1" />
                                        Maya
                                    </span>
                                    <span className="text-muted-foreground tabular-nums">
                                        {paymentMethods.maya} ({mayaPercentage}
                                        %)
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2">
                                        <span className="size-2.5 rounded-full bg-chart-2" />
                                        Voucher
                                    </span>
                                    <span className="text-muted-foreground tabular-nums">
                                        {paymentMethods.voucher} (
                                        {voucherPercentage}%)
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="xl:col-span-3">
                        <CardHeader>
                            <CardTitle>
                                <h2>Booth Status</h2>
                            </CardTitle>
                            <CardDescription>
                                Current operational state
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <StatusRow
                                icon={Monitor}
                                label="Booth Availability"
                                description={
                                    operations.maintenanceMode
                                        ? 'New kiosk sessions are paused'
                                        : 'Ready for new customer sessions'
                                }
                                badge={
                                    operations.maintenanceMode
                                        ? 'Maintenance'
                                        : 'Online'
                                }
                                tone={
                                    operations.maintenanceMode
                                        ? 'warning'
                                        : 'success'
                                }
                            />

                            <StatusRow
                                icon={Printer}
                                label="Print Queue"
                                description={
                                    queuedPrintJobs > 0
                                        ? `${queuedPrintJobs} queued or printing`
                                        : 'No queued print jobs'
                                }
                                badge={
                                    queuedPrintJobs > 0
                                        ? String(queuedPrintJobs)
                                        : 'Clear'
                                }
                                tone={
                                    queuedPrintJobs > 0 ? 'warning' : 'success'
                                }
                            />

                            <StatusRow
                                icon={TriangleAlert}
                                label="Print Issues"
                                description={
                                    operations.failedPrintJobs > 0
                                        ? `${operations.failedPrintJobs} failed print job${
                                              operations.failedPrintJobs === 1
                                                  ? ''
                                                  : 's'
                                          }`
                                        : 'No failed print jobs'
                                }
                                badge={
                                    operations.failedPrintJobs > 0
                                        ? String(operations.failedPrintJobs)
                                        : 'Clear'
                                }
                                tone={
                                    operations.failedPrintJobs > 0
                                        ? 'danger'
                                        : 'success'
                                }
                            />

                            <StatusRow
                                icon={Images}
                                label="Gallery Retention"
                                description={`Customer media is retained for ${operations.galleryExpirationHours} hours`}
                                badge={`${operations.galleryExpirationHours}h`}
                                tone="info"
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-12">
                    <Card className="xl:col-span-7">
                        <CardHeader>
                            <CardTitle>
                                <h2>Recent Activity</h2>
                            </CardTitle>
                            <CardDescription>
                                Latest customer and operational events
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
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

                    <Card className="xl:col-span-5">
                        <CardHeader>
                            <CardTitle>
                                <h2>Quick Actions</h2>
                            </CardTitle>
                            <CardDescription>
                                Common operator tasks
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            <QuickActionCard
                                href={kiosk.url()}
                                title="Open Kiosk"
                                description="Launch the customer experience"
                                icon={Monitor}
                                tone="info"
                                external
                            />

                            <QuickActionCard
                                href={voucherCreate.url()}
                                title="Create Voucher"
                                description="Generate a customer voucher"
                                icon={Ticket}
                                tone="success"
                            />

                            <QuickActionCard
                                href={templatesIndex.url()}
                                title="Manage Templates"
                                description="Edit photo layouts and designs"
                                icon={Images}
                                tone="chart"
                            />

                            <QuickActionCard
                                href={reviewIssuesUrl}
                                title="View Issues"
                                description="Review payment or printing problems"
                                icon={TriangleAlert}
                                tone="danger"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
