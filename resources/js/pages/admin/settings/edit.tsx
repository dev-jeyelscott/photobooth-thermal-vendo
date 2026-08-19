import { Form, Head } from '@inertiajs/react';
import SettingController from '@/actions/App/Http/Controllers/Admin/SettingController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { edit } from '@/routes/admin/settings';

type Settings = {
    session_price: number;
    retake_limit: number;
    session_timeout_seconds: number;
    gallery_expiration_hours: number;
    gif_frame_duration_ms: number;
    default_printer: string;
    booth_display_name: string;
};

export default function SettingsEdit({ settings }: { settings: Settings }) {
    return (
        <AppLayout breadcrumbs={[{ title: 'Settings', href: edit() }]}>
            <Head title="System settings" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="System settings"
                    description="Configure pricing, session behavior, and booth identity"
                />

                <Form
                    {...SettingController.update.form()}
                    options={{ preserveScroll: true }}
                    className="max-w-xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="session_price">
                                    Session price (PHP)
                                </Label>
                                <Input
                                    id="session_price"
                                    name="session_price"
                                    type="number"
                                    step="0.01"
                                    min={0.01}
                                    required
                                    defaultValue={settings.session_price}
                                />
                                <InputError message={errors.session_price} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="retake_limit">
                                    Retake limit
                                </Label>
                                <Input
                                    id="retake_limit"
                                    name="retake_limit"
                                    type="number"
                                    min={1}
                                    required
                                    defaultValue={settings.retake_limit}
                                />
                                <InputError message={errors.retake_limit} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="session_timeout_seconds">
                                    Session timeout (seconds)
                                </Label>
                                <Input
                                    id="session_timeout_seconds"
                                    name="session_timeout_seconds"
                                    type="number"
                                    min={1}
                                    required
                                    defaultValue={
                                        settings.session_timeout_seconds
                                    }
                                />
                                <InputError
                                    message={errors.session_timeout_seconds}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="gallery_expiration_hours">
                                    Gallery expiration (hours)
                                </Label>
                                <Input
                                    id="gallery_expiration_hours"
                                    name="gallery_expiration_hours"
                                    type="number"
                                    min={1}
                                    required
                                    defaultValue={
                                        settings.gallery_expiration_hours
                                    }
                                />
                                <InputError
                                    message={errors.gallery_expiration_hours}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="gif_frame_duration_ms">
                                    GIF frame duration (ms)
                                </Label>
                                <Input
                                    id="gif_frame_duration_ms"
                                    name="gif_frame_duration_ms"
                                    type="number"
                                    min={1}
                                    required
                                    defaultValue={
                                        settings.gif_frame_duration_ms
                                    }
                                />
                                <InputError
                                    message={errors.gif_frame_duration_ms}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="default_printer">
                                    Default printer
                                </Label>
                                <Input
                                    id="default_printer"
                                    name="default_printer"
                                    required
                                    defaultValue={settings.default_printer}
                                />
                                <InputError message={errors.default_printer} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="booth_display_name">
                                    Booth display name
                                </Label>
                                <Input
                                    id="booth_display_name"
                                    name="booth_display_name"
                                    required
                                    defaultValue={settings.booth_display_name}
                                />
                                <InputError
                                    message={errors.booth_display_name}
                                />
                            </div>

                            <Button type="submit" disabled={processing}>
                                Save changes
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </AppLayout>
    );
}
