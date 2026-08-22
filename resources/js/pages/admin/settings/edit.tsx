import { Form, Head, setLayoutProps } from '@inertiajs/react';
import SettingController from '@/actions/App/Http/Controllers/Admin/SettingController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/admin/settings';

type Settings = {
    session_price: number;
    currency: string;
    countdown_seconds: number;
    capture_shot_count: number;
    capture_countdown_seconds: number;
    retake_limit: number;
    kiosk_idle_timeout_seconds: number;
    session_timeout_seconds: number;
    gallery_expiration_hours: number;
    gif_frame_duration_ms: number;
    default_printer: string;
    booth_display_name: string;
    receipt_header: string | null;
    receipt_footer: string | null;
    maintenance_mode: boolean;
    maintenance_message: string | null;
};

function FutureSessionsNote() {
    return (
        <p className="text-xs text-muted-foreground">
            Only applies to sessions started after this change is saved. Each
            session snapshots this value the moment it starts, so
            already-started, in-progress, or historical sessions keep the value
            that was in effect when they began.
        </p>
    );
}

export default function SettingsEdit({ settings }: { settings: Settings }) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Settings', href: edit() }],
    });

    return (
        <>
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
                                    aria-invalid={!!errors.session_price}
                                    aria-describedby={
                                        errors.session_price
                                            ? 'session_price-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="session_price-error"
                                    message={errors.session_price}
                                />
                                <FutureSessionsNote />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="currency">
                                    Currency (ISO 4217 code)
                                </Label>
                                <Input
                                    id="currency"
                                    name="currency"
                                    maxLength={3}
                                    required
                                    defaultValue={settings.currency}
                                    aria-invalid={!!errors.currency}
                                    aria-describedby={
                                        errors.currency
                                            ? 'currency-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="currency-error"
                                    message={errors.currency}
                                />
                                <FutureSessionsNote />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="countdown_seconds">
                                    Capture countdown (seconds)
                                </Label>
                                <Input
                                    id="countdown_seconds"
                                    name="countdown_seconds"
                                    type="number"
                                    min={1}
                                    max={10}
                                    required
                                    defaultValue={settings.countdown_seconds}
                                    aria-invalid={!!errors.countdown_seconds}
                                    aria-describedby={
                                        errors.countdown_seconds
                                            ? 'countdown_seconds-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="countdown_seconds-error"
                                    message={errors.countdown_seconds}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="capture_shot_count">
                                    Default capture count
                                </Label>
                                <Input
                                    id="capture_shot_count"
                                    name="capture_shot_count"
                                    type="number"
                                    min={1}
                                    max={10}
                                    required
                                    defaultValue={settings.capture_shot_count}
                                    aria-invalid={!!errors.capture_shot_count}
                                    aria-describedby={
                                        errors.capture_shot_count
                                            ? 'capture_shot_count-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="capture_shot_count-error"
                                    message={errors.capture_shot_count}
                                />
                                <FutureSessionsNote />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="capture_countdown_seconds">
                                    Capture countdown (seconds)
                                </Label>
                                <Input
                                    id="capture_countdown_seconds"
                                    name="capture_countdown_seconds"
                                    type="number"
                                    min={1}
                                    max={10}
                                    required
                                    defaultValue={
                                        settings.capture_countdown_seconds
                                    }
                                    aria-invalid={
                                        !!errors.capture_countdown_seconds
                                    }
                                    aria-describedby={
                                        errors.capture_countdown_seconds
                                            ? 'capture_countdown_seconds-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="capture_countdown_seconds-error"
                                    message={errors.capture_countdown_seconds}
                                />
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
                                    aria-invalid={!!errors.retake_limit}
                                    aria-describedby={
                                        errors.retake_limit
                                            ? 'retake_limit-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="retake_limit-error"
                                    message={errors.retake_limit}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="kiosk_idle_timeout_seconds">
                                    Idle timeout (seconds)
                                </Label>
                                <Input
                                    id="kiosk_idle_timeout_seconds"
                                    name="kiosk_idle_timeout_seconds"
                                    type="number"
                                    min={1}
                                    required
                                    defaultValue={
                                        settings.kiosk_idle_timeout_seconds
                                    }
                                    aria-invalid={
                                        !!errors.kiosk_idle_timeout_seconds
                                    }
                                    aria-describedby={
                                        errors.kiosk_idle_timeout_seconds
                                            ? 'kiosk_idle_timeout_seconds-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="kiosk_idle_timeout_seconds-error"
                                    message={errors.kiosk_idle_timeout_seconds}
                                />
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
                                    aria-invalid={
                                        !!errors.session_timeout_seconds
                                    }
                                    aria-describedby={
                                        errors.session_timeout_seconds
                                            ? 'session_timeout_seconds-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="session_timeout_seconds-error"
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
                                    aria-invalid={
                                        !!errors.gallery_expiration_hours
                                    }
                                    aria-describedby={
                                        errors.gallery_expiration_hours
                                            ? 'gallery_expiration_hours-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="gallery_expiration_hours-error"
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
                                    aria-invalid={
                                        !!errors.gif_frame_duration_ms
                                    }
                                    aria-describedby={
                                        errors.gif_frame_duration_ms
                                            ? 'gif_frame_duration_ms-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="gif_frame_duration_ms-error"
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
                                    aria-invalid={!!errors.default_printer}
                                    aria-describedby={
                                        errors.default_printer
                                            ? 'default_printer-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="default_printer-error"
                                    message={errors.default_printer}
                                />
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
                                    aria-invalid={!!errors.booth_display_name}
                                    aria-describedby={
                                        errors.booth_display_name
                                            ? 'booth_display_name-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="booth_display_name-error"
                                    message={errors.booth_display_name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="receipt_header">
                                    Receipt header
                                </Label>
                                <Input
                                    id="receipt_header"
                                    name="receipt_header"
                                    defaultValue={settings.receipt_header ?? ''}
                                    aria-invalid={!!errors.receipt_header}
                                    aria-describedby={
                                        errors.receipt_header
                                            ? 'receipt_header-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="receipt_header-error"
                                    message={errors.receipt_header}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="receipt_footer">
                                    Receipt footer
                                </Label>
                                <Input
                                    id="receipt_footer"
                                    name="receipt_footer"
                                    defaultValue={settings.receipt_footer ?? ''}
                                    aria-invalid={!!errors.receipt_footer}
                                    aria-describedby={
                                        errors.receipt_footer
                                            ? 'receipt_footer-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="receipt_footer-error"
                                    message={errors.receipt_footer}
                                />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="maintenance_mode"
                                    name="maintenance_mode"
                                    defaultChecked={settings.maintenance_mode}
                                    aria-invalid={!!errors.maintenance_mode}
                                    aria-describedby={
                                        errors.maintenance_mode
                                            ? 'maintenance_mode-error'
                                            : undefined
                                    }
                                />
                                <Label htmlFor="maintenance_mode">
                                    Maintenance mode
                                </Label>
                            </div>
                            <InputError
                                id="maintenance_mode-error"
                                message={errors.maintenance_mode}
                            />

                            <div className="grid gap-2">
                                <Label htmlFor="maintenance_message">
                                    Maintenance message
                                </Label>
                                <Input
                                    id="maintenance_message"
                                    name="maintenance_message"
                                    defaultValue={
                                        settings.maintenance_message ?? ''
                                    }
                                    aria-invalid={!!errors.maintenance_message}
                                    aria-describedby={
                                        errors.maintenance_message
                                            ? 'maintenance_message-error'
                                            : undefined
                                    }
                                />
                                <InputError
                                    id="maintenance_message-error"
                                    message={errors.maintenance_message}
                                />
                            </div>

                            <Button type="submit" disabled={processing}>
                                Save changes
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
