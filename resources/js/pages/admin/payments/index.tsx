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

type PaymentPresentation = {
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

const paymentStatusPresentation: Record<string, PaymentPresentation> = {
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

const paymentMethodPresentation: Record<string, PaymentPresentation> = {
    maya: {
        label: 'Maya',
        badgeClassName:
            'border-success/25 bg-success-subtle text-success-foreground',
    },
    voucher: {
        label: 'Voucher',
        badgeClassName: 'border-info/25 bg-info-subtle text-info-foreground',
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
 * Convert a stored amount into a stable operator-facing value while using only
 * the persisted session currency when one is available.
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
 * Format a persisted timestamp for the Philippine operator interface while
 * keeping missing evidence explicit.
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
 * Format one summary count as a safe percentage of the authoritative total.
 */
export function formatSummaryPercentage(value: number, total: number): string {
    if (total <= 0) {
        return '0.0% of total';
    }

    return `${((value / total) * 100).toFixed(1)}% of total`;
}

/**
 * Build the concise pagination summary shown below the payments table.
 */
export function getPaymentPaginationSummary<T>(
    pagination: Paginated<T>,
): string {
    if (
        pagination.total === 0 ||
        pagination.from === null ||
        pagination.to === null
    ) {
        return 'Showing 0 of 0 payments';
    }

    return `Showing ${pagination.from}–${pagination.to} of ${pagination.total.toLocaleString('en-PH')} payments`;
}

/**
 * Render one compact all-time payment KPI using canonical semantic tokens.
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
    const iconToneClasses: Record<SummaryTone, string> = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        destructive: 'bg-destructive/10 text-destructive',
    };

    const descriptionToneClasses: Record<SummaryTone, string> = {
        primary: 'text-muted-foreground',
        success: 'text-success',
        warning: 'text-warning',
        destructive: 'text-destructive',
    };

    return (
        <Card aria-label={label} className="gap-0 rounded-xl py-0 shadow-xs">
            <CardContent className="flex min-h-28 items-center gap-4 px-5 py-4">
                <div
                    className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-full',
                        iconToneClasses[tone],
                    )}
                >
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="text-card-title text-muted-foreground">
                        {label}
                    </p>
                    <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                        {value.toLocaleString('en-PH')}
                    </p>
                    <p
                        className={cn(
                            'mt-0.5 text-caption font-medium',
                            descriptionToneClasses[tone],
                        )}
                    >
                        {description}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Render a native GET-form select so submitted filter values remain owned by
 * Laravel and cannot diverge into separate client-side filter state.
 */
function FilterSelect({
    label,
    name,
    value,
    options,
    allLabel,
}: FilterSelectProps) {
    return (
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">
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
 * Render one persisted payment status with the canonical semantic treatment.
 */
function PaymentStatusBadge({ status }: { status: string }) {
    const presentation = paymentStatusPresentation[status] ?? {
        label: formatEnumLabel(status),
        badgeClassName: 'border-border bg-muted text-muted-foreground',
    };

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-medium whitespace-nowrap',
                presentation.badgeClassName,
            )}
            aria-label={`Payment status: ${presentation.label}`}
        >
            {presentation.label}
        </Badge>
    );
}

/**
 * Render one persisted payment method without implying unsupported gateway or
 * tender types that do not exist in the backend contract.
 */
function PaymentMethodBadge({ method }: { method: string }) {
    const presentation = paymentMethodPresentation[method] ?? {
        label: formatEnumLabel(method),
        badgeClassName: 'border-border bg-muted text-muted-foreground',
    };

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-medium whitespace-nowrap',
                presentation.badgeClassName,
            )}
            aria-label={`Payment method: ${presentation.label}`}
        >
            {presentation.label}
        </Badge>
    );
}

/**
 * Keep the complete technical identifier in the DOM and title attribute while
 * allowing dense payment layouts to truncate visually.
 */
function PaymentIdentifier({
    value,
    emptyLabel = 'Not available',
    className,
}: {
    value: string | null;
    emptyLabel?: string;
    className?: string;
}) {
    if (value === null || value.length === 0) {
        return (
            <span className="text-caption text-muted-foreground">
                {emptyLabel}
            </span>
        );
    }

    return (
        <code
            className={cn(
                'block max-w-64 truncate text-xs font-medium text-foreground',
                className,
            )}
            title={value}
        >
            {value}
        </code>
    );
}

/**
 * Consolidate both Maya troubleshooting identifiers into one reference region
 * without dropping either persisted value.
 */
