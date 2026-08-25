import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import { Info, Save } from 'lucide-react';
import type { ReactNode } from 'react';
import SettingController from '@/actions/App/Http/Controllers/Admin/SettingController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { edit } from '@/routes/admin/settings';

export type Settings = {
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
    children: ReactNode;
};

/**
 * Format the configured session price with its persisted ISO currency while
 * providing a safe textual fallback for an unexpected currency value.
 */
export function formatSettingsAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

/**
 * Render one horizontally structured settings group using the canonical
 * ThermaSnap admin surface, typography, spacing, and responsive behavior.
 */
function SettingsSection({
    id,
    title,
    description,
    children,
}: SettingsSectionProps) {
    const headingId = `${id}-heading`;

    return (
        <Card
            className="gap-0 overflow-hidden rounded-xl py-0 shadow-xs"
            aria-labelledby={headingId}
        >
            <div className="grid xl:grid-cols-[15rem_minmax(0,1fr)]">
                <header className="border-b p-4 sm:p-5 xl:border-r xl:border-b-0">
                    <h2
                        id={headingId}
                        className="text-card-title tracking-tight"
                    >
                        {title}
                    </h2>
                    <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                </header>

                <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
                    {children}
                </div>
            </div>
        </Card>
    );
}

/**
 * Explain only the setting values that the backend currently snapshots into
 * newly created sessions so operators do not infer unsupported behavior.
 */
