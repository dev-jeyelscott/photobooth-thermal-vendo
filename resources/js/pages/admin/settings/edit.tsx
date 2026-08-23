import { Form, Head, setLayoutProps } from '@inertiajs/react';
import {
    Camera,
    Clock,
    DollarSign,
    Info,
    Printer,
    Save,
    TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import SettingController from '@/actions/App/Http/Controllers/Admin/SettingController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

type SettingsSectionProps = {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    children: ReactNode;
};

/**
 * Render a consistent operator-facing settings section using the established
 * ThermaSnap admin card, spacing, typography, and icon conventions.
 */
function SettingsSection({
    id,
    title,
    description,
    icon: Icon,
    children,
}: SettingsSectionProps) {
    const headingId = `${id}-heading`;

    return (
        <Card
            className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none"
            aria-labelledby={headingId}
        >
            <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
                <header className="flex items-start gap-3 border-b p-4 sm:p-5 lg:border-r lg:border-b-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon
                            className="size-5 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </div>

                    <div className="min-w-0">
                        <h3
                            id={headingId}
                            className="font-semibold tracking-tight"
                        >
                            {title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </header>

                <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2">
                    {children}
                </div>
            </div>
        </Card>
    );
}

/**
 * Explain only the settings that the backend currently copies into a newly
 * created PhotoboothSession, avoiding claims about unrelated settings.
 */
function SessionSnapshotNotice() {
    return (
        <aside
            className="flex items-start gap-3 rounded-2xl border bg-muted/40 px-4 py-3 sm:px-5"
            aria-label="New-session snapshot behavior"
        >
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                <Info
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            </div>

            <div>
                <p className="text-sm font-medium">New-session snapshot</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    Session price, currency, and default capture count are
                    copied into each new session when it starts. Existing and
                    historical sessions keep the values already stored with
                    them.
                </p>
            </div>
        </aside>
    );
}

/**
 * Render the authenticated ThermaSnap system-settings workspace while keeping
 * the existing Inertia Form, Wayfinder route contract, and server validation.
 */
export default function SettingsEdit({ settings }: { settings: Settings }) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Settings', href: edit() }],
    });

    return (
        <>
            <Head title="System settings" />

            <div className="p-4 lg:p-6">
                <Form
                    {...SettingController.update.form()}
                    options={{ preserveScroll: true }}
                    className="mx-auto w-full max-w-6xl"
                >
                    {({ processing, errors }) => (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="[&>header]:mb-0">
                                    <Heading
                                        title="System settings"
                                        description="Configure kiosk pricing, capture behavior, delivery, printing, and availability."
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Save
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {processing
                                        ? 'Saving changes...'
                                        : 'Save changes'}
                                </Button>
                            </div>

                            <SessionSnapshotNotice />

                            <SettingsSection
                                id="pricing"
                                title="Pricing & Currency"
                                description="Set the amount and currency applied when a new photobooth session is created."
                                icon={DollarSign}
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="session_price">
                                        Session price
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
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                id="capture"
                                title="Capture Experience"
                                description="Configure the default shot count, countdown values, and customer retake allowance."
                                icon={Camera}
                            >
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
                                        defaultValue={
                                            settings.capture_shot_count
                                        }
                                        aria-invalid={
                                            !!errors.capture_shot_count
                                        }
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
                                    <Label htmlFor="countdown_seconds">
                                        Default countdown (seconds)
                                    </Label>
                                    <Input
                                        id="countdown_seconds"
                                        name="countdown_seconds"
                                        type="number"
                                        min={1}
                                        max={10}
                                        required
                                        defaultValue={
                                            settings.countdown_seconds
                                        }
                                        aria-invalid={
                                            !!errors.countdown_seconds
                                        }
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
                                        message={
                                            errors.capture_countdown_seconds
                                        }
                                    />
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                id="session-gallery"
                                title="Session & Gallery"
                                description="Control session time limits, gallery retention, and generated GIF timing."
                                icon={Clock}
                            >
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
                                        message={
                                            errors.kiosk_idle_timeout_seconds
                                        }
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
                                        message={
                                            errors.gallery_expiration_hours
                                        }
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
                            </SettingsSection>

                            <SettingsSection
                                id="booth-printing"
                                title="Booth Identity & Printing"
                                description="Configure customer-facing booth identity and receipt printer defaults."
                                icon={Printer}
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="booth_display_name">
                                        Booth display name
                                    </Label>
                                    <Input
                                        id="booth_display_name"
                                        name="booth_display_name"
                                        maxLength={255}
                                        required
                                        defaultValue={
                                            settings.booth_display_name
                                        }
                                        aria-invalid={
                                            !!errors.booth_display_name
                                        }
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
                                    <Label htmlFor="default_printer">
                                        Default printer
                                    </Label>
                                    <Input
                                        id="default_printer"
                                        name="default_printer"
                                        maxLength={255}
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
                                    <Label htmlFor="receipt_header">
                                        Receipt header
                                    </Label>
                                    <Input
                                        id="receipt_header"
                                        name="receipt_header"
                                        maxLength={255}
                                        defaultValue={
                                            settings.receipt_header ?? ''
                                        }
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
                                        maxLength={255}
                                        defaultValue={
                                            settings.receipt_footer ?? ''
                                        }
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
                            </SettingsSection>

                            <Card
                                className="gap-0 overflow-hidden rounded-2xl border-warning/30 py-0 shadow-none"
                                aria-labelledby="maintenance-heading"
                            >
                                <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
                                    <header className="flex items-start gap-3 border-b border-warning/30 bg-warning-subtle p-4 sm:p-5 lg:border-r lg:border-b-0">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/80">
                                            <TriangleAlert
                                                className="size-5 text-warning-foreground"
                                                aria-hidden="true"
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <h3
                                                id="maintenance-heading"
                                                className="font-semibold tracking-tight text-warning-foreground"
                                            >
                                                Maintenance Mode
                                            </h3>
                                            <p className="mt-1 text-sm leading-relaxed text-warning-foreground/80">
                                                Temporarily prevent new customer
                                                sessions while keeping existing
                                                authorized sessions recoverable.
                                            </p>
                                        </div>
                                    </header>

                                    <div className="grid gap-5 p-4 sm:p-5">
                                        <div>
                                            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-subtle p-4">
                                                <Checkbox
                                                    id="maintenance_mode"
                                                    name="maintenance_mode"
                                                    defaultChecked={
                                                        settings.maintenance_mode
                                                    }
                                                    aria-invalid={
                                                        !!errors.maintenance_mode
                                                    }
                                                    aria-describedby={
                                                        errors.maintenance_mode
                                                            ? 'maintenance_mode-error'
                                                            : 'maintenance-mode-description'
                                                    }
                                                    className="mt-0.5"
                                                />

                                                <div>
                                                    <Label
                                                        htmlFor="maintenance_mode"
                                                        className="font-medium"
                                                    >
                                                        Maintenance mode
                                                    </Label>
                                                    <p
                                                        id="maintenance-mode-description"
                                                        className="mt-1 text-sm leading-relaxed text-warning-foreground/80"
                                                    >
                                                        Blocks creation of new
                                                        kiosk sessions.
                                                        Already-authorized
                                                        sessions can continue.
                                                    </p>
                                                </div>
                                            </div>

                                            <InputError
                                                id="maintenance_mode-error"
                                                message={
                                                    errors.maintenance_mode
                                                }
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="maintenance_message">
                                                Maintenance message
                                            </Label>
                                            <Input
                                                id="maintenance_message"
                                                name="maintenance_message"
                                                maxLength={500}
                                                defaultValue={
                                                    settings.maintenance_message ??
                                                    ''
                                                }
                                                aria-invalid={
                                                    !!errors.maintenance_message
                                                }
                                                aria-describedby={
                                                    errors.maintenance_message
                                                        ? 'maintenance_message-error'
                                                        : 'maintenance-message-description'
                                                }
                                            />
                                            <p
                                                id="maintenance-message-description"
                                                className="text-xs leading-relaxed text-muted-foreground"
                                            >
                                                Customer-facing message shown
                                                when new sessions are
                                                unavailable.
                                            </p>
                                            <InputError
                                                id="maintenance_message-error"
                                                message={
                                                    errors.maintenance_message
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </Form>
            </div>
        </>
    );
}