function PaymentReference({ payment }: { payment: Payment }) {
    return (
        <div className="grid gap-2">
            <div className="min-w-0">
                <p className="text-caption text-muted-foreground">
                    Maya payment
                </p>
                <PaymentIdentifier
                    value={payment.mayaPaymentId}
                    emptyLabel="Not assigned"
                />
            </div>

            <div className="min-w-0">
                <p className="text-caption text-muted-foreground">
                    Maya checkout
                </p>
                <PaymentIdentifier
                    value={payment.mayaCheckoutId}
                    emptyLabel="Not assigned"
                />
            </div>
        </div>
    );
}

/**
 * Render one responsive payment record for tablet and mobile admin viewports.
 */
function PaymentMobileCard({ payment }: { payment: Payment }) {
    return (
        <article className="space-y-4 border-t p-4 first:border-t-0 sm:p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-caption text-muted-foreground">
                        Payment ID
                    </p>
                    <p className="mt-0.5 font-semibold text-primary tabular-nums">
                        #{payment.id}
                    </p>
                </div>

                <p className="shrink-0 font-semibold tabular-nums">
                    {formatPaymentAmount(payment.amount, payment.currency)}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <PaymentMethodBadge method={payment.method} />
                <PaymentStatusBadge status={payment.status} />
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
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

                <div className="min-w-0 sm:col-span-2">
                    <dt className="text-caption text-muted-foreground">
                        Reference
                    </dt>
                    <dd className="mt-1">
                        <PaymentReference payment={payment} />
                    </dd>
                </div>
            </dl>
        </article>
    );
}

/**
 * Render Laravel pagination with compact controls and preserved query strings.
 */
function PaymentPagination({ payments }: { payments: Paginated<Payment> }) {
    return (
        <footer className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-muted-foreground">
                {getPaymentPaginationSummary(payments)}
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
 * Render the read-only ThermaSnap Payments management workspace.
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
                            Track payment transactions across photobooth
                            sessions.
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
                        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.65fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(17rem,1.35fr)_auto] xl:items-end">
                            <label
                                htmlFor="payment-search"
                                className="grid min-w-0 gap-1.5 text-sm font-medium md:col-span-2 xl:col-span-1"
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
                                label="Payment Method"
                                name="method"
                                value={filters.method}
                                options={methods}
                                allLabel="All methods"
                            />

                            <fieldset className="grid min-w-0 gap-1.5 md:col-span-2 xl:col-span-1">
                                <legend className="text-sm font-medium">
                                    Date Range
                                </legend>

                                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                                    <label
                                        htmlFor="payment-from"
                                        className="sr-only"
                                    >
                                        From
                                    </label>

                                    <Input
                                        id="payment-from"
                                        type="date"
                                        name="from"
                                        defaultValue={filters.from ?? ''}
                                        className="min-w-0"
                                    />

                                    <span
                                        className="text-caption text-muted-foreground"
                                        aria-hidden="true"
                                    >
                                        to
                                    </span>

                                    <label
                                        htmlFor="payment-to"
                                        className="sr-only"
                                    >
                                        To
                                    </label>

                                    <Input
                                        id="payment-to"
                                        type="date"
                                        name="to"
                                        defaultValue={filters.to ?? ''}
                                        className="min-w-0"
                                    />
                                </div>
                            </fieldset>

                            <div className="flex gap-2 md:col-span-2 xl:col-span-1 xl:justify-end">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    aria-label="Apply filters"
                                    className="flex-1 gap-2 xl:flex-none"
                                >
                                    <Filter
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Filters
                                </Button>

                                {hasActiveFilters ? (
                                    <Button
                                        asChild
                                        variant="ghost"
                                        type="button"
                                        className="flex-1 xl:flex-none"
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
                                <table className="w-full min-w-[1080px] text-sm">
                                    <thead className="border-b bg-muted/30 text-left text-caption text-muted-foreground">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-table-x py-table-y font-medium"
                                            >
                                                Payment ID
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
                                                Reference
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y">
                                        {payments.data.map((payment) => (
                                            <tr
                                                key={payment.id}
                                                className="transition-colors hover:bg-muted/20"
                                            >
                                                <td className="px-table-x py-table-y align-top">
                                                    <span className="font-semibold text-primary tabular-nums">
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
                                                    <PaymentMethodBadge
                                                        method={payment.method}
                                                    />
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

                                                <td className="min-w-64 px-table-x py-table-y align-top">
                                                    <PaymentReference
                                                        payment={payment}
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
