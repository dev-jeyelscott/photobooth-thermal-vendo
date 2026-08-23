import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Camera,
    ChevronDown,
    CircleCheck,
    Clock3,
    CreditCard,
    LoaderCircle,
    LockKeyhole,
    Printer,
    Rows3,
} from 'lucide-react';
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
    payment: Payment | null;
    printJob: PrintJob | null;
};

export type Paginated<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

export type Filters = {
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
    dotClassName: string;
    textClassName: string;
};

type FilterSelectProps = {
    label: string;
    name: string;
    value: string | null;
    options: string[];
};

const sessionStatusToneClasses: Record<SessionStatusTone, string> = {
    success: 'border-success/20 bg-success-subtle text-success',
    warning: 'border-warning/20 bg-warning-subtle text-warning',
    info: 'border-info/20 bg-info-subtle text-info',
    neutral: 'border-border bg-muted text-muted-foreground',
};

const sessionStatusDefinitions: Record<
    string,
    { tone: SessionStatusTone; icon?: LucideIcon }
> = {
    new: {
        tone: 'neutral',
    },
    payment_pending: {
        tone: 'warning',
        icon: Clock3,
    },
    paid: {
        tone: 'success',
        icon: CreditCard,
    },
    template_selected: {
        tone: 'info',
    },
    capturing: {
        tone: 'info',
        icon: Camera,
    },
    customizing: {
        tone: 'info',
    },
    processing: {
        tone: 'info',
        icon: LoaderCircle,
    },
    printing: {
        tone: 'info',
        icon: Printer,
    },
    completed: {
        tone: 'success',
        icon: CircleCheck,
    },
    expired: {
        tone: 'neutral',
        icon: Clock3,
    },
    abandoned: {
        tone: 'neutral',
    },
};

/**
 * Convert enum-style stored values into concise operator-facing labels without
 * changing the underlying value submitted to Laravel.
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
 * Resolve the semantic visual treatment for one print-job status.
 */
export function getPrintStatusPresentation(
    status: string,
): PrintStatusPresentation {
    switch (status) {
        case 'printed':
            return {
                label: 'Printed',
                dotClassName: 'bg-success',
                textClassName: 'text-foreground',
            };
        case 'pending':
            return {
                label: 'Pending',
                dotClassName: 'bg-warning',
                textClassName: 'text-foreground',
            };
        case 'printing':
            return {
                label: 'Printing',
                dotClassName: 'bg-info',
                textClassName: 'text-foreground',
            };
        case 'failed':
            return {
                label: 'Failed',
                dotClassName: 'bg-destructive',
                textClassName: 'text-destructive',
            };
        default:
            return {
                label: formatEnumLabel(status),
                dotClassName: 'bg-muted-foreground',
                textClassName: 'text-muted-foreground',
            };
    }
}

/**
 * Return only filters that the current server-provided option lists recognize,
 * preventing ignored invalid query values from appearing as active filters.
 */
export function getActiveFilterLabels(
    filters: Filters,
    statuses: string[],
    paymentStatuses: string[],
    paymentMethods: string[],
    printStatuses: string[],
): string[] {
    const activeFilters: string[] = [];

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
 * Build one truthful pagination summary for the table toolbar and footer.
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
 * Format an ISO timestamp consistently for the Philippines operator interface.
 */
function formatDateTime(value: string | null): string {
    if (value === null) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(value));
}

/**
 * Return the semantic text color for a persisted payment status.
 */
function getPaymentStatusClassName(status: string): string {
    switch (status) {
        case 'success':
            return 'text-success';
        case 'pending':
            return 'text-warning';
        case 'failed':
        case 'cancelled':
            return 'text-destructive';
        default:
            return 'text-muted-foreground';
    }
}

/**
 * Render a native server-submitted select with the same visual language as the
 * application's shadcn inputs while retaining an actual empty "All" value.
 */
