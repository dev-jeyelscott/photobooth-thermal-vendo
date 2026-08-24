import { Head, setLayoutProps } from '@inertiajs/react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
import { create, index } from '@/routes/admin/stickers';
import StickerForm from './sticker-form';
import type { TemplateOption } from './sticker-form';

/**
 * Render sticker creation inside the resolver-owned admin layout.
 */
export default function StickersCreate({
    templates,
}: {
    templates: TemplateOption[];
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Stickers', href: index() },
            { title: 'Create', href: create() },
        ],
    });

    return (
        <>
            <Head title="Create Sticker" />

            <StickerForm
                form={StickerController.store.form()}
                templates={templates}
            />
        </>
    );
}
