import { Head, Link, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowRight,
    CalendarDays,
    CircleCheck,
    Clock3,
    CreditCard,
    Images,
    Play,
    Printer,
    Settings,
    Sticker,
    Ticket,
    TriangleAlert,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Area,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    Pie,
    PieChart,
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
import { index as stickersIndex } from '@/routes/admin/stickers';
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
    pendingPaymentTotal: string;
    failedPrintJobs: number;
    total: number;
};

type Summary = {
    today: SessionStats;
    thisMonth: SessionStats;
    comparison: Comparison;
    needsAttention: NeedsAttention;
};

type DashboardPeriod = {
    startDate: string;
    endDate: string;
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

type RecentSession = {
    reference: string;
    startedAt: string | null;
    paymentMethod: string | null;
    status: string;
    printStatus: string | null;
    amount: string | null;
    currency: string | null;
};

type ResourceSummary = {
    templates: {
        active: number;
        inactive: number;
    };
    stickers: {
        active: number;
        inactive: number;
    };
    vouchers: {
        available: number;
        remainingUses: number;
    };
};

type DashboardProps = {
    currency: string;
    period: DashboardPeriod;
    summary: Summary;
    trend: TrendPoint[];
    paymentMethods: PaymentMethods;
    operations: Operations;
    recentSessions: RecentSession[];
    resources: ResourceSummary;
};

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const trendChartConfig = {
    sales: {
        label: 'Sales',
        color: 'var(--chart-1)',
    },
    sessions: {
        label: 'Sessions',
        color: 'var(--muted-foreground)',
    },
} satisfies ChartConfig;

const paymentChartConfig = {
    maya: {
        label: 'Maya QR',
        color: 'var(--chart-1)',
    },
    voucher: {
        label: 'Voucher',
        color: 'var(--muted-foreground)',
    },
} satisfies ChartConfig;

const badgeToneClasses: Record<Tone, string> = {
    success: 'border-success/20 bg-success-subtle text-success-foreground',
    warning: 'border-warning/20 bg-warning-subtle text-warning-foreground',
    info: 'border-info/20 bg-info-subtle text-info-foreground',
    danger: 'border-destructive/20 bg-destructive/10 text-destructive',
    neutral: 'border-border bg-muted/60 text-muted-foreground',
};

const metricToneClasses: Record<Exclude<Tone, 'neutral'>, string> = {
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning',
    info: 'bg-info-subtle text-info',
    danger: 'bg-destructive/10 text-destructive',
};

/**
 * Formats a numeric value using the configured ISO currency code.
 */
function formatCurrency(
    value: number | string | null,
    currency: string,
): string {
    const numericValue = Number(value ?? 0);

    try {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(numericValue);
    } catch {
        return `₱${numericValue.toFixed(2)}`;
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
 * Formats the fixed seven-day dashboard range without creating an inert control.
 */
function formatDateRange(period: DashboardPeriod): string {
    const formatter = new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    const start = formatter.format(new Date(`${period.startDate}T00:00:00`));
    const end = formatter.format(new Date(`${period.endDate}T00:00:00`));

    return `${start} - ${end}`;
}

/**
 * Formats a session timestamp for compact table presentation.
 */
function formatDateTime(value: string | null): string {
    if (!value) {
        return 'Not started';
    }

    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

/**
 * Converts durable snake-case states into operator-friendly labels.
 */
function formatStatusLabel(value: string): string {
    return value
        .split('_')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ');
}

/**
 * Formats the stored authorization method without implying unsupported gateways.
 */
function formatPaymentMethod(value: string | null): string {
    if (value === 'maya') {
        return 'Maya QR';
    }

    if (value === 'voucher') {
        return 'Voucher';
    }

    return 'Not set';
}

/**
 * Resolves a durable session state to the closest canonical semantic tone.
 */
function sessionStatusTone(status: string): Tone {
    if (status === 'completed') {
        return 'success';
    }

    if (status === 'expired' || status === 'abandoned') {
        return 'danger';
    }

    if (status === 'payment_pending' || status === 'printing') {
        return 'warning';
    }

    if (
        status === 'paid' ||
        status === 'template_selected' ||
        status === 'capturing' ||
        status === 'customizing' ||
        status === 'processing'
    ) {
        return 'info';
    }

    return 'neutral';
}

/**
 * Resolves a durable print state to the closest canonical semantic tone.
 */
function printStatusTone(status: string | null): Tone {
    if (status === 'printed') {
        return 'success';
    }

    if (status === 'failed') {
        return 'danger';
    }

    if (status === 'pending') {
        return 'warning';
    }

    if (status === 'printing') {
        return 'info';
    }

    return 'neutral';
}

/**
 * Formats a real percentage comparison without inventing a prior baseline.
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
            <span className="text-caption text-muted-foreground">
                No prior-period comparison
            </span>
        );
    }

    const isPositive = value >= 0;

    return (
        <div className="flex items-center gap-1 text-caption">
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
 * Renders one reference-aligned KPI card using canonical semantic tones.
 */
function MetricCard({
    label,
    value,
    icon: Icon,
    tone,
    supporting,
}: {
    label: string;
    value: string;
    icon: LucideIcon;
    tone: Exclude<Tone, 'neutral'>;
    supporting: ReactNode;
}) {
    return (
        <Card className="gap-0 py-0 shadow-none">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-card-title">{label}</p>
                        <strong className="mt-2 block text-2xl font-semibold tracking-tight tabular-nums lg:text-3xl">
                            {value}
                        </strong>
                    </div>

                    <div
                        className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full',
                            metricToneClasses[tone],
                        )}
                    >
                        <Icon className="size-5" aria-hidden="true" />
                    </div>
                </div>

                <div className="mt-2 min-h-5">{supporting}</div>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the seven-day sales and sessions trend from real controller aggregates.
 */
function TrendCard({
    trend,
    currency,
}: {
    trend: TrendPoint[];
    currency: string;
}) {
    const hasTrendData = trend.some(
        (point) => point.sales > 0 || point.sessions > 0,
    );

    return (
        <Card className="h-full gap-0 py-0 shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pt-5 pb-0">
                <div>
                    <CardTitle>
                        <h2 className="text-card-title">
                            Sales &amp; Sessions Trend (7 Days)
                        </h2>
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap gap-4 text-caption text-muted-foreground">
                        <span className="flex items-center gap-2">
                            <span className="h-0.5 w-4 bg-chart-1" />
                            Sales
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="h-0.5 w-4 bg-muted-foreground" />
                            Sessions
                        </span>
                    </div>
                </div>

                <Badge variant="outline">Daily</Badge>
            </CardHeader>

            <CardContent className="px-3 pt-4 pb-4 sm:px-5">
                {!hasTrendData ? (
                    <div className="flex h-[280px] items-center justify-center text-body text-muted-foreground">
                        No completed session trend data yet.
                    </div>
                ) : (
                    <ChartContainer
                        config={trendChartConfig}
                        className="h-[280px] min-h-[280px] w-full"
                    >
                        <ComposedChart
                            accessibilityLayer
                            data={trend}
                            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tickMargin={10}
                                tickFormatter={(value) =>
                                    String(value).split(' ').slice(-2).join(' ')
                                }
                            />
                            <YAxis
                                yAxisId="sales"
                                axisLine={false}
                                tickLine={false}
                                tickMargin={8}
                                width={60}
                                tickFormatter={(value) =>
                                    formatChartCurrency(Number(value), currency)
                                }
                            />
                            <YAxis
                                yAxisId="sessions"
                                orientation="right"
                                axisLine={false}
                                tickLine={false}
                                tickMargin={8}
                                width={30}
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
                                                : `${Number(value)} sessions`
                                        }
                                    />
                                }
                            />
                            <Area
                                yAxisId="sales"
                                type="monotone"
                                dataKey="sales"
                                stroke="var(--color-sales)"
                                fill="var(--color-sales)"
                                fillOpacity={0.08}
                                strokeWidth={2.5}
                                dot={{
                                    r: 3.5,
                                    fill: 'var(--background)',
                                    strokeWidth: 2,
                                }}
                                activeDot={{ r: 5 }}
                                isAnimationActive={false}
                            />
                            <Line
                                yAxisId="sessions"
                                type="monotone"
                                dataKey="sessions"
                                stroke="var(--color-sessions)"
                                strokeWidth={2}
                                dot={{
                                    r: 3.5,
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
    );
}

/**
 * Renders a compact donut chart for today's Maya and voucher session mix.
 */
function PaymentBreakdownCard({
    paymentMethods,
}: {
    paymentMethods: PaymentMethods;
}) {
    const mayaPercentage =
        paymentMethods.total > 0
            ? Math.round((paymentMethods.maya / paymentMethods.total) * 100)
            : 0;
    const voucherPercentage =
        paymentMethods.total > 0 ? 100 - mayaPercentage : 0;

    const chartData = [
        {
            key: 'maya',
            name: 'Maya QR',
            value: paymentMethods.maya,
            color: 'var(--color-maya)',
        },
        {
            key: 'voucher',
            name: 'Voucher',
            value: paymentMethods.voucher,
            color: 'var(--color-voucher)',
        },
    ];

    return (
        <Card className="h-full gap-0 py-0 shadow-none">
            <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle>
                    <h2 className="text-card-title">
                        Payment Methods Breakdown
                    </h2>
                </CardTitle>
            </CardHeader>

            <CardContent className="px-5 pt-3 pb-5">
                {paymentMethods.total === 0 ? (
                    <div className="flex h-[220px] items-center justify-center text-center text-body text-muted-foreground">
                        No completed sessions today.
                    </div>
                ) : (
                    <>
                        <div
                            role="img"
                            aria-label={`Payment methods today: ${paymentMethods.maya} Maya sessions, ${paymentMethods.voucher} voucher sessions`}
                            className="relative mx-auto h-[180px] w-[180px]"
                        >
                            <ChartContainer
                                config={paymentChartConfig}
                                className="h-full w-full"
                            >
                                <PieChart accessibilityLayer>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={52}
                                        outerRadius={72}
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                    >
                                        {chartData.map((entry) => (
                                            <Cell
                                                key={entry.key}
                                                fill={entry.color}
                                            />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ChartContainer>

                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <strong className="text-2xl font-semibold tabular-nums">
                                    {paymentMethods.total}
                                </strong>
                                <span className="text-caption text-muted-foreground">
                                    Sessions
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2 border-t pt-3 text-caption">
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full bg-chart-1" />
                                <span className="flex-1">Maya QR</span>
                                <span className="font-medium tabular-nums">
                                    {paymentMethods.maya} ({mayaPercentage}%)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full bg-muted-foreground" />
                                <span className="flex-1">Voucher</span>
                                <span className="font-medium tabular-nums">
                                    {paymentMethods.voucher} (
                                    {voucherPercentage}%)
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Renders one linked operational issue inside the attention card.
 */
function AttentionRow({
    icon: Icon,
    title,
    description,
    count,
    tone,
    href,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    count?: number;
    tone: Exclude<Tone, 'neutral'>;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="group flex min-h-14 items-center gap-3 border-b py-2.5 last:border-b-0"
        >
            <div
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    metricToneClasses[tone],
                )}
            >
                <Icon className="size-4.5" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-body font-medium">{title}</p>
                <p className="truncate text-caption text-muted-foreground">
                    {description}
                </p>
            </div>

            {count !== undefined && (
                <span
                    className={cn(
                        'font-semibold tabular-nums',
                        tone === 'danger' && 'text-destructive',
                        tone === 'warning' && 'text-warning',
                        tone === 'info' && 'text-info',
                        tone === 'success' && 'text-success',
                    )}
                >
                    {count}
                </span>
            )}

            <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
            />
        </Link>
    );
}

/**
 * Renders the real payment, print, and maintenance conditions needing review.
 */
function NeedsAttentionCard({
    attention,
    operations,
    currency,
}: {
    attention: NeedsAttention;
    operations: Operations;
    currency: string;
}) {
    const hasIssues = attention.total > 0 || operations.maintenanceMode;

    const reviewIssuesUrl =
        attention.failedPrintJobs > 0
            ? sessionsIndex.url({ query: { print_status: 'failed' } })
            : attention.failedPayments > 0
              ? paymentsIndex.url({ query: { status: 'failed' } })
              : attention.pendingPayments > 0
                ? paymentsIndex.url({ query: { status: 'pending' } })
                : operations.maintenanceMode
                  ? settingsEdit.url()
                  : sessionsIndex.url();

    return (
        <Card className="h-full gap-0 py-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-4 px-5 pt-5 pb-1">
                <CardTitle>
                    <h2 className="text-card-title">Needs Attention</h2>
                </CardTitle>
                <Button asChild variant="outline" size="sm" className="h-8">
                    <Link href={reviewIssuesUrl}>View All</Link>
                </Button>
            </CardHeader>

            <CardContent className="px-5 pb-3">
                {!hasIssues ? (
                    <div className="flex min-h-[190px] flex-col items-center justify-center text-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
                            <CircleCheck
                                className="size-5"
                                aria-hidden="true"
                            />
                        </div>
                        <p className="mt-3 text-body font-medium">
                            No operator action required
                        </p>
                        <p className="mt-1 max-w-56 text-caption text-muted-foreground">
                            Payments, printing, and kiosk operations are clear.
                        </p>
                    </div>
                ) : (
                    <div>
                        {attention.pendingPayments > 0 && (
                            <AttentionRow
                                icon={Clock3}
                                title="Pending Payments"
                                description={`${formatCurrency(attention.pendingPaymentTotal, currency)} total`}
                                count={attention.pendingPayments}
                                tone="warning"
                                href={paymentsIndex.url({
                                    query: { status: 'pending' },
                                })}
                            />
                        )}

                        {attention.failedPayments > 0 && (
                            <AttentionRow
                                icon={CreditCard}
                                title="Failed Payments"
                                description="Payment attempts need review"
                                count={attention.failedPayments}
                                tone="danger"
                                href={paymentsIndex.url({
                                    query: { status: 'failed' },
                                })}
                            />
                        )}

                        {attention.failedPrintJobs > 0 && (
                            <AttentionRow
                                icon={Printer}
                                title="Failed Print Jobs"
                                description="Printing needs operator review"
                                count={attention.failedPrintJobs}
                                tone="danger"
                                href={sessionsIndex.url({
                                    query: { print_status: 'failed' },
                                })}
                            />
                        )}

                        {operations.maintenanceMode && (
                            <AttentionRow
                                icon={Settings}
                                title="Maintenance Mode"
                                description="New kiosk sessions are paused"
                                tone="warning"
                                href={settingsEdit.url()}
                            />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Renders a compact semantic state badge for session and print states.
 */
function StatusBadge({ value, tone }: { value: string; tone: Tone }) {
    return (
        <Badge
            variant="outline"
            className={cn('whitespace-nowrap', badgeToneClasses[tone])}
        >
            {formatStatusLabel(value)}
        </Badge>
    );
}

/**
 * Renders the latest sessions as a dense operator table without fake row links.
 */
function RecentSessionsCard({
    sessions,
    fallbackCurrency,
}: {
    sessions: RecentSession[];
    fallbackCurrency: string;
}) {
    return (
        <Card className="h-full gap-0 py-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b px-5 py-3">
                <CardTitle>
                    <h2 className="text-card-title">Recent Sessions</h2>
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-8">
                    <Link href={sessionsIndex.url()}>
                        View all sessions
                        <ArrowRight aria-hidden="true" />
                    </Link>
                </Button>
            </CardHeader>

            <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                    <table
                        className="w-full min-w-[760px] text-left text-caption"
                        aria-label="Recent sessions"
                    >
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2.5 font-medium">
                                    Session ID
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    Started At
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    Payment Method
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    Status
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    Print Status
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                    Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-10 text-center text-body text-muted-foreground"
                                    >
                                        No customer sessions yet.
                                    </td>
                                </tr>
                            ) : (
                                sessions.map((session) => (
                                    <tr
                                        key={session.reference}
                                        className="border-t first:border-t-0"
                                    >
                                        <td className="px-4 py-2.5 font-mono font-medium">
                                            {session.reference}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                                            {formatDateTime(session.startedAt)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                {session.paymentMethod ===
                                                'voucher' ? (
                                                    <Ticket
                                                        className="size-3.5 text-info"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <CreditCard
                                                        className="size-3.5 text-success"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {formatPaymentMethod(
                                                    session.paymentMethod,
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge
                                                value={session.status}
                                                tone={sessionStatusTone(
                                                    session.status,
                                                )}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {session.printStatus ? (
                                                <StatusBadge
                                                    value={session.printStatus}
                                                    tone={printStatusTone(
                                                        session.printStatus,
                                                    )}
                                                />
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        badgeToneClasses.neutral
                                                    }
                                                >
                                                    Not queued
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
                                            {formatCurrency(
                                                session.amount,
                                                session.currency ??
                                                    fallbackCurrency,
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
    );
}

/**
 * Renders one compact management summary card with a real destination route.
 */
function ResourceSummaryCard({
    icon: Icon,
    title,
    value,
    detail,
    href,
    action,
    tone,
}: {
    icon: LucideIcon;
    title: string;
    value: number;
    detail: string;
    href: string;
    action: string;
    tone: Exclude<Tone, 'neutral'>;
}) {
    return (
        <Card className="h-full gap-0 py-0 shadow-none">
            <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                    <p className="text-card-title">{title}</p>
                    <div
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-lg',
                            metricToneClasses[tone],
                        )}
                    >
                        <Icon className="size-4" aria-hidden="true" />
                    </div>
                </div>

                <strong className="mt-7 text-3xl font-semibold tracking-tight tabular-nums">
                    {value}
                </strong>
                <p className="mt-1 text-caption text-muted-foreground">
                    {detail}
                </p>

                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-6 w-full"
                >
                    <Link href={href}>{action}</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

/**
 * Renders the ThermaSnap administration dashboard.
 */
export default function Dashboard({
    currency,
    period,
    summary,
    trend,
    paymentMethods,
    operations,
    recentSessions,
    resources,
}: DashboardProps) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
    });

    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-section p-page lg:p-page-desktop">
                <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h1 className="text-page-title">Dashboard</h1>
                        <p className="mt-1 text-body text-muted-foreground">
                            Operator overview for ThermaSnap.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button asChild size="sm">
                                <a
                                    href={kiosk.url()}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <Play
                                        className="fill-current"
                                        aria-hidden
                                    />
                                    Open Kiosk
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href={voucherCreate.url()}>
                                    <Ticket aria-hidden="true" />
                                    Create Voucher
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:items-end">
                        <div
                            className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-body"
                            aria-label="Dashboard reporting period"
                        >
                            <CalendarDays
                                className="size-4 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <span>{formatDateRange(period)}</span>
                        </div>
                        <p className="text-caption text-muted-foreground">
                            Month to date:{' '}
                            <span className="font-medium text-foreground">
                                {formatCurrency(
                                    summary.thisMonth.salesTotal,
                                    currency,
                                )}
                            </span>{' '}
                            · {summary.thisMonth.count} completed sessions
                        </p>
                    </div>
                </header>

                <section
                    className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4"
                    aria-label="Dashboard key performance indicators"
                >
                    <MetricCard
                        label="Today's Sales"
                        value={formatCurrency(
                            summary.today.salesTotal,
                            currency,
                        )}
                        icon={CreditCard}
                        tone="info"
                        supporting={
                            <ComparisonText
                                value={summary.comparison.todaySalesVsYesterday}
                                label="vs yesterday"
                            />
                        }
                    />

                    <MetricCard
                        label="Sessions Today"
                        value={String(summary.today.count)}
                        icon={Users}
                        tone="success"
                        supporting={
                            <ComparisonText
                                value={
                                    summary.comparison.todaySessionsVsYesterday
                                }
                                label="vs yesterday"
                            />
                        }
                    />

                    <MetricCard
                        label="Pending Payments"
                        value={formatCurrency(
                            summary.needsAttention.pendingPaymentTotal,
                            currency,
                        )}
                        icon={Clock3}
                        tone="warning"
                        supporting={
                            <span className="text-caption text-muted-foreground">
                                {summary.needsAttention.pendingPayments}{' '}
                                transaction
                                {summary.needsAttention.pendingPayments === 1
                                    ? ''
                                    : 's'}
                            </span>
                        }
                    />

                    <MetricCard
                        label="Failed Print Jobs"
                        value={String(summary.needsAttention.failedPrintJobs)}
                        icon={Printer}
                        tone="danger"
                        supporting={
                            <span className="text-caption text-muted-foreground">
                                {summary.needsAttention.failedPrintJobs > 0
                                    ? 'Operator review required'
                                    : 'No failed print jobs'}
                            </span>
                        }
                    />
                </section>

                <section className="grid gap-4 xl:grid-cols-12">
                    <div className="min-w-0 xl:col-span-6">
                        <TrendCard trend={trend} currency={currency} />
                    </div>
                    <div className="min-w-0 md:max-xl:col-span-1 xl:col-span-3">
                        <PaymentBreakdownCard paymentMethods={paymentMethods} />
                    </div>
                    <div className="min-w-0 md:max-xl:col-span-1 xl:col-span-3">
                        <NeedsAttentionCard
                            attention={summary.needsAttention}
                            operations={operations}
                            currency={currency}
                        />
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-12">
                    <div className="min-w-0 xl:col-span-7">
                        <RecentSessionsCard
                            sessions={recentSessions}
                            fallbackCurrency={currency}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 xl:col-span-5">
                        <ResourceSummaryCard
                            icon={Images}
                            title="Active Templates"
                            value={resources.templates.active}
                            detail={`${resources.templates.inactive} inactive`}
                            href={templatesIndex.url()}
                            action="Manage Templates"
                            tone="info"
                        />
                        <ResourceSummaryCard
                            icon={Sticker}
                            title="Active Stickers"
                            value={resources.stickers.active}
                            detail={`${resources.stickers.inactive} inactive`}
                            href={stickersIndex.url()}
                            action="Manage Stickers"
                            tone="success"
                        />
                        <ResourceSummaryCard
                            icon={Ticket}
                            title="Available Vouchers"
                            value={resources.vouchers.available}
                            detail={`${resources.vouchers.remainingUses} uses remaining`}
                            href={vouchersIndex.url()}
                            action="Manage Vouchers"
                            tone="warning"
                        />
                    </div>
                </section>
            </div>
        </>
    );
}
