import { Head, setLayoutProps } from '@inertiajs/react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import { create, index } from '@/routes/admin/vouchers';
import VoucherForm from './voucher-form';

/**
 * Render voucher creation inside the resolver-owned admin layout.
 */
export default function VouchersCreate() {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Vouchers', href: index() },
            { title: 'Create', href: create() },
        ],
    });

    return (
        <>
            <Head title="Create voucher" />
            <VoucherForm form={VoucherController.store.form()} />
        </>
    );
}