function FilterSelect({ label, name, value, options }: FilterSelectProps) {
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
                    <option value="">All</option>

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
 * Render one session lifecycle status using repository semantic design tokens.
 */
function SessionStatusBadge({ status }: { status: string }) {
    const presentation = getSessionStatusPresentation(status);
    const Icon = presentation.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                'gap-1.5 rounded-full px-2.5 py-1 font-medium',
                presentation.className,
            )}
        >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {presentation.label}
        </Badge>
    );
}

/**
 * Render the immutable payment evidence attached to one session.
 */
function PaymentDetails({ payment }: { payment: Payment | null }) {
    if (payment === null) {
        return <span className="text-muted-foreground">No payment</span>;
    }

    return (
        <div className="flex flex-col gap-0.5">
            <span className="font-medium">
                {payment.method}
                <span className="mx-1 text-muted-foreground">·</span>
                <span className={getPaymentStatusClassName(payment.status)}>
                    {payment.status}
                </span>
            </span>

            <span className="text-xs text-muted-foreground tabular-nums">
                {payment.amount}
            </span>
        </div>
    );
}

/**
 * Render one print-job state as a compact semantic dot and readable label.
 */
function PrintJobState({ printJob }: { printJob: PrintJob | null }) {
    if (printJob === null) {
        return (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span
                    className="size-1.5 rounded-full bg-muted-foreground/50"
                    aria-hidden="true"
                />
                No print job
            </span>
        );
    }

    const presentation = getPrintStatusPresentation(printJob.status);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-2',
                presentation.textClassName,
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    presentation.dotClassName,
                )}
                aria-hidden="true"
            />
            {presentation.label}
        </span>
    );
}

/**
 * Render the read-only operational Sessions monitoring interface.
 */
