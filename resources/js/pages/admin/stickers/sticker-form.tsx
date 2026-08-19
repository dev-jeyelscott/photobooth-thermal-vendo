import { Form } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RouteFormDefinition } from '@/wayfinder';

type Sticker = {
    id: number;
    name: string;
    assetPath: string;
    thumbnailPath: string | null;
    active: boolean;
};

export default function StickerForm({
    form,
    sticker,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    sticker?: Sticker;
}) {
    const [assetPreview, setAssetPreview] = useState<string | null>(null);

    return (
        <Form
            {...form}
            options={{ preserveScroll: true }}
            className="max-w-xl space-y-6"
        >
            {({ processing, errors }) => (
                <>
                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            defaultValue={sticker?.name}
                            placeholder="Party Hat"
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="asset">Sticker asset</Label>
                        <Input
                            id="asset"
                            name="asset"
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                setAssetPreview(
                                    file ? URL.createObjectURL(file) : null,
                                );
                            }}
                        />
                        {sticker?.assetPath && !assetPreview && (
                            <p className="text-sm text-muted-foreground">
                                Current: {sticker.assetPath}
                            </p>
                        )}
                        {assetPreview && (
                            <img
                                src={assetPreview}
                                alt="Sticker preview"
                                className="h-24 w-24 rounded-md border border-sidebar-border/70 object-contain dark:border-sidebar-border"
                            />
                        )}
                        <InputError message={errors.asset} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="thumbnail">Thumbnail (optional)</Label>
                        <Input
                            id="thumbnail"
                            name="thumbnail"
                            type="file"
                            accept="image/*"
                        />
                        {sticker?.thumbnailPath && (
                            <p className="text-sm text-muted-foreground">
                                Current: {sticker.thumbnailPath}
                            </p>
                        )}
                        <InputError message={errors.thumbnail} />
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="active"
                            name="active"
                            defaultChecked={sticker?.active ?? true}
                        />
                        <Label htmlFor="active">Active</Label>
                    </div>

                    <Button type="submit" disabled={processing}>
                        {sticker ? 'Save changes' : 'Create sticker'}
                    </Button>
                </>
            )}
        </Form>
    );
}
