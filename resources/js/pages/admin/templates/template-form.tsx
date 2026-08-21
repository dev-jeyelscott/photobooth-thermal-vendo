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
    thumbnailPath: string | null;
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
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                            id="slug"
                            name="slug"
                            required
                            defaultValue={template?.slug}
                            placeholder="classic-strip"
                        />
                        <InputError message={errors.slug} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="orientation">Orientation</Label>
                        <select
                            id="orientation"
                            name="orientation"
                            required
                            defaultValue={template?.orientation ?? 'portrait'}
                            className="border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm"
                        >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                        <InputError message={errors.orientation} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="layout">Layout asset</Label>
                        <Input
                            id="layout"
                            name="layout"
                            type="file"
                            accept="image/*"
                        />
                        {template?.layoutPath && (
                            <p className="text-sm text-muted-foreground">
                                Current: {template.layoutPath}
                            </p>
                        )}
                        <InputError message={errors.layout} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="thumbnail">Thumbnail (optional)</Label>
                        <Input
                            id="thumbnail"
                            name="thumbnail"
                            type="file"
                            accept="image/*"
                        />
                        {template?.thumbnailPath && (
                            <p className="text-sm text-muted-foreground">
                                Current: {template.thumbnailPath}
                            </p>
                        )}
                        <InputError message={errors.thumbnail} />
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
                        />
                        <InputError message={errors.photo_slots} />
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
                            />
                            <InputError message={errors.print_width_mm} />
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
                            />
                            <InputError message={errors.print_height_mm} />
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
                        />
                        <InputError message={errors.sort_order} />
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
                            className="border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none md:text-sm"
                        />
                        <InputError message={errors.printer_compatibility} />
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="active"
                            name="active"
                            defaultChecked={template?.active ?? true}
                        />
                        <Label htmlFor="active">Active</Label>
                    </div>

                    <Button type="submit" disabled={processing}>
                        {template ? 'Save changes' : 'Create template'}
                    </Button>
                </>
            )}
        </Form>
    );
}
