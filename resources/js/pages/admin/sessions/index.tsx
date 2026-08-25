import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Camera,
    CalendarDays,
    ChevronDown,
    CircleCheck,
    Clock3,
    CreditCard,
    Filter,
    LoaderCircle,
    LockKeyhole,
    Printer,
    Search,
    TimerOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { index as sessionsIndex } from '@/routes/admin/sessions';

export type Payment = {
    method: string;
    status: string;
    amount: string;
};

export type PrintJob = {
    status: string;
    attemptCount: number;
    completedAt: string | null;
};

export type Session = {
    id: number;
    sessionToken: string;
    status: string;
    startedAt: string | null;
    expiresAt: string | null;
    templateName: string | null;
    voucherCode: string | null;
    price: string | null;
    currency: string | null;
    paymentMethod: string | null;
    payment: Payment | null;
    printJob: PrintJob | null;
};

export type SessionSummary = {
    total: number;
    completed: number;
    inProgress: number;
    expiredOrAbandoned: number;
};

export type Paginated<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

export type Filters = {
    search: string | null;
    status: string | null;
    from: string | null;
    to: string | null;
    payment_status: string | null;
    payment_method: string | null;
    authorization_type: string | null;
    print_status: string | null;
};

type SessionStatusTone = 'success' | 'warning' | 'info' | 'neutral';

type SessionStatusPresentation = {
    label: string;
    className: string;
    icon?: LucideIcon;
};

type PrintStatusPresentation = {
    label: string;
    badgeClassName: string;
};

type SummaryTone = 'primary' | 'success' | 'warning' | 'destructive';

type FilterSelectProps = {
    label: string;
    name: string;
    value: string | null;
    options: string[];
    allLabel: string;
};

const sessionStatusToneClasses: Record<SessionStatusTone, string> = {
    success: 'border-success/20 bg-success-subtle text-success-foreground',
    warning: 'border-warning/20 bg-warning-subtle text-warning-foreground',
    info: 'border-info/20 bg-info-subtle text-info-foreground',
    neutral: 'border-border bg-muted text-muted-foreground',
};

const sessionStatusDefinitions: Record<
    string,
    { tone: SessionStatusTone; icon?: LucideIcon }
> = {
    new: { tone: 'neutral' },
    payment_pending: { tone: 'warning', icon: Clock3 },
    paid: { tone: 'success', icon: CreditCard },
    template_selected: { tone: 'info' },
    capturing: { tone: 'info', icon: Camera },
    customizing: { tone: 'info' },
    processing: { tone: 'info', icon: LoaderCircle },
    printing: { tone: 'info', icon: Printer },
    completed: { tone: 'success', icon: CircleCheck },
    expired: { tone: 'neutral', icon: Clock3 },
    abandoned: { tone: 'neutral' },
};

/**
 * Convert enum-style values into concise operator-facing labels without
 * changing the underlying values submitted to Laravel.
 */
