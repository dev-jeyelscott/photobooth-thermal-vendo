import { Head, setLayoutProps } from '@inertiajs/react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
import { index } from '@/routes/admin/stickers';
import StickerForm from './sticker-form';
import type { Sticker, TemplateOption } from './sticker-form';

/**
 * Render sticker editing inside the resolver-owned admin layout.
 */
export default function StickersEdit({
    sticker,
    templates,
}: {
    sticker: Sticker;
    templates: TemplateOption[];
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Stickers', href: index() },
            {
                title: 'Edit',
                href: StickerController.edit(sticker.id).url,
            },
        ],
    });

    return (
        <>
            <Head title={`Edit ${sticker.name}`} />

            <StickerForm
                form={StickerController.update.form(sticker.id)}
                sticker={sticker}
                templates={templates}
            />
        </>
    );
}
