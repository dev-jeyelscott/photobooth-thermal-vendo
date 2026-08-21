import { Form } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RouteFormDefinition } from '@/wayfinder';

export type TemplateOption = {
    id: number;
    name: string;
};

export type Sticker = {
    id: number;
    name: string;
    assetPath: string;
    thumbnailPath: string | null;
    active: boolean;
    sortOrder: number;
    placement: Record<string, unknown> | null;
    templateIds: number[];
};

export default function StickerForm({
    form,
    sticker,
    templates,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    sticker?: Sticker;
    templates: TemplateOption[];
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

                    <div className="grid gap-2">
                        <Label htmlFor="sort_order">Sort order</Label>
                        <Input
                            id="sort_order"
                            name="sort_order"
                            type="number"
                            min={0}
                            defaultValue={sticker?.sortOrder ?? 0}
                        />
                        <InputError message={errors.sort_order} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="placement">
                            Placement (JSON, optional)
                        </Label>
                        <textarea
                            id="placement"
                            name="placement"
                            rows={4}
                            defaultValue={
                                sticker?.placement
                                    ? JSON.stringify(sticker.placement, null, 2)
                                    : ''
                            }
                            placeholder='{"size_ratio": 0.22, "margin_ratio": 0.03}'
                            className="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none md:text-sm"
                        />
                        <InputError message={errors.placement} />
                    </div>

                    <div className="grid gap-2">
                        <Label>
                            Compatible templates (none selected means all
                            templates)
                        </Label>
                        <div className="flex flex-col gap-2">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="flex items-center space-x-3"
                                >
                                    <Checkbox
                                        id={`template_${template.id}`}
                                        name="template_ids[]"
                                        value={String(template.id)}
                                        defaultChecked={sticker?.templateIds.includes(
                                            template.id,
                                        )}
                                    />
                                    <Label htmlFor={`template_${template.id}`}>
                                        {template.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <InputError message={errors.template_ids} />
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
