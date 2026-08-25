import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronDown,
    CircleX,
    Clock3,
    CreditCard,
    Filter,
    Search,
    ShieldCheck,
    WalletCards,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { index as paymentsIndex } from '@/routes/admin/payments';

export type Payment = {
    id: number;
    sessionToken: string | null;
    currency: string | null;
    method: string;
    status: string;
    mayaPaymentId: string | null;
    mayaCheckoutId: string | null;
    amount: string;
    paidAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type PaymentSummary = {
    total: number;
    successful: number;
    pending: number;
    failedOrCancelled: number;
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
    method: string | null;
    from: string | null;
    to: string | null;
};

type PaymentStatusPresentation = {
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

const paymentStatusPresentation: Record<string, PaymentStatusPresentation> = {
    success: {
        label: 'Success',
        badgeClassName:
            'border-success/30 bg-success-subtle text-success-foreground',
    },
    pending: {
        label: 'Pending',
        badgeClassName:
            'border-warning/30 bg-warning-subtle text-warning-foreground',
    },
    failed: {
        label: 'Failed',
        badgeClassName:
            'border-destructive/30 bg-destructive/10 text-destructive',
    },
    cancelled: {
        label: 'Cancelled',
        badgeClassName: 'border-border bg-muted text-muted-foreground',
    },
};

/**
 * Convert enum-style values into readable operator labels.
 */
function formatEnumLabel(value: string): string {
    return value
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

/**
 * Convert a stored amount into a stable operator-facing value, using the
 * session currency only when that currency was actually persisted.
 */
export function formatPaymentAmount(
    value: string,
    currency: string | null = null,
): string {
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
 * Format a persisted timestamp into a concise Philippine operator-facing
 * representation while preserving null as explicit missing evidence.
 */
export function formatPaymentDateTime(value: string | null): string {
    if (value === null) {
        return 'Not available';
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
 * Remove Laravel pagination entity decoration so links remain accessible text.
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
 * Format one all-time payment count as a safe percentage of the total.
 */
export function formatSummaryPercentage(value: number, total: number): string {
    if (total <= 0) {
        return '0.0% of total';
    }

    return `${((value / total) * 100).toFixed(1)}% of total`;
}

/**
 * Render one compact all-time payment summary using canonical design tokens.
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
 * Render a canonical server-submitted select without introducing client-only
 * filter state that could diverge from Laravel query parameters.
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
 * Render a semantic payment status badge using only persisted enum states.
 */
function PaymentStatusBadge({ status }: { status: string }) {
    const presentation = paymentStatusPresentation[status] ?? {
        label: formatEnumLabel(status),
        badgeClassName: 'border-border bg-muted text-muted-foreground',
    };

    return (
        <Badge
            variant="outline"
            className={`whitespace-nowrap ${presentation.badgeClassName}`}
            aria-label={`Payment status: ${presentation.label}`}
        >
            {presentation.label}
        </Badge>
    );
}

/**
 * Render a full technical identifier while allowing the visible cell to
 * truncate on dense layouts without losing the underlying troubleshooting data.
 */
function PaymentIdentifier({
    value,
    emptyLabel = 'Not available',
}: {
    value: string | null;
    emptyLabel?: string;
}) {
    if (value === null || value.length === 0) {
        return <span className="text-muted-foreground">{emptyLabel}</span>;
    }

    return (
        <code
            className="block max-w-56 truncate text-xs font-medium text-foreground"
            title={value}
        >
            {value}
        </code>
    );
}

/**
 * Render one payment record as a readable card for narrow admin viewports.
 */
function PaymentMobileCard({ payment }: { payment: Payment }) {
    return (
        <article className="space-y-4 border-t p-4 first:border-t-0 sm:p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-caption text-muted-foreground">
                        Payment #{payment.id}
                    </p>
                    <PaymentIdentifier
                        value={payment.mayaPaymentId}
                        emptyLabel="No Maya payment ID"
                    />
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                    {formatPaymentAmount(payment.amount, payment.currency)}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={payment.status} />
                <Badge variant="secondary">
                    {formatEnumLabel(payment.method)}
                </Badge>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                    <dt className="text-caption text-muted-foreground">
                        Session
                    </dt>
                    <dd className="mt-1">
                        <PaymentIdentifier
                            value={payment.sessionToken}
                            emptyLabel="No session reference"
                        />
                    </dd>
                </div>
                <div>
                    <dt className="text-caption text-muted-foreground">
                        Maya checkout ID
                    </dt>
                    <dd className="mt-1">
                        <PaymentIdentifier value={payment.mayaCheckoutId} />
                    </dd>
                </div>
                <div>
                    <dt className="text-caption text-muted-foreground">
                        Paid at
                    </dt>
                    <dd className="mt-1 text-sm">
                        {formatPaymentDateTime(payment.paidAt)}
                    </dd>
                </div>
                <div>
                    <dt className="text-caption text-muted-foreground">
                        Created at
                    </dt>
                    <dd className="mt-1 text-sm">
                        {formatPaymentDateTime(payment.createdAt)}
                    </dd>
                </div>
            </dl>
        </article>
    );
}

/**
 * Render accessible Laravel pagination while preserving current search filters.
 */
function PaymentPagination({ payments }: { payments: Paginated<Payment> }) {
    return (
        <footer className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-muted-foreground">
                {payments.total === 0 ||
                payments.from === null ||
                payments.to === null
                    ? 'Showing 0 of 0 payments'
                    : `Showing ${payments.from}–${payments.to} of ${payments.total} payments`}
            </p>

            {payments.total > 0 ? (
                <nav
                    className="flex flex-wrap items-center gap-1"
                    aria-label="Payment pagination"
                >
                    {payments.links.map((link, index) => {
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
 * Render the redesigned read-only payment evidence management page.
 */
export default function PaymentsIndex({
    payments,
    summary,
    filters,
    statuses,
    methods,
}: {
    payments: Paginated<Payment>;
    summary: PaymentSummary;
    filters: Filters;
    statuses: string[];
    methods: string[];
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Payments', href: paymentsIndex() }],
    });

    const hasActiveFilters =
        filters.search !== null ||
        filters.status !== null ||
        filters.method !== null ||
        filters.from !== null ||
        filters.to !== null;

    return (
        <>
            <Head title="Payments" />

            <div className="flex flex-col gap-6 p-4 lg:p-6">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-page-title">Payments</h1>
                        <p className="mt-1 text-body text-muted-foreground">
                            Track immutable payment evidence and provider
                            references across photobooth sessions.
                        </p>
                    </div>

                    <Badge
                        variant="outline"
                        className="w-fit gap-1.5 border-info/25 bg-info-subtle text-info-foreground"
                    >
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Read only
                    </Badge>
                </header>

                <section
                    className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                    aria-label="Payment summary"
                >
                    <SummaryCard
                        label="Total Payments"
                        value={summary.total}
                        description="All time"
                        tone="primary"
                        icon={
                            <WalletCards
                                className="size-5"
                                aria-hidden="true"
                            />
                        }
                    />
                    <SummaryCard
                        label="Successful Payments"
                        value={summary.successful}
                        description={formatSummaryPercentage(
                            summary.successful,
                            summary.total,
                        )}
                        tone="success"
                        icon={
                            <CheckCircle2
                                className="size-5"
                                aria-hidden="true"
                            />
                        }
                    />
                    <SummaryCard
                        label="Pending Payments"
                        value={summary.pending}
                        description={formatSummaryPercentage(
                            summary.pending,
                            summary.total,
                        )}
                        tone="warning"
                        icon={<Clock3 className="size-5" aria-hidden="true" />}
                    />
                    <SummaryCard
                        label="Failed / Cancelled"
                        value={summary.failedOrCancelled}
                        description={formatSummaryPercentage(
                            summary.failedOrCancelled,
                            summary.total,
                        )}
                        tone="destructive"
                        icon={<CircleX className="size-5" aria-hidden="true" />}
                    />
                </section>

                <Form
                    action={paymentsIndex.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                >
                    <Card className="gap-0 rounded-xl py-0 shadow-xs">
                        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:p-5 xl:grid-cols-6">
                            <label
                                htmlFor="payment-search"
                                className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-2"
                            >
                                <span>Search</span>
                                <div className="relative">
                                    <Search
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="payment-search"
                                        name="search"
                                        defaultValue={filters.search ?? ''}
                                        placeholder="Search session or Maya reference"
                                        className="pl-9"
                                    />
                                </div>
                            </label>

                            <FilterSelect
                                label="Status"
                                name="status"
                                value={filters.status}
                                options={statuses}
                                allLabel="All statuses"
                            />

                            <FilterSelect
                                label="Method"
                                name="method"
                                value={filters.method}
                                options={methods}
                                allLabel="All methods"
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

                            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-6">
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
                                            href={paymentsIndex()}
                                            preserveScroll
                                        >
                                            Clear filters
                                        </Link>
                                    </Button>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                </Form>

                <Card
                    className="gap-0 overflow-hidden rounded-xl py-0 shadow-xs"
                    aria-label="Payment evidence"
                >
                    {payments.data.length === 0 ? (
                        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
                            <CreditCard
                                className="mb-3 size-8 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p className="font-medium">No payments found</p>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                No payment evidence matches the current filters.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y lg:hidden">
                                {payments.data.map((payment) => (
                                    <PaymentMobileCard
                                        key={payment.id}
                                        payment={payment}
                                    />
                                ))}
                            </div>

                            <div className="hidden overflow-x-auto lg:block">
                                <table className="w-full min-w-[1220px] text-sm">
                                    <thead className="bg-muted/40 text-left text-caption text-muted-foreground">
                                        <tr>
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
                                                Session
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y font-medium"
                                            >
                                                Method
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y text-right font-medium"
                                            >
                                                Amount
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y font-medium"
                                            >
                                                Status
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y font-medium"
                                            >
                                                Paid / Created
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y font-medium"
                                            >
                                                Maya payment ID
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y font-medium"
                                            >
                                                Maya checkout ID
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.data.map((payment) => (
                                            <tr
                                                key={payment.id}
                                                className="border-t transition-colors hover:bg-muted/20"
                                            >
                                                <td className="px-table-x py-table-y align-top">
                                                    <span className="font-semibold tabular-nums">
                                                        #{payment.id}
                                                    </span>
                                                </td>
                                                <td className="px-table-x py-table-y align-top">
                                                    <PaymentIdentifier
                                                        value={
                                                            payment.sessionToken
                                                        }
                                                        emptyLabel="No session reference"
                                                    />
                                                </td>
                                                <td className="px-table-x py-table-y align-top">
                                                    <Badge variant="secondary">
                                                        {formatEnumLabel(
                                                            payment.method,
                                                        )}
                                                    </Badge>
                                                </td>
                                                <td className="px-table-x py-table-y text-right align-top font-medium whitespace-nowrap tabular-nums">
                                                    {formatPaymentAmount(
                                                        payment.amount,
                                                        payment.currency,
                                                    )}
                                                </td>
                                                <td className="px-table-x py-table-y align-top">
                                                    <PaymentStatusBadge
                                                        status={payment.status}
                                                    />
                                                </td>
                                                <td className="px-table-x py-table-y align-top whitespace-nowrap">
                                                    <p>
                                                        {formatPaymentDateTime(
                                                            payment.paidAt,
                                                        )}
                                                    </p>
                                                    <p className="mt-1 text-caption text-muted-foreground">
                                                        Created{' '}
                                                        {formatPaymentDateTime(
                                                            payment.createdAt,
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-table-x py-table-y align-top">
                                                    <PaymentIdentifier
                                                        value={
                                                            payment.mayaPaymentId
                                                        }
                                                        emptyLabel="Not assigned"
                                                    />
                                                </td>
                                                <td className="px-table-x py-table-y align-top">
                                                    <PaymentIdentifier
                                                        value={
                                                            payment.mayaCheckoutId
                                                        }
                                                        emptyLabel="Not assigned"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <PaymentPagination payments={payments} />
                </Card>
            </div>
        </>
    );
}