export default function SessionsIndex({
    sessions,
    filters,
    statuses,
    paymentStatuses,
    paymentMethods,
    printStatuses,
}: {
    sessions: Paginated<Session>;
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

    const paginationSummary = getPaginationSummary(sessions);

    return (
        <>
            <Head title="Sessions" />

            <div className="flex flex-col gap-5 p-4 md:p-6">
                <header>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Sessions
                        </h1>

                        <Badge
                            variant="outline"
                            className="gap-1.5 border-border bg-muted/60 text-muted-foreground"
                        >
                            <LockKeyhole
                                className="size-3.5"
                                aria-hidden="true"
                            />
                            Read only
                        </Badge>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Read-only view of photobooth sessions, payments, and
                        print jobs
                    </p>
                </header>

                <Form
                    action={sessionsIndex.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                >
                    {() => (
                        <Card className="gap-0 rounded-2xl py-0 shadow-none">
                            <CardContent className="p-5">
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <FilterSelect
                                        label="Status"
                                        name="status"
                                        value={filters.status}
                                        options={statuses}
                                    />

                                    <label className="grid gap-1.5 text-sm font-medium">
                                        <span>From</span>
                                        <Input
                                            key={filters.from ?? 'from-empty'}
                                            type="date"
                                            name="from"
                                            defaultValue={filters.from ?? ''}
                                            className="h-9 w-full"
                                        />
                                    </label>

                                    <label className="grid gap-1.5 text-sm font-medium">
                                        <span>To</span>
                                        <Input
                                            key={filters.to ?? 'to-empty'}
                                            type="date"
                                            name="to"
                                            defaultValue={filters.to ?? ''}
                                            className="h-9 w-full"
                                        />
                                    </label>

                                    <FilterSelect
                                        label="Payment status"
                                        name="payment_status"
                                        value={filters.payment_status}
                                        options={paymentStatuses}
                                    />

                                    <FilterSelect
                                        label="Payment method"
                                        name="payment_method"
                                        value={filters.payment_method}
                                        options={paymentMethods}
                                    />

                                    <FilterSelect
                                        label="Authorization"
                                        name="authorization_type"
                                        value={filters.authorization_type}
                                        options={['voucher', 'payment']}
                                    />

                                    <FilterSelect
                                        label="Print status"
                                        name="print_status"
                                        value={filters.print_status}
                                        options={printStatuses}
                                    />

                                    <div className="flex items-end gap-2">
                                        <Button
                                            type="submit"
                                            className="min-w-20"
                                        >
                                            Filter
                                        </Button>

                                        <Button
                                            asChild
                                            variant="outline"
                                            type="button"
                                        >
                                            <Link href={sessionsIndex()}>
                                                Clear filters
                                            </Link>
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Active filters:
                                    </span>

                                    {activeFilters.length === 0 ? (
                                        <Badge
                                            variant="secondary"
                                            className="font-normal text-muted-foreground"
                                        >
                                            None
                                        </Badge>
                                    ) : (
                                        activeFilters.map((filter) => (
                                            <Badge
                                                key={filter}
                                                variant="outline"
                                                className="font-normal"
                                            >
                                                {filter}
                                            </Badge>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </Form>

                <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none">
                    <div className="flex min-h-12 items-center border-b px-4 sm:px-5">
                        <Rows3
                            className="mr-2 size-4 text-muted-foreground"
                            aria-hidden="true"
                        />

                        <span className="text-sm text-muted-foreground">
                            {paginationSummary}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-sm">
                            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                                <tr>
                                    <th
                                        scope="col"
                                        className="w-[35%] px-5 py-3 font-medium"
                                    >
                                        Session
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[15%] px-4 py-3 font-medium"
                                    >
                                        Status
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[18%] px-4 py-3 font-medium"
                                    >
                                        Payment
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[15%] px-4 py-3 font-medium"
                                    >
                                        Print job
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[17%] px-4 py-3 font-medium"
                                    >
                                        Started
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {sessions.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                                                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                                    <Rows3
                                                        className="size-4 text-muted-foreground"
                                                        aria-hidden="true"
                                                    />
                                                </div>

                                                <p className="mt-3 text-sm font-medium">
                                                    No sessions found.
                                                </p>

                                                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                                    No session records match the
                                                    current filters.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sessions.data.map((session) => (
                                        <tr
                                            key={session.id}
                                            className="border-t transition-colors hover:bg-muted/30"
                                        >
                                            <td className="px-5 py-3">
                                                <span
                                                    className="block font-mono text-[13px] whitespace-nowrap"
                                                    title={session.sessionToken}
                                                >
                                                    {session.sessionToken}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3">
                                                <SessionStatusBadge
                                                    status={session.status}
                                                />
                                            </td>

                                            <td className="px-4 py-3">
                                                <PaymentDetails
                                                    payment={session.payment}
                                                />
                                            </td>

                                            <td className="px-4 py-3">
                                                <PrintJobState
                                                    printJob={session.printJob}
                                                />
                                            </td>

                                            <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                                {session.startedAt !== null ? (
                                                    <time
                                                        dateTime={
                                                            session.startedAt
                                                        }
                                                    >
                                                        {formatDateTime(
                                                            session.startedAt,
                                                        )}
                                                    </time>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <CardFooter className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
                        <span className="text-sm text-muted-foreground">
                            {paginationSummary}
                        </span>

                        <nav
                            aria-label="Sessions pagination"
                            className="flex flex-wrap items-center gap-1"
                        >
                            {sessions.links.map((link, index) => (
                                <Button
                                    key={`${link.label}-${index}`}
                                    asChild={link.url !== null}
                                    variant={
                                        link.active ? 'default' : 'outline'
                                    }
                                    size="sm"
                                    disabled={link.url === null}
                                >
                                    {link.url !== null ? (
                                        <Link
                                            href={link.url}
                                            preserveScroll
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    ) : (
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    )}
                                </Button>
                            ))}
                        </nav>
                    </CardFooter>
                </Card>
            </div>
        </>
    );
}