export function formatEnumLabel(value: string): string {
    const normalized = value.replaceAll('_', ' ');

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Resolve the semantic visual treatment for one durable session status.
 */
export function getSessionStatusPresentation(
    status: string,
): SessionStatusPresentation {
    const definition = sessionStatusDefinitions[status] ?? {
        tone: 'neutral' as const,
    };

    return {
        label: formatEnumLabel(status),
        className: sessionStatusToneClasses[definition.tone],
        icon: definition.icon,
    };
}

/**
 * Resolve the canonical status badge treatment for one print job.
 */
export function getPrintStatusPresentation(
    status: string,
): PrintStatusPresentation {
    switch (status) {
        case 'printed':
            return {
                label: 'Printed',
                badgeClassName:
                    'border-success/20 bg-success-subtle text-success-foreground',
            };
        case 'pending':
            return {
                label: 'Pending',
                badgeClassName:
                    'border-warning/20 bg-warning-subtle text-warning-foreground',
            };
        case 'printing':
            return {
                label: 'Printing',
                badgeClassName:
                    'border-info/20 bg-info-subtle text-info-foreground',
            };
        case 'failed':
            return {
                label: 'Failed',
                badgeClassName:
                    'border-destructive/20 bg-destructive/10 text-destructive',
            };
        default:
            return {
                label: formatEnumLabel(status),
                badgeClassName: 'border-border bg-muted text-muted-foreground',
            };
    }
}

/**
 * Return only active query filters that the server-provided option lists
 * recognize so ignored invalid enum values are never presented as active.
 */
export function getActiveFilterLabels(
    filters: Filters,
    statuses: string[],
    paymentStatuses: string[],
    paymentMethods: string[],
    printStatuses: string[],
): string[] {
    const activeFilters: string[] = [];

    if (filters.search !== null && filters.search.trim() !== '') {
        activeFilters.push(`Search: ${filters.search}`);
    }

    if (filters.status !== null && statuses.includes(filters.status)) {
        activeFilters.push(`Status: ${formatEnumLabel(filters.status)}`);
    }

    if (filters.from !== null) {
        activeFilters.push(`From: ${filters.from}`);
    }

    if (filters.to !== null) {
        activeFilters.push(`To: ${filters.to}`);
    }

    if (
        filters.payment_status !== null &&
        paymentStatuses.includes(filters.payment_status)
    ) {
        activeFilters.push(
            `Payment status: ${formatEnumLabel(filters.payment_status)}`,
        );
    }

    if (
        filters.payment_method !== null &&
        paymentMethods.includes(filters.payment_method)
    ) {
        activeFilters.push(
            `Payment method: ${formatEnumLabel(filters.payment_method)}`,
        );
    }

    if (
        filters.authorization_type === 'voucher' ||
        filters.authorization_type === 'payment'
    ) {
        activeFilters.push(
            `Authorization: ${formatEnumLabel(filters.authorization_type)}`,
        );
    }

    if (
        filters.print_status !== null &&
        printStatuses.includes(filters.print_status)
    ) {
        activeFilters.push(
            `Print status: ${formatEnumLabel(filters.print_status)}`,
        );
    }

    return activeFilters;
}

/**
 * Build a truthful pagination summary for the session table footer.
 */
export function getPaginationSummary<T>(pagination: Paginated<T>): string {
    if (
        pagination.total === 0 ||
        pagination.from === null ||
        pagination.to === null
    ) {
        return 'Showing 0 of 0';
    }

    return `Showing ${pagination.from}–${pagination.to} of ${pagination.total}`;
}

/**
 * Normalize Laravel paginator labels into plain accessible text.
 */
export function formatPaginationLabel(label: string): string {
    return label
        .replace('&laquo; Previous', 'Previous')
        .replace('Next &raquo;', 'Next')
        .replace(/&laquo;|&raquo;/g, '')
        .replace(/<[^>]*>/g, '')
        .trim();
}

/**
 * Format a summary count as a safe percentage of the all-time total.
 */
export function formatSummaryPercentage(value: number, total: number): string {
    if (total <= 0) {
        return '0.0% of total';
    }

    return `${((value / total) * 100).toFixed(1)}% of total`;
}

/**
 * Format an ISO timestamp consistently for the Philippines operator interface.
 */
function formatDateTime(value: string | null): string {
    if (value === null) {
        return 'Not available';
    }

    return new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

/**
 * Format a snapshotted session amount using its persisted currency when one is
 * available and fall back to a neutral decimal representation otherwise.
 */
export function formatSessionAmount(
    value: string | null,
    currency: string | null,
): string {
    if (value === null) {
        return 'Not available';
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return value;
    }

    if (currency === null || currency.trim() === '') {
        return new Intl.NumberFormat('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    try {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

/**
 * Return canonical payment status classes without inventing new payment states.
 */
function getPaymentStatusClassName(status: string): string {
    switch (status) {
        case 'success':
            return 'border-success/20 bg-success-subtle text-success-foreground';
        case 'pending':
            return 'border-warning/20 bg-warning-subtle text-warning-foreground';
        case 'failed':
            return 'border-destructive/20 bg-destructive/10 text-destructive';
        case 'cancelled':
            return 'border-border bg-muted text-muted-foreground';
        default:
            return 'border-border bg-muted text-muted-foreground';
    }
}

/**
 * Render one compact all-time summary metric using the canonical admin tokens.
 */
function SummaryCard({
    label,
    value,
    description,
    icon,
    tone,
}: {
    label: string;
    value: number;
    description: string;
    icon: ReactNode;
    tone: SummaryTone;
}) {
    const toneClasses: Record<SummaryTone, string> = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        destructive: 'bg-destructive/10 text-destructive',
    };

    return (
        <Card
            aria-label={label}
            className="gap-0 rounded-xl px-5 py-4 shadow-xs"
        >
            <div className="flex min-h-20 items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-card-title">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                        {value.toLocaleString('en-PH')}
                    </p>
                    <p className="mt-1 text-caption text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div
                    className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-full',
                        toneClasses[tone],
                    )}
                >
                    {icon}
                </div>
            </div>
        </Card>
    );
}

/**
 * Render one native server-submitted select with the canonical input styling.
 */
function FilterSelect({
    label,
    name,
    value,
    options,
    allLabel,
}: FilterSelectProps) {
    return (
        <label className="grid gap-1.5 text-sm font-medium">
            <span>{label}</span>

            <div className="relative">
                <select
                    key={value ?? 'all'}
                    name={name}
                    defaultValue={value ?? ''}
                    className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                >
                    <option value="">{allLabel}</option>
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {formatEnumLabel(option)}
                        </option>
                    ))}
                </select>

                <ChevronDown
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
            </div>
        </label>
    );
}

