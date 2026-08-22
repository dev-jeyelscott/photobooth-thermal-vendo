import { Head, setLayoutProps } from '@inertiajs/react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import Heading from '@/components/heading';
import { index } from '@/routes/admin/vouchers';
import VoucherForm, { VoucherRedemptionHistory } from './voucher-form';

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

export default function VouchersEdit({ voucher }: { voucher: Voucher }) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Vouchers', href: index() },
            {
                title: voucher.code,
                href: VoucherController.edit(voucher.id).url,
            },
        ],
    });

    return (
        <>
            <Head title={`Edit ${voucher.code}`} />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Edit voucher"
                    description="Update the voucher's expiration and usage limit"
                />

                <VoucherForm
                    form={VoucherController.update.form(voucher.id)}
                    voucher={voucher}
                />

                <VoucherRedemptionHistory redemptions={voucher.redemptions} />
            </div>
        </>
    );
}
