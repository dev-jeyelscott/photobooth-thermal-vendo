import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import { CreditCard, Filter, RotateCcw, ShieldCheck } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { index as paymentsIndex } from '@/routes/admin/payments';

export type Payment = {
    id: number;
    sessionToken: string | null;
    method: string;
    status: string;
    mayaPaymentId: string | null;
    mayaCheckoutId: string | null;
    amount: string;
    createdAt: string | null;
    updatedAt: string | null;
};

type Paginated<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

type Filters = {
    status: string | null;
    from: string | null;
    to: string | null;
};

type PaymentStatusPresentation = {
    label: string;
    badgeClassName: string;
    dotClassName: string;
};

const paymentStatusPresentation: Record<string, PaymentStatusPresentation> = {
    success: {
        label: 'Success',
        badgeClassName:
            'border-success/30 bg-success-subtle text-success-foreground',
        dotClassName: 'bg-success',
    },
    pending: {
        label: 'Pending',
        badgeClassName:
            'border-warning/30 bg-warning-subtle text-warning-foreground',
        dotClassName: 'bg-warning',
    },
    failed: {
        label: 'Failed',
        badgeClassName:
            'border-destructive/30 bg-destructive/10 text-destructive',
        dotClassName: 'bg-destructive',
    },
    cancelled: {
        label: 'Cancelled',
        badgeClassName: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
    },
};

/**
 * Convert a stored amount into a stable operator-facing decimal without
 * inventing a currency that is not present in the payment page contract.
 */
export function formatPaymentAmount(value: string): string {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return value;
    }

    return new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format a persisted timestamp into a concise Philippine operator-facing
 * representation while preserving the original timestamp as the title.
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
 * Convert the persisted payment method value into a readable label.
 */