function SessionSnapshotNotice() {
    return (
        <aside
            className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 sm:col-span-2 xl:col-span-4"
            aria-label="New-session snapshot behavior"
        >
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                <Info
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            </div>

            <div className="min-w-0">
                <p className="text-sm font-medium">New-session snapshot</p>
                <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
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
 * Render a read-only summary using only settings that are already provided by
 * Laravel, without fabricating health telemetry or last-saved audit data.
 */
function SettingsSummary({ settings }: { settings: Settings }) {
    return (
        <Card
            className="gap-0 overflow-hidden rounded-xl py-0 shadow-xs"
            aria-label="Settings summary"
        >
            <header className="border-b p-4">
                <h2 className="text-card-title">Settings Summary</h2>
                <p className="mt-1 text-caption text-muted-foreground">
                    Current saved configuration
                </p>
            </header>

            <dl className="divide-y">
                <div className="p-4">
                    <dt className="text-caption text-muted-foreground">
                        Booth
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                        {settings.booth_display_name}
                    </dd>
                </div>

                <div className="p-4">
                    <dt className="text-caption text-muted-foreground">
                        Session Price
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                        {formatSettingsAmount(
                            settings.session_price,
                            settings.currency,
                        )}
                    </dd>
                </div>

                <div className="p-4">
                    <dt className="text-caption text-muted-foreground">
                        Gallery Expires In
                    </dt>
                    <dd className="mt-1 text-sm font-medium tabular-nums">
                        {settings.gallery_expiration_hours} hours
                    </dd>
                </div>

                <div className="p-4">
                    <dt className="text-caption text-muted-foreground">
                        Default Printer
                    </dt>
                    <dd
                        className="mt-1 truncate text-sm font-medium"
                        title={settings.default_printer}
                    >
                        {settings.default_printer}
                    </dd>
                </div>

                <div className="p-4">
                    <dt className="text-caption text-muted-foreground">
                        Kiosk Availability
                    </dt>
                    <dd className="mt-2">
                        {settings.maintenance_mode ? (
                            <Badge
                                variant="outline"
                                className="border-warning/30 bg-warning-subtle text-warning-foreground"
                            >
                                Maintenance mode
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="border-success/30 bg-success-subtle text-success-foreground"
                            >
                                Available
                            </Badge>
                        )}
                    </dd>
                </div>
            </dl>
        </Card>
    );
}

/**
 * Render the authenticated ThermaSnap settings workspace while preserving the
 * existing Inertia Form, Wayfinder route contract, and server-side validation.
 */
export default function SettingsEdit({ settings }: { settings: Settings }) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Settings', href: edit() }],
    });

    return (
        <>
            <Head title="Settings" />

            <div className="p-4 lg:p-6">
                <Form
                    {...SettingController.update.form()}
                    options={{ preserveScroll: true }}
                    className="mx-auto w-full"
                >
                    {({ processing, errors }) => (
                        <div className="space-y-6">
                            <header>
                                <h1 className="text-page-title">Settings</h1>
                                <p className="mt-1 text-body text-muted-foreground">
                                    Configure ThermaSnap kiosk pricing, timing,
                                    capture, delivery, printing, and
                                    availability.
                                </p>
                            </header>

                            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                                <div className="min-w-0 space-y-4">
                                    <SettingsSection
                                        id="booth-print"
                                        title="Booth / Print Information"
                                        description="Configure the customer-facing booth identity and thermal print defaults."
                                    >
                                        <div className="grid min-w-0 content-start gap-2">
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
                                                message={
                                                    errors.booth_display_name
                                                }
                                            />
                                        </div>

                                        <div className="grid min-w-0 content-start gap-2">
                                            <Label htmlFor="default_printer">
                                                Default printer
                                            </Label>
                                            <Input
                                                id="default_printer"
                                                name="default_printer"
                                                maxLength={255}
                                                required
                                                defaultValue={
                                                    settings.default_printer
                                                }
                                                aria-invalid={
                                                    !!errors.default_printer
                                                }
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

                                        <div className="grid min-w-0 content-start gap-2">
                                            <Label htmlFor="receipt_header">
                                                Receipt header
                                            </Label>
                                            <Input
                                                id="receipt_header"
                                                name="receipt_header"
                                                maxLength={255}
                                                defaultValue={
                                                    settings.receipt_header ??
                                                    ''
                                                }
                                                aria-invalid={
                                                    !!errors.receipt_header
                                                }
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

                                        <div className="grid min-w-0 content-start gap-2">
                                            <Label htmlFor="receipt_footer">
                                                Receipt footer
                                            </Label>
                                            <Input
                                                id="receipt_footer"
                                                name="receipt_footer"
                                                maxLength={255}
                                                defaultValue={
                                                    settings.receipt_footer ??
                                                    ''
                                                }
                                                aria-invalid={
                                                    !!errors.receipt_footer
                                                }
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

                                    <SettingsSection
                                        id="pricing"
                                        title="Pricing & Currency"
                                        description="Set the amount and currency snapshotted when a new photobooth session begins."
                                    >
                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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
                                                defaultValue={
                                                    settings.session_price
                                                }
                                                aria-invalid={
                                                    !!errors.session_price
                                                }
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

                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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

                                        <SessionSnapshotNotice />
                                    </SettingsSection>

                                    <SettingsSection
                                        id="session-timing"
                                        title="Session Timing"
                                        description="Control kiosk inactivity and the maximum lifetime of an active customer session."
                                    >
                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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

                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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
                                                message={
                                                    errors.session_timeout_seconds
                                                }
                                            />
                                        </div>
                                    </SettingsSection>

                                    <SettingsSection
                                        id="capture-print"
                                        title="Capture & Print Settings"
                                        description="Configure the default photo count, countdown timing, and customer retake allowance."
                                    >
                                        <div className="grid min-w-0 content-start gap-2">
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
                                                message={
                                                    errors.capture_shot_count
                                                }
                                            />
                                        </div>

                                        <div className="grid min-w-0 content-start gap-2">
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
                                                message={
                                                    errors.countdown_seconds
                                                }
                                            />
                                        </div>

                                        <div className="grid min-w-0 content-start gap-2">
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

                                        <div className="grid min-w-0 content-start gap-2">
                                            <Label htmlFor="retake_limit">
                                                Retake limit
                                            </Label>
                                            <Input
                                                id="retake_limit"
                                                name="retake_limit"
                                                type="number"
                                                min={1}
                                                required
                                                defaultValue={
                                                    settings.retake_limit
                                                }
                                                aria-invalid={
                                                    !!errors.retake_limit
                                                }
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
                                    </SettingsSection>

                                    <SettingsSection
                                        id="gallery-retention"
                                        title="Gallery / Retention"
                                        description="Configure customer gallery lifetime and generated GIF frame timing."
                                    >
                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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

                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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
                                                message={
                                                    errors.gif_frame_duration_ms
                                                }
                                            />
                                        </div>
                                    </SettingsSection>

                                    <SettingsSection
                                        id="maintenance"
                                        title="Maintenance / Status"
                                        description="Temporarily prevent new kiosk sessions without terminating already-authorized customer sessions."
                                    >
                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
                                            <Label htmlFor="maintenance_mode">
                                                Maintenance mode
                                            </Label>

                                            <div className="flex min-h-9 items-center gap-3 rounded-md border border-input bg-background px-3">
                                                <Switch
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
                                                            : 'maintenance_mode-description'
                                                    }
                                                />
                                                <span className="text-sm">
                                                    {settings.maintenance_mode
                                                        ? 'Enabled'
                                                        : 'Disabled'}
                                                </span>
                                            </div>

                                            <p
                                                id="maintenance_mode-description"
                                                className="text-caption leading-relaxed text-muted-foreground"
                                            >
                                                Blocks creation of new kiosk
                                                sessions. Already-authorized
                                                sessions can continue.
                                            </p>

                                            <InputError
                                                id="maintenance_mode-error"
                                                message={
                                                    errors.maintenance_mode
                                                }
                                            />
                                        </div>

                                        <div className="grid min-w-0 content-start gap-2 xl:col-span-2">
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
                                                placeholder="Temporarily unavailable"
                                                aria-invalid={
                                                    !!errors.maintenance_message
                                                }
                                                aria-describedby={
                                                    errors.maintenance_message
                                                        ? 'maintenance_message-error'
                                                        : undefined
                                                }
                                            />
                                            <InputError
                                                id="maintenance_message-error"
                                                message={
                                                    errors.maintenance_message
                                                }
                                            />
                                        </div>
                                    </SettingsSection>
                                </div>

                                <aside className="xl:sticky xl:top-6">
                                    <SettingsSummary settings={settings} />
                                </aside>
                            </div>

                            <footer className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="gap-2"
                                >
                                    <Save
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {processing
                                        ? 'Saving changes...'
                                        : 'Save changes'}
                                </Button>

                                <Button type="button" variant="outline" asChild>
                                    <Link href={edit()}>Cancel</Link>
                                </Button>
                            </footer>
                        </div>
                    )}
                </Form>
            </div>
        </>
    );
}
