import { Form, Head, Link } from '@inertiajs/react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { create, index as templatesIndex } from '@/routes/admin/templates';

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

export default function TemplatesIndex({
    templates,
}: {
    templates: Template[];
}) {
    return (
        <AppLayout
            breadcrumbs={[{ title: 'Templates', href: templatesIndex() }]}
        >
            <Head title="Templates" />

            <div className="flex flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Templates"
                        description="Manage the photo templates available in the kiosk"
                    />

                    <Button asChild>
                        <Link href={create()}>New template</Link>
                    </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                            <tr>
                                <th className="p-3 font-medium">Name</th>
                                <th className="p-3 font-medium">Photo slots</th>
                                <th className="p-3 font-medium">Status</th>
                                <th className="p-3 text-right font-medium">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {templates.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="p-3 text-center text-muted-foreground"
                                    >
                                        No templates yet.
                                    </td>
                                </tr>
                            )}

                            {templates.map((template) => (
                                <tr
                                    key={template.id}
                                    className="border-t border-sidebar-border/70 dark:border-sidebar-border"
                                >
                                    <td className="p-3">{template.name}</td>
                                    <td className="p-3">
                                        {template.photoSlots}
                                    </td>
                                    <td className="p-3">
                                        <Badge
                                            variant={
                                                template.active
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                        >
                                            {template.active
                                                ? 'Active'
                                                : 'Inactive'}
                                        </Badge>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link
                                                    href={TemplateController.edit(
                                                        template.id,
                                                    )}
                                                >
                                                    Edit
                                                </Link>
                                            </Button>

                                            <Form
                                                {...TemplateController.toggle.form(
                                                    template.id,
                                                )}
                                                options={{
                                                    preserveScroll: true,
                                                }}
                                            >
                                                {({ processing }) => (
                                                    <Button
                                                        type="submit"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={processing}
                                                    >
                                                        {template.active
                                                            ? 'Disable'
                                                            : 'Enable'}
                                                    </Button>
                                                )}
                                            </Form>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                    >
                                                        Delete
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogTitle>
                                                        Delete "{template.name}
                                                        "?
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        This cannot be undone.
                                                        Templates that are still
                                                        referenced by photobooth
                                                        sessions cannot be
                                                        deleted.
                                                    </DialogDescription>

                                                    <Form
                                                        {...TemplateController.destroy.form(
                                                            template.id,
                                                        )}
                                                        options={{
                                                            preserveScroll: true,
                                                        }}
                                                    >
                                                        {({
                                                            processing,
                                                            errors,
                                                        }) => (
                                                            <>
                                                                {errors.template && (
                                                                    <p className="text-sm text-destructive">
                                                                        {
                                                                            errors.template
                                                                        }
                                                                    </p>
                                                                )}

                                                                <DialogFooter className="gap-2">
                                                                    <DialogClose
                                                                        asChild
                                                                    >
                                                                        <Button variant="secondary">
                                                                            Cancel
                                                                        </Button>
                                                                    </DialogClose>

                                                                    <Button
                                                                        type="submit"
                                                                        variant="destructive"
                                                                        disabled={
                                                                            processing
                                                                        }
                                                                    >
                                                                        Delete
                                                                    </Button>
                                                                </DialogFooter>
                                                            </>
                                                        )}
                                                    </Form>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