/**
 * Render one durable session lifecycle state with text and semantic color.
 */
function SessionStatusBadge({ status }: { status: string }) {
    const presentation = getSessionStatusPresentation(status);
    const Icon = presentation.icon;

    return (
        <Badge
            variant="outline"
            className={cn('gap-1.5 whitespace-nowrap', presentation.className)}
        >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {presentation.label}
        </Badge>
    );
}

/**
 * Render the payment or voucher authorization evidence attached to a session.
 */
function PaymentDetails({
    payment,
    voucherCode,
    paymentMethod,
}: {
    payment: Payment | null;
    voucherCode: string | null;
    paymentMethod: string | null;
}) {
    if (payment !== null) {
        return (
            <div className="flex flex-col items-start gap-1">
                <Badge
                    variant="outline"
                    className={getPaymentStatusClassName(payment.status)}
                >
                    {formatEnumLabel(payment.status)}
                </Badge>
                <span className="text-caption text-muted-foreground">
                    {formatEnumLabel(payment.method)}
                </span>
            </div>
        );
    }

    if (voucherCode !== null || paymentMethod === 'voucher') {
        return (
            <div className="flex flex-col items-start gap-1">
                <Badge
                    variant="outline"
                    className="border-info/20 bg-info-subtle text-info-foreground"
                >
                    Voucher
                </Badge>
                <span className="max-w-40 truncate text-caption text-muted-foreground">
                    {voucherCode ?? 'Voucher authorization'}
                </span>
            </div>
        );
    }

    return <span className="text-muted-foreground">No payment</span>;
}

/**
 * Render one print-job state and attempt evidence without fabricating copies.
 */
function PrintJobState({ printJob }: { printJob: PrintJob | null }) {
    if (printJob === null) {
        return <span className="text-muted-foreground">No print job</span>;
    }

    const presentation = getPrintStatusPresentation(printJob.status);

    return (
        <div className="flex flex-col items-start gap-1">
            <Badge variant="outline" className={presentation.badgeClassName}>
                {presentation.label}
            </Badge>
            <span className="text-caption text-muted-foreground tabular-nums">
                {printJob.attemptCount}{' '}
                {printJob.attemptCount === 1 ? 'attempt' : 'attempts'}
            </span>
        </div>
    );
}

/**
 * Render accessible Laravel pagination while preserving every active query.
 */
function SessionPagination({ sessions }: { sessions: Paginated<Session> }) {
    return (
        <footer className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-muted-foreground">
                {getPaginationSummary(sessions)} sessions
            </p>

            {sessions.total > 0 ? (
                <nav
                    className="flex flex-wrap items-center gap-1"
                    aria-label="Session pagination"
                >
                    {sessions.links.map((link, index) => {
                        const label = formatPaginationLabel(link.label);

                        return (
                            <Button
                                key={`${link.label}-${index}`}
                                asChild={link.url !== null}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                className="min-w-9 px-2"
                                disabled={link.url === null}
                            >
                                {link.url !== null ? (
                                    <Link
                                        href={link.url}
                                        preserveScroll
                                        aria-current={
                                            link.active ? 'page' : undefined
                                        }
                                    >
                                        {label}
                                    </Link>
                                ) : (
                                    <span>{label}</span>
                                )}
                            </Button>
                        );
                    })}
                </nav>
            ) : null}
        </footer>
    );
}

