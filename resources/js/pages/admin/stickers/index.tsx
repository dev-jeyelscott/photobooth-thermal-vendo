import { Form, Head, Link } from '@inertiajs/react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
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
import { create, index as stickersIndex } from '@/routes/admin/stickers';

type Sticker = {
    id: number;
    name: string;
    assetPath: string;
    thumbnailPath: string | null;
    active: boolean;
};

export default function StickersIndex({ stickers }: { stickers: Sticker[] }) {
    return (
        <AppLayout
            breadcrumbs={[{ title: 'Stickers', href: stickersIndex() }]}
        >
            <Head title="Stickers" />

            <div className="flex flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Stickers"
                        description="Manage the sticker overlays available in the kiosk"
                    />

                    <Button asChild>
                        <Link href={create()}>New sticker</Link>
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {stickers.length === 0 && (
                        <p className="text-center text-muted-foreground">
                            No stickers yet.
                        </p>
                    )}

                    {stickers.map((sticker) => (
                        <div
                            key={sticker.id}
                            className="flex flex-col gap-3 rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border"
                        >
                            <div className="flex items-center justify-center rounded-md bg-muted/50 p-4">
                                <img
                                    src={`/storage/${sticker.thumbnailPath ?? sticker.assetPath}`}
                                    alt={sticker.name}
                                    className="h-24 w-24 object-contain"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {sticker.name}
                                </span>
                                <Badge
                                    variant={
                                        sticker.active
                                            ? 'default'
                                            : 'secondary'
                                    }
                                >
                                    {sticker.active ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        href={StickerController.edit(
                                            sticker.id,
                                        )}
                                    >
                                        Edit
                                    </Link>
                                </Button>

                                <Form
                                    {...StickerController.toggle.form(
                                        sticker.id,
                                    )}
                                    options={{ preserveScroll: true }}
                                >
                                    {({ processing }) => (
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            size="sm"
                                            disabled={processing}
                                        >
                                            {sticker.active
                                                ? 'Disable'
                                                : 'Enable'}
                                        </Button>
                                    )}
                                </Form>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            Delete
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogTitle>
                                            Delete "{sticker.name}"?
                                        </DialogTitle>
                                        <DialogDescription>
                                            This cannot be undone. Stickers
                                            that are still referenced by
                                            photobooth sessions cannot be
                                            deleted.
                                        </DialogDescription>

                                        <Form
                                            {...StickerController.destroy.form(
                                                sticker.id,
                                            )}
                                            options={{
                                                preserveScroll: true,
                                            }}
                                        >
                                            {({ processing, errors }) => (
                                                <>
                                                    {errors.sticker && (
                                                        <p className="text-sm text-destructive">
                                                            {errors.sticker}
                                                        </p>
                                                    )}

                                                    <DialogFooter className="gap-2">
                                                        <DialogClose asChild>
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
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
