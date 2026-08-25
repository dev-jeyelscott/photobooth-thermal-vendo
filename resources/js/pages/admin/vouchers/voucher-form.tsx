import { Form, Link } from '@inertiajs/react';
import {
    CalendarClock,
    CircleCheck,
    Info,
    Save,
    Ticket,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index as vouchersIndex } from '@/routes/admin/vouchers';
import type { RouteFormDefinition } from '@/wayfinder';

export type Redemption = {
    sessionToken: string;
    startedAt: string | null;
};

export type Voucher = {
    id: number;
    code: string;
    active: boolean;
    validFrom: string | null;
    expiresAt: string | null;
    usageLimit: number;
    usageCount: number;
    redemptions: Redemption[];
};

/**
 * Convert a persisted ISO timestamp into the browser datetime-local format.
 */
function toDateTimeLocal(value: string | null | undefined): string {
    return value?.slice(0, 16) ?? '';
}

/**
 * Format a local date-time draft for concise operator preview copy.
 */
function formatPreviewDate(value: string): string {
    if (value.length === 0) {
        return 'Not set';
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(parsed);
}

/**
 * Render one numbered voucher form section using the canonical Card surface.
 */
function VoucherSection({
    number,
    title,
    description,
    children,
}: {
    number: number;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="flex items-start gap-3 border-b px-4 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-caption font-semibold text-primary">
                    {number}
                </span>
                <div>
                    <h2 className="text-card-title">{title}</h2>
                    {description && (
                        <p className="mt-0.5 text-caption text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            <div className="p-4">{children}</div>
        </Card>
    );
}

/**
 * Render a compact summary of the form's current presentation-only draft.
 */
function VoucherSummary({
    code,
    active,
    validFrom,
    expiresAt,
    usageLimit,
    usageCount,
}: {
    code: string;
    active: boolean;
    validFrom: string;
    expiresAt: string;
    usageLimit: number;
    usageCount: number;
}) {
    const rows = [
        ['Code', code.trim() || 'Not set'],
        ['Valid from', formatPreviewDate(validFrom)],
        ['Expires', formatPreviewDate(expiresAt)],
        ['Usage limit', String(usageLimit)],
        ['Redeemed', String(usageCount)],
    ] as const;

    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-card-title">Voucher summary</h2>
                <Ticket className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div className="grid gap-3 p-4">
                {rows.map(([label, value]) => (
                    <div
                        key={label}
                        className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm"
                    >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="min-w-0 font-medium break-words">
                            {value}
                        </span>
                    </div>
                ))}
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                        variant="outline"
                        className={
                            active
                                ? 'w-fit gap-1.5 border-success/30 bg-success-subtle text-success-foreground'
                                : 'w-fit gap-1.5 border-border bg-muted text-muted-foreground'
                        }
                    >
                        <span
                            className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground'}`}
                            aria-hidden="true"
                        />
                        {active ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>
        </Card>
    );
}

/**
 * Render a branded voucher ticket preview using only persisted form concepts.
 */
function VoucherPreview({
    code,
    active,
    expiresAt,
    usageLimit,
}: {
    code: string;
    active: boolean;
    expiresAt: string;
    usageLimit: number;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-card-title">Live voucher card preview</h2>
                <Info
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            </div>
            <div className="p-4">
                <div className="relative overflow-hidden rounded-xl border border-primary/35 bg-primary/[0.04] p-5">
                    <div
                        className="absolute inset-y-0 right-4 border-l border-dashed border-primary/25"
                        aria-hidden="true"
                    />
                    <div className="relative z-10 pr-8">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                <Ticket className="size-4" aria-hidden="true" />
                                ThermaSnap
                            </div>
                            <Badge
                                variant="outline"
                                className={
                                    active
                                        ? 'border-success/30 bg-success-subtle text-success-foreground'
                                        : 'border-border bg-muted text-muted-foreground'
                                }
                            >
                                {active ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>

                        <p className="mt-7 text-xl font-semibold tracking-tight break-all">
                            {code.trim() || 'YOUR-CODE'}
                        </p>
                        <p className="mt-1 text-caption text-muted-foreground">
                            Up to {usageLimit} total{' '}
                            {usageLimit === 1 ? 'redemption' : 'redemptions'}
                        </p>

                        <div className="mt-6 border-t border-dashed border-primary/20 pt-3 text-caption text-muted-foreground">
                            {expiresAt.length > 0
                                ? `Valid until ${formatPreviewDate(expiresAt)}`
                                : 'No expiration date'}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

/**
 * Render concise operator guidance without adding unsupported voucher rules.
 */
function GuidelinesCard() {
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Info className="size-4 text-info" aria-hidden="true" />
                <h2 className="text-card-title">Guidelines</h2>
            </div>
            <ul className="grid gap-2 p-4 pl-8 text-caption text-muted-foreground">
                <li>Voucher codes must remain unique.</li>
                <li>
                    Set a clear validity window when the campaign is time-bound.
                </li>
                <li>
                    Usage count is updated by redemption and is never edited
                    here.
                </li>
                <li>Inactive vouchers cannot unlock new kiosk sessions.</li>
            </ul>
        </Card>
    );
}

/**
 * Render immutable photobooth sessions that redeemed the voucher.
 */
export function VoucherRedemptionHistory({
    redemptions,
}: {
    redemptions: Redemption[];
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-card-title">Redemption activity</h2>
                <span className="text-caption text-muted-foreground tabular-nums">
                    {redemptions.length} total
                </span>
            </div>

            {redemptions.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                    This voucher has not been redeemed by any session yet.
                </div>
            ) : (
                <ul className="max-h-64 divide-y overflow-auto">
                    {redemptions.map((redemption) => (
                        <li key={redemption.sessionToken} className="p-4">
                            <p className="font-mono text-caption font-medium break-all">
                                {redemption.sessionToken}
                            </p>
                            <p className="mt-1 text-caption text-muted-foreground">
                                {redemption.startedAt
                                    ? new Date(
                                          redemption.startedAt,
                                      ).toLocaleString('en-PH')
                                    : 'Session start time unavailable'}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/**
 * Render the existing protected voucher deletion workflow as an edit-only
 * danger zone while preserving the server-side redemption-history guard.
 */
function DangerZone({ voucher }: { voucher: Voucher }) {
    const hasRedemptions = voucher.redemptions.length > 0;

    return (
        <Card className="gap-0 overflow-hidden border-destructive/30 py-0 shadow-xs">
            <div className="border-b border-destructive/20 px-4 py-3">
                <h2 className="text-card-title text-destructive-foreground">
                    Danger zone
                </h2>
            </div>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-medium">Delete this voucher</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                        {hasRedemptions
                            ? 'This voucher has redemption history, so the server will preserve it and reject deletion.'
                            : 'Deleting this unused voucher is permanent and cannot be undone.'}
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            type="button"
                            variant="destructive"
                            className="shrink-0"
                            disabled={hasRedemptions}
                        >
                            <Trash2 aria-hidden="true" />
                            Delete voucher
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <Form
                            {...VoucherController.destroy.form(voucher.id)}
                            options={{ preserveScroll: true }}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Delete voucher?
                                        </DialogTitle>
                                        <DialogDescription>
                                            This permanently deletes{' '}
                                            <strong>{voucher.code}</strong>.
                                            This action cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>

                                    {errors.voucher && (
                                        <p
                                            role="alert"
                                            className="text-sm text-destructive-foreground"
                                        >
                                            {errors.voucher}
                                        </p>
                                    )}

                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={processing}
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            variant="destructive"
                                            disabled={processing}
                                        >
                                            <Trash2 aria-hidden="true" />
                                            {processing
                                                ? 'Deleting...'
                                                : 'Delete voucher'}
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </Card>
    );
}

/**
 * Render the shared responsive Create/Edit Voucher administration workspace.
 */
export default function VoucherForm({
    form,
    voucher,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    voucher?: Voucher;
}) {
    const [code, setCode] = useState(voucher?.code ?? '');
    const [validFrom, setValidFrom] = useState(
        toDateTimeLocal(voucher?.validFrom),
    );
    const [expiresAt, setExpiresAt] = useState(
        toDateTimeLocal(voucher?.expiresAt),
    );
    const [usageLimit, setUsageLimit] = useState(voucher?.usageLimit ?? 1);
    const [active, setActive] = useState(voucher?.active ?? true);
    const usageCount = voucher?.usageCount ?? 0;

    return (
        <>
            <Form
                {...form}
                options={{ preserveScroll: true }}
                className="flex w-full flex-col gap-section p-page md:p-page-desktop"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h1 className="text-page-title sm:text-2xl">
                                    {voucher
                                        ? 'Edit voucher'
                                        : 'Create voucher'}
                                </h1>
                                <p className="mt-1 text-body text-muted-foreground">
                                    {voucher
                                        ? 'Update this voucher code and its redemption limits.'
                                        : 'Create a voucher code for customer checkout.'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button asChild type="button" variant="outline">
                                    <Link href={vouchersIndex()}>Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    <Save aria-hidden="true" />
                                    {processing
                                        ? 'Saving...'
                                        : voucher
                                          ? 'Save changes'
                                          : 'Save voucher'}
                                </Button>
                            </div>
                        </div>

                        <div className="grid min-w-0 gap-section xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
                            <div className="grid min-w-0 gap-4">
                                <VoucherSection
                                    number={1}
                                    title="Voucher details"
                                    description="Use a unique code customers can enter at checkout."
                                >
                                    <div className="grid gap-field">
                                        <Label htmlFor="code">
                                            Voucher code
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="code"
                                            name="code"
                                            required
                                            value={code}
                                            placeholder="VCH-ABCD-1234"
                                            aria-invalid={!!errors.code}
                                            aria-describedby={
                                                errors.code
                                                    ? 'code-error'
                                                    : 'code-help'
                                            }
                                            onChange={(event) =>
                                                setCode(event.target.value)
                                            }
                                        />
                                        <p
                                            id="code-help"
                                            className="text-caption text-muted-foreground"
                                        >
                                            This is the exact code the customer
                                            enters at the kiosk.
                                        </p>
                                        <InputError
                                            id="code-error"
                                            message={errors.code}
                                        />
                                    </div>
                                </VoucherSection>

                                <VoucherSection
                                    number={2}
                                    title="Validity"
                                    description="Leave either boundary empty when the voucher does not need that time limit."
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-field">
                                            <Label htmlFor="valid_from">
                                                Valid from (optional)
                                            </Label>
                                            <Input
                                                id="valid_from"
                                                name="valid_from"
                                                type="datetime-local"
                                                value={validFrom}
                                                aria-invalid={
                                                    !!errors.valid_from
                                                }
                                                aria-describedby={
                                                    errors.valid_from
                                                        ? 'valid_from-error'
                                                        : 'valid_from-help'
                                                }
                                                onChange={(event) =>
                                                    setValidFrom(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <p
                                                id="valid_from-help"
                                                className="text-caption text-muted-foreground"
                                            >
                                                Before this time, redemption is
                                                rejected by the backend.
                                            </p>
                                            <InputError
                                                id="valid_from-error"
                                                message={errors.valid_from}
                                            />
                                        </div>

                                        <div className="grid gap-field">
                                            <Label htmlFor="expires_at">
                                                Expiration date (optional)
                                            </Label>
                                            <Input
                                                id="expires_at"
                                                name="expires_at"
                                                type="datetime-local"
                                                value={expiresAt}
                                                aria-invalid={
                                                    !!errors.expires_at
                                                }
                                                aria-describedby={
                                                    errors.expires_at
                                                        ? 'expires_at-error'
                                                        : 'expires_at-help'
                                                }
                                                onChange={(event) =>
                                                    setExpiresAt(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <p
                                                id="expires_at-help"
                                                className="text-caption text-muted-foreground"
                                            >
                                                After this time, the voucher can
                                                no longer be redeemed.
                                            </p>
                                            <InputError
                                                id="expires_at-error"
                                                message={errors.expires_at}
                                            />
                                        </div>
                                    </div>
                                </VoucherSection>

                                <VoucherSection
                                    number={3}
                                    title="Usage limits"
                                    description="The limit is editable. The redemption counter remains system-managed."
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-field">
                                            <Label htmlFor="usage_limit">
                                                Usage limit
                                                <span
                                                    className="ml-1 text-destructive-foreground"
                                                    aria-hidden="true"
                                                >
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                id="usage_limit"
                                                name="usage_limit"
                                                type="number"
                                                min={1}
                                                required
                                                value={usageLimit}
                                                aria-invalid={
                                                    !!errors.usage_limit
                                                }
                                                aria-describedby={
                                                    errors.usage_limit
                                                        ? 'usage_limit-error'
                                                        : 'usage_limit-help'
                                                }
                                                onChange={(event) =>
                                                    setUsageLimit(
                                                        Math.max(
                                                            1,
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ) || 1,
                                                        ),
                                                    )
                                                }
                                            />
                                            <p
                                                id="usage_limit-help"
                                                className="text-caption text-muted-foreground"
                                            >
                                                Maximum total number of
                                                successful redemptions.
                                            </p>
                                            <InputError
                                                id="usage_limit-error"
                                                message={errors.usage_limit}
                                            />
                                        </div>

                                        {voucher ? (
                                            <div className="grid gap-field">
                                                <Label htmlFor="usage_count">
                                                    Usage count
                                                </Label>
                                                <Input
                                                    id="usage_count"
                                                    type="number"
                                                    value={usageCount}
                                                    disabled
                                                    readOnly
                                                />
                                                <p className="text-caption text-muted-foreground">
                                                    Updated automatically during
                                                    redemption and never
                                                    submitted by this form.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border bg-muted/20 p-4">
                                                <p className="text-sm font-medium">
                                                    Redemption count starts at 0
                                                </p>
                                                <p className="mt-1 text-caption text-muted-foreground">
                                                    Laravel increments usage
                                                    only after a successful
                                                    voucher redemption.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </VoucherSection>

                                <VoucherSection
                                    number={4}
                                    title="Status"
                                    description="Inactive vouchers remain stored but cannot unlock new sessions."
                                >
                                    <input
                                        type="hidden"
                                        name="active"
                                        value="0"
                                    />
                                    <div className="flex items-start gap-3 rounded-lg border p-4">
                                        <Checkbox
                                            id="active"
                                            name="active"
                                            value="1"
                                            checked={active}
                                            aria-invalid={!!errors.active}
                                            aria-describedby={
                                                errors.active
                                                    ? 'active-error'
                                                    : 'active-help'
                                            }
                                            onCheckedChange={(checked) =>
                                                setActive(checked === true)
                                            }
                                        />
                                        <div className="grid gap-1">
                                            <Label htmlFor="active">
                                                Active
                                            </Label>
                                            <p
                                                id="active-help"
                                                className="text-caption text-muted-foreground"
                                            >
                                                Active vouchers can be validated
                                                by the kiosk when their validity
                                                and usage rules also pass.
                                            </p>
                                        </div>
                                    </div>
                                    <InputError
                                        id="active-error"
                                        message={errors.active}
                                    />
                                </VoucherSection>
                            </div>

                            <aside className="grid min-w-0 gap-4 xl:sticky xl:top-20 xl:self-start">
                                <VoucherSummary
                                    code={code}
                                    active={active}
                                    validFrom={validFrom}
                                    expiresAt={expiresAt}
                                    usageLimit={usageLimit}
                                    usageCount={usageCount}
                                />
                                <VoucherPreview
                                    code={code}
                                    active={active}
                                    expiresAt={expiresAt}
                                    usageLimit={usageLimit}
                                />
                                {voucher && (
                                    <VoucherRedemptionHistory
                                        redemptions={voucher.redemptions}
                                    />
                                )}
                                <GuidelinesCard />
                            </aside>
                        </div>
                    </>
                )}
            </Form>

            {voucher && (
                <div className="px-page pb-page md:px-page-desktop md:pb-page-desktop">
                    <DangerZone voucher={voucher} />
                </div>
            )}
        </>
    );
}
