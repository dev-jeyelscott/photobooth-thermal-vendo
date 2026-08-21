import { Head, setLayoutProps } from '@inertiajs/react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
import Heading from '@/components/heading';
import { create, index } from '@/routes/admin/stickers';
import StickerForm from './sticker-form';

export default function StickersCreate() {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Stickers', href: index() },
            { title: 'New sticker', href: create() },
        ],
    });

    return (
        <>
            <Head title="New sticker" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="New sticker"
                    description="Add a sticker overlay design for the kiosk"
                />

                <StickerForm form={StickerController.store.form()} />
            </div>
        </>
    );
}