/**
 * Render the redesigned read-only operational Sessions monitoring interface.
 */
export default function SessionsIndex({
    sessions,
    summary,
    filters,
    statuses,
    paymentStatuses,
    paymentMethods,
    printStatuses,
}: {
    sessions: Paginated<Session>;
    summary: SessionSummary;
    filters: Filters;
    statuses: string[];
    paymentStatuses: string[];
    paymentMethods: string[];
    printStatuses: string[];
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Sessions', href: sessionsIndex() }],
    });

    const activeFilters = getActiveFilterLabels(
        filters,
        statuses,
        paymentStatuses,
        paymentMethods,
        printStatuses,
    );

    const hasActiveFilters = activeFilters.length > 0;

    return (
        <>
            <Head title="Sessions" />

            <div className="flex flex-col gap-6 p-4 lg:p-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-page-title">Sessions</h1>
                        <p className="mt-1 text-body text-muted-foreground">
                            Monitor photobooth sessions, payment authorization,
                            and print status in real time.
                        </p>
                    </div>

                    <Badge
                        variant="outline"
                        className="w-fit gap-1.5 border-border bg-muted/60 text-muted-foreground"
                    >
                        <LockKeyhole className="size-3.5" aria-hidden="true" />
                        Read only
                    </Badge>
                </header>

                <section
                    className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                    aria-label="Session summary"
                >
                    <SummaryCard
                        label="Total Sessions"
                        value={summary.total}
                        description="All time"
                        tone="primary"
                        icon={
                            <CalendarDays
                                className="size-5"
                                aria-hidden="true"
                            />
                        }
                    />
                    <SummaryCard
                        label="Completed Sessions"
                        value={summary.completed}
                        description={formatSummaryPercentage(
                            summary.completed,
                            summary.total,
                        )}
                        tone="success"
                        icon={
                            <CircleCheck
                                className="size-5"
                                aria-hidden="true"
                            />
                        }
                    />
                    <SummaryCard
                        label="Active / Pending"
                        value={summary.inProgress}
                        description={formatSummaryPercentage(
                            summary.inProgress,
                            summary.total,
                        )}
                        tone="warning"
                        icon={<Clock3 className="size-5" aria-hidden="true" />}
                    />
                    <SummaryCard
                        label="Expired / Abandoned"
                        value={summary.expiredOrAbandoned}
                        description={formatSummaryPercentage(
                            summary.expiredOrAbandoned,
                            summary.total,
                        )}
                        tone="destructive"
                        icon={
                            <TimerOff className="size-5" aria-hidden="true" />
                        }
                    />
                </section>

                <Form
                    action={sessionsIndex.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                >
                    <Card className="gap-0 rounded-xl py-0 shadow-xs">
                        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:p-5 xl:grid-cols-4">
                            <label
                                htmlFor="session-search"
                                className="grid gap-1.5 text-sm font-medium sm:col-span-2"
                            >
                                <span>Search</span>
                                <div className="relative">
                                    <Search
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="session-search"
                                        name="search"
                                        defaultValue={filters.search ?? ''}
                                        placeholder="Search session UUID"
                                        className="pl-9"
                                    />
                                </div>
                            </label>

                            <FilterSelect
                                label="Session status"
                                name="status"
                                value={filters.status}
                                options={statuses}
                                allLabel="All statuses"
                            />

                            <FilterSelect
                                label="Payment status"
                                name="payment_status"
                                value={filters.payment_status}
                                options={paymentStatuses}
                                allLabel="All payment statuses"
                            />

                            <FilterSelect
                                label="Payment method"
                                name="payment_method"
                                value={filters.payment_method}
                                options={paymentMethods}
                                allLabel="All payment methods"
                            />

                            <FilterSelect
                                label="Authorization"
                                name="authorization_type"
                                value={filters.authorization_type}
                                options={['voucher', 'payment']}
                                allLabel="All authorization types"
                            />

                            <FilterSelect
                                label="Print status"
                                name="print_status"
                                value={filters.print_status}
                                options={printStatuses}
                                allLabel="All print statuses"
                            />

                            <label className="grid gap-1.5 text-sm font-medium">
                                <span>From</span>
                                <Input
                                    type="date"
                                    name="from"
                                    defaultValue={filters.from ?? ''}
                                />
                            </label>

                            <label className="grid gap-1.5 text-sm font-medium">
                                <span>To</span>
                                <Input
                                    type="date"
                                    name="to"
                                    defaultValue={filters.to ?? ''}
                                />
                            </label>

                            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-3">
                                <Button type="submit" className="gap-2">
                                    <Filter
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Apply filters
                                </Button>

                                {hasActiveFilters ? (
                                    <Button
                                        asChild
                                        variant="outline"
                                        type="button"
                                    >
                                        <Link
                                            href={sessionsIndex()}
                                            preserveScroll
                                        >
                                            Clear filters
                                        </Link>
                                    </Button>
                                ) : null}
                            </div>
                        </CardContent>

                        {hasActiveFilters ? (
                            <CardFooter className="flex flex-wrap gap-2 border-t px-4 py-3 lg:px-5">
                                <span className="text-caption font-medium text-muted-foreground">
                                    Active filters
                                </span>
                                {activeFilters.map((filter) => (
                                    <Badge key={filter} variant="secondary">
                                        {filter}
                                    </Badge>
                                ))}
                            </CardFooter>
                        ) : null}
                    </Card>
                </Form>

                <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="bg-muted/40 text-left text-caption text-muted-foreground">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y font-medium"
                                    >
                                        Session
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y font-medium"
                                    >
                                        Started
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y font-medium"
                                    >
                                        Template
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y font-medium"
                                    >
                                        Payment
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y font-medium"
                                    >
                                        Print
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y font-medium"
                                    >
                                        Session status
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-table-x py-table-y text-right font-medium"
                                    >
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.data.length > 0 ? (
                                    sessions.data.map((session) => (
                                        <tr
                                            key={session.id}
                                            className="border-t transition-colors hover:bg-muted/20"
                                        >
                                            <td className="px-table-x py-table-y align-top">
                                                <code className="text-xs font-semibold whitespace-nowrap text-foreground">
                                                    {session.sessionToken}
                                                </code>
                                                <p className="mt-1 text-caption text-muted-foreground">
                                                    Internal #{session.id}
                                                </p>
                                            </td>
                                            <td className="px-table-x py-table-y align-top whitespace-nowrap">
                                                {formatDateTime(
                                                    session.startedAt,
                                                )}
                                            </td>
                                            <td className="px-table-x py-table-y align-top">
                                                <p className="font-medium">
                                                    {session.templateName ??
                                                        'No template selected'}
                                                </p>
                                            </td>
                                            <td className="px-table-x py-table-y align-top">
                                                <PaymentDetails
                                                    payment={session.payment}
                                                    voucherCode={
                                                        session.voucherCode
                                                    }
                                                    paymentMethod={
                                                        session.paymentMethod
                                                    }
                                                />
                                            </td>
                                            <td className="px-table-x py-table-y align-top">
                                                <PrintJobState
                                                    printJob={session.printJob}
                                                />
                                            </td>
                                            <td className="px-table-x py-table-y align-top">
                                                <SessionStatusBadge
                                                    status={session.status}
                                                />
                                            </td>
                                            <td className="px-table-x py-table-y text-right align-top font-medium whitespace-nowrap tabular-nums">
                                                {formatSessionAmount(
                                                    session.price ??
                                                        session.payment
                                                            ?.amount ??
                                                        null,
                                                    session.currency,
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-6 py-14 text-center"
                                        >
                                            <div className="mx-auto flex max-w-md flex-col items-center">
                                                <CalendarDays
                                                    className="mb-3 size-8 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                <p className="font-medium">
                                                    No sessions found
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    No session records match the
                                                    current filters.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <SessionPagination sessions={sessions} />
                </Card>
            </div>
        </>
    );
}
