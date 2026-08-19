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
    layoutPath: string;
    thumbnailPath: string | null;
    photoSlots: number;
    printWidthMm: number;
    printHeightMm: number;
    active: boolean;
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
