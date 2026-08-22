import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index as sessionsIndex } from '@/routes/admin/sessions';

type Payment = {
    method: string;
    status: string;
    amount: string;
};

type PrintJob = {
    status: string;
    attemptCount: number;
    completedAt: string | null;
};

type Session = {
    id: number;
    sessionToken: string;
    status: string;
    startedAt: string | null;
    expiresAt: string | null;
    payment: Payment | null;
    printJob: PrintJob | null;
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
    payment_status: string | null;
    payment_method: string | null;
    authorization_type: string | null;
    print_status: string | null;
};

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

    return (
        <>
            <Head title="Sessions" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Sessions"
                    description="Read-only view of photobooth sessions, payments, and print jobs"
                />

                <Form
                    action={sessionsIndex.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                    className="flex flex-wrap items-end gap-3"
                >
                    {() => (
                        <>
                            <label className="flex flex-col gap-1 text-sm">
                                Status
                                <select
                                    name="status"
                                    defaultValue={filters.status ?? ''}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="">All</option>
                                    {statuses.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                From
                                <Input
                                    type="date"
                                    name="from"
                                    defaultValue={filters.from ?? ''}
                                />
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                To
                                <Input
                                    type="date"
                                    name="to"
                                    defaultValue={filters.to ?? ''}
                                />
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                Payment status
                                <select
                                    name="payment_status"
                                    defaultValue={filters.payment_status ?? ''}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="">All</option>
                                    {paymentStatuses.map((paymentStatus) => (
                                        <option
                                            key={paymentStatus}
                                            value={paymentStatus}
                                        >
                                            {paymentStatus}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                Payment method
                                <select
                                    name="payment_method"
                                    defaultValue={filters.payment_method ?? ''}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="">All</option>
                                    {paymentMethods.map((paymentMethod) => (
                                        <option
                                            key={paymentMethod}
                                            value={paymentMethod}
                                        >
                                            {paymentMethod}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                Authorization
                                <select
                                    name="authorization_type"
                                    defaultValue={
                                        filters.authorization_type ?? ''
                                    }
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="">All</option>
                                    <option value="voucher">Voucher</option>
                                    <option value="payment">Payment</option>
                                </select>
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                Print status
                                <select
                                    name="print_status"
                                    defaultValue={filters.print_status ?? ''}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="">All</option>
                                    {printStatuses.map((printStatus) => (
                                        <option
                                            key={printStatus}
                                            value={printStatus}
                                        >
                                            {printStatus}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <Button type="submit">Filter</Button>
                        </>
                    )}
                </Form>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                            <tr>
                                <th className="p-3 font-medium">Session</th>
                                <th className="p-3 font-medium">Status</th>
                                <th className="p-3 font-medium">Payment</th>
                                <th className="p-3 font-medium">Print job</th>
                                <th className="p-3 font-medium">Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="p-3 text-center text-muted-foreground"
                                    >
                                        No sessions found.
                                    </td>
                                </tr>
                            )}

                            {sessions.data.map((session) => (
                                <tr
                                    key={session.id}
                                    className="border-t border-sidebar-border/70 dark:border-sidebar-border"
                                >
                                    <td className="p-3 font-mono">
                                        {session.sessionToken}
                                    </td>
                                    <td className="p-3">
                                        <Badge variant="secondary">
                                            {session.status}
                                        </Badge>
                                    </td>
                                    <td className="p-3">
                                        {session.payment ? (
                                            <div className="flex flex-col">
                                                <span>
                                                    {session.payment.method}{' '}
                                                    &middot;{' '}
                                                    {session.payment.status}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {session.payment.amount}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                No payment
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {session.printJob ? (
                                            session.printJob.status
                                        ) : (
                                            <span className="text-muted-foreground">
                                                No print job
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {session.startedAt
                                            ? new Date(
                                                  session.startedAt,
                                              ).toLocaleString()
                                            : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        {sessions.total > 0
                            ? `Showing ${sessions.from}–${sessions.to} of ${sessions.total}`
                            : null}
                    </span>

                    <div className="flex gap-1">
                        {sessions.links.map((link, index) => (
                            <Button
                                key={index}
                                asChild={link.url !== null}
                                variant={link.active ? 'default' : 'outline'}
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
                    </div>
                </div>
            </div>
        </>
    );
}
