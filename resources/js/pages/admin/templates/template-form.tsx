import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RouteFormDefinition } from '@/wayfinder';

type Template = {
    id: number;
    name: string;
    slug: string;
    orientation: 'portrait' | 'landscape';
    layoutPath: string;
    layoutUrl?: string;
    thumbnailPath: string | null;
    thumbnailUrl?: string | null;
    photoSlots: number;
    printWidthMm: number;
    printHeightMm: number;
    active: boolean;
    sortOrder: number;
    printerCompatibility: Record<string, unknown> | null;
};

export default function TemplateForm({
    form,
    template,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    template?: Template;
}) {
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
                            defaultValue={template?.name}
                            placeholder="Classic Strip"
                            aria-invalid={!!errors.name}
                            aria-describedby={
                                errors.name ? 'name-error' : undefined
                            }
                        />
                        <InputError id="name-error" message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                            id="slug"
                            name="slug"
                            required
                            defaultValue={template?.slug}
                            placeholder="classic-strip"
                            aria-invalid={!!errors.slug}
                            aria-describedby={
                                errors.slug ? 'slug-error' : undefined
                            }
                        />
                        <InputError id="slug-error" message={errors.slug} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="orientation">Orientation</Label>
                        <select
                            id="orientation"
                            name="orientation"
                            required
                            defaultValue={template?.orientation ?? 'portrait'}
                            aria-invalid={!!errors.orientation}
                            aria-describedby={
                                errors.orientation
                                    ? 'orientation-error'
                                    : undefined
                            }
                            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                        >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                        <InputError
                            id="orientation-error"
                            message={errors.orientation}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="layout">Layout asset</Label>
                        <Input
                            id="layout"
                            name="layout"
                            type="file"
                            accept="image/*"
                            required={!template}
                            aria-invalid={!!errors.layout}
                            aria-describedby={
                                errors.layout ? 'layout-error' : undefined
                            }
                        />
                        {template?.layoutUrl ? (
                            <a
                                href={template.layoutUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary underline underline-offset-4"
                            >
                                View current layout asset
                            </a>
                        ) : template?.layoutPath ? (
                            <p className="text-sm text-muted-foreground">
                                Current: {template.layoutPath}
                            </p>
                        ) : null}
                        <InputError id="layout-error" message={errors.layout} />
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
                        {template?.thumbnailUrl ? (
                            <a
                                href={template.thumbnailUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary underline underline-offset-4"
                            >
                                View current thumbnail
                            </a>
                        ) : template?.thumbnailPath ? (
                            <p className="text-sm text-muted-foreground">
                                Current: {template.thumbnailPath}
                            </p>
                        ) : null}
                        <InputError
                            id="thumbnail-error"
                            message={errors.thumbnail}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="photo_slots">Photo slots</Label>
                        <Input
                            id="photo_slots"
                            name="photo_slots"
                            type="number"
                            min={1}
                            required
                            defaultValue={template?.photoSlots ?? 1}
                            aria-invalid={!!errors.photo_slots}
                            aria-describedby={
                                errors.photo_slots
                                    ? 'photo_slots-error'
                                    : undefined
                            }
                        />
                        <InputError
                            id="photo_slots-error"
                            message={errors.photo_slots}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="print_width_mm">
                                Print width (mm)
                            </Label>
                            <Input
                                id="print_width_mm"
                                name="print_width_mm"
                                type="number"
                                min={1}
                                required
                                defaultValue={template?.printWidthMm ?? 100}
                                aria-invalid={!!errors.print_width_mm}
                                aria-describedby={
                                    errors.print_width_mm
                                        ? 'print_width_mm-error'
                                        : undefined
                                }
                            />
                            <InputError
                                id="print_width_mm-error"
                                message={errors.print_width_mm}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="print_height_mm">
                                Print height (mm)
                            </Label>
                            <Input
                                id="print_height_mm"
                                name="print_height_mm"
                                type="number"
                                min={1}
                                required
                                defaultValue={template?.printHeightMm ?? 150}
                                aria-invalid={!!errors.print_height_mm}
                                aria-describedby={
                                    errors.print_height_mm
                                        ? 'print_height_mm-error'
                                        : undefined
                                }
                            />
                            <InputError
                                id="print_height_mm-error"
                                message={errors.print_height_mm}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="sort_order">Sort order</Label>
                        <Input
                            id="sort_order"
                            name="sort_order"
                            type="number"
                            min={0}
                            defaultValue={template?.sortOrder ?? 0}
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
                        <Label htmlFor="printer_compatibility">
                            Printer compatibility (JSON, optional)
                        </Label>
                        <textarea
                            id="printer_compatibility"
                            name="printer_compatibility"
                            rows={4}
                            defaultValue={
                                template?.printerCompatibility
                                    ? JSON.stringify(
                                          template.printerCompatibility,
                                          null,
                                          2,
                                      )
                                    : ''
                            }
                            placeholder='{"paperWidthsMm": [100], "printerIds": ["dnp-ds620"]}'
                            aria-invalid={!!errors.printer_compatibility}
                            aria-describedby={
                                errors.printer_compatibility
                                    ? 'printer_compatibility-error'
                                    : undefined
                            }
                            className="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                        />
                        <InputError
                            id="printer_compatibility-error"
                            message={errors.printer_compatibility}
                        />
                    </div>

                    <div className="flex items-center space-x-3">
                        <input type="hidden" name="active" value="0" />
                        <Checkbox
                            id="active"
                            name="active"
                            value="1"
                            defaultChecked={template?.active ?? true}
                            aria-invalid={!!errors.active}
                            aria-describedby={
                                errors.active ? 'active-error' : undefined
                            }
                        />
                        <Label htmlFor="active">Active</Label>
                    </div>
                    <InputError id="active-error" message={errors.active} />

                    <Button type="submit" disabled={processing}>
                        {template ? 'Save changes' : 'Create template'}
                    </Button>
                </>
            )}
        </Form>
    );
}
