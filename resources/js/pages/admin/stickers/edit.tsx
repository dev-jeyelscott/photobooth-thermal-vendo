import { Head } from '@inertiajs/react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { index } from '@/routes/admin/stickers';
import StickerForm from './sticker-form';

type Sticker = {
    id: number;
    name: string;
    assetPath: string;
    thumbnailPath: string | null;
    active: boolean;
};

export default function StickersEdit({ sticker }: { sticker: Sticker }) {
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Stickers', href: index() },
                {
                    title: sticker.name,
                    href: StickerController.edit(sticker.id).url,
                },
            ]}
        >
            <Head title={`Edit ${sticker.name}`} />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Edit sticker"
                    description="Update the sticker's details and assets"
                />

                <StickerForm
                    form={StickerController.update.form(sticker.id)}
                    sticker={sticker}
                />
            </div>
        </AppLayout>
    );
}
