import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index as paymentsIndex } from '@/routes/admin/payments';

type Payment = {
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

    return (
        <>
            <Head title="Payments" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Payments"
                    description="Read-only view of payment evidence for operational visibility"
                />

                <Form
                    action={paymentsIndex.url()}
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

                            <Button type="submit">Filter</Button>
                        </>
                    )}
                </Form>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                            <tr>
                                <th className="p-3 font-medium">Session</th>
                                <th className="p-3 font-medium">Method</th>
                                <th className="p-3 font-medium">Status</th>
                                <th className="p-3 font-medium">Maya payment ID</th>
                                <th className="p-3 font-medium">Maya checkout ID</th>
                                <th className="p-3 font-medium">Amount</th>
                                <th className="p-3 font-medium">Created</th>
                                <th className="p-3 font-medium">Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="p-3 text-center text-muted-foreground"
                                    >
                                        No payments found.
                                    </td>
                                </tr>
                            )}

                            {payments.data.map((payment) => (
                                <tr
                                    key={payment.id}
                                    className="border-t border-sidebar-border/70 dark:border-sidebar-border"
                                >
                                    <td className="p-3 font-mono">
                                        {payment.sessionToken ?? '—'}
                                    </td>
                                    <td className="p-3">{payment.method}</td>
                                    <td className="p-3">
                                        <Badge variant="secondary">
                                            {payment.status}
                                        </Badge>
                                    </td>
                                    <td className="p-3 font-mono">
                                        {payment.mayaPaymentId ?? '—'}
                                    </td>
                                    <td className="p-3 font-mono">
                                        {payment.mayaCheckoutId ?? '—'}
                                    </td>
                                    <td className="p-3">{payment.amount}</td>
                                    <td className="p-3">
                                        {payment.createdAt
                                            ? new Date(
                                                  payment.createdAt,
                                              ).toLocaleString()
                                            : '—'}
                                    </td>
                                    <td className="p-3">
                                        {payment.updatedAt
                                            ? new Date(
                                                  payment.updatedAt,
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
                        {payments.total > 0
                            ? `Showing ${payments.from}–${payments.to} of ${payments.total}`
                            : null}
                    </span>

                    <div className="flex gap-1">
                        {payments.links.map((link, index) => (
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
