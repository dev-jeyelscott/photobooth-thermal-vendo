import { Head, setLayoutProps } from '@inertiajs/react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
import Heading from '@/components/heading';
import { index } from '@/routes/admin/stickers';
import StickerForm from './sticker-form';
import type { Sticker, TemplateOption } from './sticker-form';

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
                title: sticker.name,
                href: StickerController.edit(sticker.id).url,
            },
        ],
    });

    return (
        <>
            <Head title={`Edit ${sticker.name}`} />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Edit sticker"
                    description="Update the sticker's details and assets"
                />

                <StickerForm
                    form={StickerController.update.form(sticker.id)}
                    sticker={sticker}
                    templates={templates}
                />
            </div>
        </>
    );
}
