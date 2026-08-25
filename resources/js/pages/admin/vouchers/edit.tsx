import { Head, setLayoutProps } from '@inertiajs/react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import { index } from '@/routes/admin/vouchers';
import VoucherForm from './voucher-form';
import type { Voucher } from './voucher-form';

/**
 * Render voucher editing inside the resolver-owned admin layout.
 */
export default function VouchersEdit({ voucher }: { voucher: Voucher }) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Vouchers', href: index() },
            {
                title: 'Edit',
                href: VoucherController.edit(voucher.id).url,
            },
        ],
    });

    return (
        <>
            <Head title={`Edit ${voucher.code}`} />
            <VoucherForm
                form={VoucherController.update.form(voucher.id)}
                voucher={voucher}
            />
        </>
    );
}
