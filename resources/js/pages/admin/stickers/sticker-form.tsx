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
    assetUrl: string;
    thumbnailPath: string | null;
    thumbnailUrl: string | null;
    active: boolean;
    sortOrder: number;
    placement: Record<string, unknown> | null;
    templateIds: number[];
};

/**
 * Renders the shared create/edit form for admin sticker management.
 */
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
                            aria-invalid={!!errors.name}
                            aria-describedby={
                                errors.name ? 'name-error' : undefined
                            }
                        />
                        <InputError id="name-error" message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="asset">Sticker asset</Label>
                        <Input
                            id="asset"
                            name="asset"
                            type="file"
                            accept="image/*"
                            required={!sticker}
                            onChange={(event) => {
                                const file = event.target.files?.[0];

                                setAssetPreview(
                                    file ? URL.createObjectURL(file) : null,
                                );
                            }}
                            aria-invalid={!!errors.asset}
                            aria-describedby={
                                errors.asset ? 'asset-error' : undefined
                            }
                        />

                        {sticker && !assetPreview && (
                            <div className="flex items-center gap-3">
                                <img
                                    src={sticker.assetUrl}
                                    alt="Current sticker asset"
                                    className="h-24 w-24 rounded-md border border-sidebar-border/70 object-contain dark:border-sidebar-border"
                                />

                                <div className="grid gap-1">
                                    <a
                                        href={sticker.assetUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-primary underline underline-offset-4"
                                    >
                                        View current sticker asset
                                    </a>

                                    <span className="text-xs text-muted-foreground">
                                        {sticker.assetPath}
                                    </span>
                                </div>
                            </div>
                        )}

                        {assetPreview && (
                            <img
                                src={assetPreview}
                                alt="Sticker preview"
                                className="h-24 w-24 rounded-md border border-sidebar-border/70 object-contain dark:border-sidebar-border"
                            />
                        )}

                        <InputError id="asset-error" message={errors.asset} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="thumbnail">Thumbnail (optional)</Label>
                        <Input
                            id="thumbnail"
                            name="thumbnail"
                            type="file"
                            accept="image/*"
                            aria-invalid={!!errors.thumbnail}
                            aria-describedby={
                                errors.thumbnail ? 'thumbnail-error' : undefined
                            }
                        />

                        {sticker?.thumbnailUrl && (
                            <div className="flex items-center gap-3">
                                <img
                                    src={sticker.thumbnailUrl}
                                    alt="Current sticker thumbnail"
                                    className="h-24 w-24 rounded-md border border-sidebar-border/70 object-contain dark:border-sidebar-border"
                                />

                                <div className="grid gap-1">
                                    <a
                                        href={sticker.thumbnailUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-primary underline underline-offset-4"
                                    >
                                        View current thumbnail
                                    </a>

                                    {sticker.thumbnailPath && (
                                        <span className="text-xs text-muted-foreground">
                                            {sticker.thumbnailPath}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <InputError
                            id="thumbnail-error"
                            message={errors.thumbnail}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="sort_order">Sort order</Label>
                        <Input
                            id="sort_order"
                            name="sort_order"
                            type="number"
                            min={0}
                            defaultValue={sticker?.sortOrder ?? 0}
                            aria-invalid={!!errors.sort_order}
                            aria-describedby={
                                errors.sort_order
                                    ? 'sort_order-error'
                                    : undefined
                            }
                        />
                        <InputError
                            id="sort_order-error"
                            message={errors.sort_order}
                        />
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
                            aria-invalid={!!errors.placement}
                            aria-describedby={
                                errors.placement ? 'placement-error' : undefined
                            }
                            className="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                        />
                        <InputError
                            id="placement-error"
                            message={errors.placement}
                        />
                    </div>

                    <fieldset className="grid gap-2">
                        <legend className="text-sm leading-none font-medium">
                            Compatible templates (none selected means all
                            templates)
                        </legend>

                        <div
                            className="flex flex-col gap-2"
                            aria-describedby={
                                errors.template_ids
                                    ? 'template_ids-error'
                                    : undefined
                            }
                        >
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

                        <InputError
                            id="template_ids-error"
                            message={errors.template_ids}
                        />
                    </fieldset>

                    <div className="flex items-center space-x-3">
                        <input type="hidden" name="active" value="0" />

                        <Checkbox
                            id="active"
                            name="active"
                            value="1"
                            defaultChecked={sticker?.active ?? true}
                            aria-invalid={!!errors.active}
                            aria-describedby={
                                errors.active ? 'active-error' : undefined
                            }
                        />

                        <Label htmlFor="active">Active</Label>
                    </div>

                    <InputError id="active-error" message={errors.active} />

                    <Button type="submit" disabled={processing}>
                        {sticker ? 'Save changes' : 'Create sticker'}
                    </Button>
                </>
            )}
        </Form>
    );
}
