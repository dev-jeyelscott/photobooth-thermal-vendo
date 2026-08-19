import { Head } from '@inertiajs/react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { create, index } from '@/routes/admin/vouchers';
import VoucherForm from './voucher-form';

export default function VouchersCreate() {
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Vouchers', href: index() },
                { title: 'New voucher', href: create() },
            ]}
        >
            <Head title="New voucher" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="New voucher"
                    description="Generate a voucher code for the kiosk"
                />

                <VoucherForm form={VoucherController.store.form()} />
            </div>
        </AppLayout>
    );
}
