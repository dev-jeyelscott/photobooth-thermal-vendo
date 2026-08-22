import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { create, index as vouchersIndex } from '@/routes/admin/vouchers';

type Redemption = {
    sessionToken: string;
    startedAt: string | null;
};

type Voucher = {
    id: number;
    code: string;
    active: boolean;
    validFrom: string | null;
    expiresAt: string | null;
    usageLimit: number;
    usageCount: number;
    redemptions: Redemption[];
};

export default function VouchersIndex({ vouchers }: { vouchers: Voucher[] }) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Vouchers', href: vouchersIndex() }],
    });

    return (
        <>
            <Head title="Vouchers" />

            <div className="flex flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Vouchers"
                        description="Generate and manage vouchers for the kiosk"
                    />

                    <Button asChild>
                        <Link href={create()}>New voucher</Link>
                    </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                            <tr>
                                <th className="p-3 font-medium">Code</th>
                                <th className="p-3 font-medium">Usage</th>
                                <th className="p-3 font-medium">Expires</th>
                                <th className="p-3 font-medium">Status</th>
                                <th className="p-3 font-medium">Redemptions</th>
                                <th className="p-3 text-right font-medium">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {vouchers.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="p-3 text-center text-muted-foreground"
                                    >
                                        No vouchers yet.
                                    </td>
                                </tr>
                            )}

                            {vouchers.map((voucher) => (
                                <tr
                                    key={voucher.id}
                                    className="border-t border-sidebar-border/70 dark:border-sidebar-border"
                                >
                                    <td className="p-3 font-mono">
                                        {voucher.code}
                                    </td>
                                    <td className="p-3">
                                        {voucher.usageCount} /{' '}
                                        {voucher.usageLimit}
                                    </td>
                                    <td className="p-3">
                                        {voucher.expiresAt
                                            ? new Date(
                                                  voucher.expiresAt,
                                              ).toLocaleDateString()
                                            : 'Never'}
                                    </td>
                                    <td className="p-3">
                                        <Badge
                                            variant={
                                                voucher.active
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                        >
                                            {voucher.active
                                                ? 'Active'
                                                : 'Inactive'}
                                        </Badge>
                                    </td>
                                    <td className="p-3">
                                        {voucher.redemptions.length === 0 ? (
                                            <span className="text-muted-foreground">
                                                None
                                            </span>
                                        ) : (
                                            <ul className="space-y-1">
                                                {voucher.redemptions.map(
                                                    (redemption) => (
                                                        <li
                                                            key={
                                                                redemption.sessionToken
                                                            }
                                                            className="flex flex-col text-xs"
                                                        >
                                                            <span className="font-mono">
                                                                {
                                                                    redemption.sessionToken
                                                                }
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {redemption.startedAt
                                                                    ? new Date(
                                                                          redemption.startedAt,
                                                                      ).toLocaleString()
                                                                    : 'Not started'}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link
                                                    href={VoucherController.edit(
                                                        voucher.id,
                                                    )}
                                                >
                                                    Edit
                                                </Link>
                                            </Button>

                                            <Form
                                                {...VoucherController.toggle.form(
                                                    voucher.id,
                                                )}
                                                options={{
                                                    preserveScroll: true,
                                                }}
                                            >
                                                {({ processing }) => (
                                                    <Button
                                                        type="submit"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={processing}
                                                    >
                                                        {voucher.active
                                                            ? 'Disable'
                                                            : 'Enable'}
                                                    </Button>
                                                )}
                                            </Form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