function formatPaymentMethod(method: string): string {
    return method
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

/**
 * Remove Laravel pagination HTML/entity decoration so navigation labels can be
 * rendered as normal React text instead of dangerously injecting HTML.
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
 * Render a semantic payment status badge with both text and color indication.
 */
function PaymentStatusBadge({ status }: { status: string }) {
    const presentation = paymentStatusPresentation[status] ?? {
        label:
            status.charAt(0).toUpperCase() +
            status.slice(1).replaceAll('_', ' '),
        badgeClassName: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
    };

    return (
        <Badge
            variant="outline"
            className={`gap-2 whitespace-nowrap ${presentation.badgeClassName}`}
            aria-label={`Payment status: ${presentation.label}`}
        >
            <span
                className={`size-1.5 shrink-0 rounded-full ${presentation.dotClassName}`}
                aria-hidden="true"
            />
            {presentation.label}
        </Badge>
    );
}

/**
 * Render a technical payment identifier without allowing long provider values
 * to destroy the surrounding table or mobile-card layout.
 */
function PaymentIdentifier({
    value,
    emptyLabel = 'Not available',
}: {
    value: string | null;
    emptyLabel?: string;
}) {
    if (value === null || value.length === 0) {
        return (
            <span className="text-sm text-muted-foreground">{emptyLabel}</span>
        );
    }

    return (
        <code
            className="block max-w-64 truncate text-xs font-medium text-foreground"
            title={value}
        >
            {value}
        </code>
    );
}

/**
 * Render one responsive payment record for tablet and narrow admin layouts.
 */
function PaymentMobileCard({ payment }: { payment: Payment }) {
    return (
        <article className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Session
                    </p>
                    <PaymentIdentifier
                        value={payment.sessionToken}
                        emptyLabel="No session reference"
                    />
                </div>

                <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tabular-nums">
                        {formatPaymentAmount(payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {formatPaymentMethod(payment.method)}
                    </p>
                </div>
            </div>

            <PaymentStatusBadge status={payment.status} />

            <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                    <dt className="mb-1 text-xs text-muted-foreground">
                        Maya payment ID
                    </dt>
                    <dd>
                        <PaymentIdentifier value={payment.mayaPaymentId} />
                    </dd>
                </div>

                <div>
                    <dt className="mb-1 text-xs text-muted-foreground">
                        Maya checkout ID
                    </dt>
                    <dd>
                        <PaymentIdentifier value={payment.mayaCheckoutId} />
                    </dd>
                </div>

                <div>
                    <dt className="mb-1 text-xs text-muted-foreground">
                        Created
                    </dt>
                    <dd
                        className="text-sm"
                        title={payment.createdAt ?? undefined}
                    >
                        {formatPaymentDateTime(payment.createdAt)}
                    </dd>
                </div>

                <div>
                    <dt className="mb-1 text-xs text-muted-foreground">
                        Updated
                    </dt>
                    <dd
                        className="text-sm"
                        title={payment.updatedAt ?? undefined}
                    >
                        {formatPaymentDateTime(payment.updatedAt)}
                    </dd>
                </div>
            </dl>
        </article>
    );
}

/**
 * Render compact accessible Laravel pagination without injecting raw HTML.
 */
function PaymentPagination({ payments }: { payments: Paginated<Payment> }) {
    if (payments.total === 0) {
        return null;
    }

    return (
        <footer className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground tabular-nums">
                    {payments.from}–{payments.to}
                </span>{' '}
                of{' '}
                <span className="font-medium text-foreground tabular-nums">
                    {payments.total}
                </span>{' '}
                payments
            </p>

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
                                    aria-label={
                                        link.active
                                            ? `Page ${label}, current page`
                                            : label
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
        </footer>
    );
}

/**
 * Render the read-only operator payment evidence screen.
 */
export default function PaymentsIndex({
    payments,
    filters,
    statuses,
}: {
    payments: Paginated<Payment>;
    filters: Filters;
    statuses: string[];
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Payments', href: paymentsIndex() }],
    });

    const hasActiveFilters =
        filters.status !== null || filters.from !== null || filters.to !== null;

    return (
        <>
            <Head title="Payments" />

            <div className="flex flex-col gap-6 p-4 lg:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="[&>header]:mb-0">
                        <Heading
                            title="Payments"
                            description="Monitor immutable payment evidence and provider references."
                        />
                    </div>

                    <Badge
                        variant="outline"
                        className="w-fit gap-2 border-info/25 bg-info-subtle px-3 py-1.5 text-info-foreground"
                    >
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Read only
                    </Badge>
                </div>

                <Card className="gap-0 rounded-2xl py-0 shadow-none">
                    <Form
                        action={paymentsIndex.url()}
                        method="get"
                        options={{
                            preserveState: true,
                            replace: true,
                        }}
                    >
                        {({ processing }) => (
                            <div className="grid gap-4 p-4 md:grid-cols-2 lg:p-5 xl:grid-cols-[minmax(11rem,0.8fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] xl:items-end">
                                <label className="flex flex-col gap-1.5 text-sm font-medium">
                                    Status
                                    <select
                                        name="status"
                                        defaultValue={filters.status ?? ''}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    >
                                        <option value="">All statuses</option>

                                        {statuses.map((status) => (
                                            <option key={status} value={status}>
                                                {
                                                    (
                                                        paymentStatusPresentation[
                                                            status
                                                        ] ?? {
                                                            label:
                                                                status
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                status
                                                                    .slice(1)
                                                                    .replaceAll(
                                                                        '_',
                                                                        ' ',
                                                                    ),
                                                        }
                                                    ).label
                                                }
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="flex flex-col gap-1.5 text-sm font-medium">
                                    From
                                    <Input
                                        type="date"
                                        name="from"
                                        defaultValue={filters.from ?? ''}
                                    />
                                </label>

                                <label className="flex flex-col gap-1.5 text-sm font-medium">
                                    To
                                    <Input
                                        type="date"
                                        name="to"
                                        defaultValue={filters.to ?? ''}
                                    />
                                </label>

                                <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-1">
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        className="gap-2"
                                    >
                                        <Filter
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {processing ? 'Filtering...' : 'Filter'}
                                    </Button>

                                    {hasActiveFilters && (
                                        <Button
                                            asChild
                                            variant="ghost"
                                            type="button"
                                            className="gap-2"
                                        >
                                            <Link
                                                href={paymentsIndex.url()}
                                                preserveScroll
                                            >
                                                <RotateCcw
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                                Clear filters
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </Form>
                </Card>

                <Card
                    className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none"
                    aria-label="Payment evidence"
                >
                    <header className="flex items-center justify-between gap-4 border-b px-4 py-4 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                                <CreditCard
                                    className="size-5 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </div>

                            <div className="min-w-0">
                                <h3 className="font-semibold tracking-tight">
                                    Payment evidence
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Provider references and transaction state
                                    recorded by ThermaSnap.
                                </p>
                            </div>
                        </div>

                        {payments.total > 0 && (
                            <span className="hidden text-sm text-muted-foreground tabular-nums sm:block">
                                {payments.total}{' '}
                                {payments.total === 1 ? 'record' : 'records'}
                            </span>
                        )}
                    </header>

                    {payments.data.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
                                <CreditCard
                                    className="size-5 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </div>

                            <p className="font-medium">No payments found</p>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                No payment evidence matches the current filters.
                            </p>

                            {hasActiveFilters && (
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                >
                                    <Link href={paymentsIndex.url()}>
                                        Clear filters
                                    </Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto lg:block">
                                <table className="w-full min-w-[1240px] text-sm">
                                    <thead className="bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Session
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Method
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Status
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Maya payment ID
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Maya checkout ID
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 text-right font-medium"
                                            >
                                                Amount
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Created
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-medium"
                                            >
                                                Updated
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {payments.data.map((payment) => (
                                            <tr
                                                key={payment.id}
                                                className="border-t transition-colors hover:bg-muted/20"
                                            >
                                                <td className="px-4 py-4">
                                                    <PaymentIdentifier
                                                        value={
                                                            payment.sessionToken
                                                        }
                                                        emptyLabel="No session"
                                                    />
                                                </td>

                                                <td className="px-4 py-4 font-medium">
                                                    {formatPaymentMethod(
                                                        payment.method,
                                                    )}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <PaymentStatusBadge
                                                        status={payment.status}
                                                    />
                                                </td>

                                                <td className="px-4 py-4">
                                                    <PaymentIdentifier
                                                        value={
                                                            payment.mayaPaymentId
                                                        }
                                                    />
                                                </td>

                                                <td className="px-4 py-4">
                                                    <PaymentIdentifier
                                                        value={
                                                            payment.mayaCheckoutId
                                                        }
                                                    />
                                                </td>

                                                <td className="px-4 py-4 text-right font-semibold tabular-nums">
                                                    {formatPaymentAmount(
                                                        payment.amount,
                                                    )}
                                                </td>

                                                <td
                                                    className="px-4 py-4 whitespace-nowrap"
                                                    title={
                                                        payment.createdAt ??
                                                        undefined
                                                    }
                                                >
                                                    {formatPaymentDateTime(
                                                        payment.createdAt,
                                                    )}
                                                </td>

                                                <td
                                                    className="px-4 py-4 whitespace-nowrap text-muted-foreground"
                                                    title={
                                                        payment.updatedAt ??
                                                        undefined
                                                    }
                                                >
                                                    {formatPaymentDateTime(
                                                        payment.updatedAt,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="divide-y lg:hidden">
                                {payments.data.map((payment) => (
                                    <PaymentMobileCard
                                        key={payment.id}
                                        payment={payment}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    <PaymentPagination payments={payments} />
                </Card>
            </div>
        </>
    );
}
