import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CircleCheck,
    CirclePause,
    Clock3,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Ticket,
    Trash2,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { create, index as vouchersIndex } from '@/routes/admin/vouchers';

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

export type VoucherAvailability =
    'usable' | 'scheduled' | 'expired' | 'exhausted' | 'disabled';

export type VoucherAvailabilityFilter = VoucherAvailability | 'all';

type VoucherSummary = {
    total: number;
    usable: number;
    totalRedemptions: number;
    needsAttention: number;
};

type SummaryTone = 'neutral' | 'success' | 'info' | 'warning';

type AvailabilityPresentation = {
    label: string;
    badgeClassName: string;
    dotClassName: string;
    progressClassName: string;
};

type ValidityPresentation = {
    primary: string;
    secondary: string | null;
    textClassName: string;
};

const availabilityPresentation: Record<
    VoucherAvailability,
    AvailabilityPresentation
> = {
    usable: {
        label: 'Usable',
        badgeClassName:
            'border-success/30 bg-success-subtle text-success-foreground',
        dotClassName: 'bg-success',
        progressClassName: 'bg-success',
    },
    scheduled: {
        label: 'Scheduled',
        badgeClassName: 'border-info/30 bg-info-subtle text-info-foreground',
        dotClassName: 'bg-info',
        progressClassName: 'bg-info',
    },
    expired: {
        label: 'Expired',
        badgeClassName:
            'border-warning/30 bg-warning-subtle text-warning-foreground',
        dotClassName: 'bg-warning',
        progressClassName: 'bg-warning',
    },
    exhausted: {
        label: 'Exhausted',
        badgeClassName:
            'border-destructive/30 bg-destructive/10 text-destructive',
        dotClassName: 'bg-destructive',
        progressClassName: 'bg-destructive',
    },
    disabled: {
        label: 'Disabled',
        badgeClassName: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
        progressClassName: 'bg-muted-foreground',
    },
};

/**
 * Resolve the operator-facing availability state using the same precedence as
 * the server-side voucher redemption action.
 */
export function getVoucherAvailability(
    voucher: Voucher,
    now: Date,
): VoucherAvailability {
    const nowTimestamp = now.getTime();

    if (!voucher.active) {
        return 'disabled';
    }

    if (
        voucher.validFrom !== null &&
        new Date(voucher.validFrom).getTime() > nowTimestamp
    ) {
        return 'scheduled';
    }

    if (
        voucher.expiresAt !== null &&
        new Date(voucher.expiresAt).getTime() < nowTimestamp
    ) {
        return 'expired';
    }

    if (voucher.usageCount >= voucher.usageLimit) {
        return 'exhausted';
    }

    return 'usable';
}

/**
 * Calculate operator-focused voucher totals directly from the current page
 * payload without introducing a separate analytics endpoint.
 */
export function getVoucherSummary(
    vouchers: Voucher[],
    now: Date,
): VoucherSummary {
    return vouchers.reduce<VoucherSummary>(
        (summary, voucher) => {
            const availability = getVoucherAvailability(voucher, now);

            summary.total += 1;
            summary.totalRedemptions += voucher.redemptions.length;

            if (availability === 'usable') {
                summary.usable += 1;
            }

            if (
                availability === 'disabled' ||
                availability === 'expired' ||
                availability === 'exhausted'
            ) {
                summary.needsAttention += 1;
            }

            return summary;
        },
        {
            total: 0,
            usable: 0,
            totalRedemptions: 0,
            needsAttention: 0,
        },
    );
}

/**
 * Calculate a bounded percentage for the voucher usage meter.
 */
export function getUsagePercentage(voucher: Voucher): number {
    if (voucher.usageLimit <= 0) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(
            0,
            Math.round((voucher.usageCount / voucher.usageLimit) * 100),
        ),
    );
}

/**
 * Return the most recent redemption that has an available start timestamp.
 */
export function getLastRedemption(voucher: Voucher): Redemption | null {
    return voucher.redemptions.reduce<Redemption | null>(
        (latest, redemption) => {
            if (redemption.startedAt === null) {
                return latest;
            }

            if (latest?.startedAt === null || latest === null) {
                return redemption;
            }

            return new Date(redemption.startedAt).getTime() >
                new Date(latest.startedAt).getTime()
                ? redemption
                : latest;
        },
        null,
    );
}

/**
 * Filter vouchers by code and derived availability while retaining the
 * controller-provided ordering.
 */
export function filterVouchers(
    vouchers: Voucher[],
    search: string,
    availabilityFilter: VoucherAvailabilityFilter,
    now: Date,
): Voucher[] {
    const normalizedSearch = search.trim().toLowerCase();

    return vouchers.filter((voucher) => {
        const matchesSearch =
            normalizedSearch.length === 0 ||
            voucher.code.toLowerCase().includes(normalizedSearch);

        const matchesAvailability =
            availabilityFilter === 'all' ||
            getVoucherAvailability(voucher, now) === availabilityFilter;

        return matchesSearch && matchesAvailability;
    });
}

/**
 * Format a stored timestamp as an operator-friendly calendar date.
 */
function formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

/**
 * Format a stored timestamp as a concise date and time for redemption history.
 */
function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

/**
 * Build plain-language validity information from the persisted voucher window.
 */
function getValidityPresentation(
    voucher: Voucher,
    availability: VoucherAvailability,
): ValidityPresentation {
    if (availability === 'scheduled' && voucher.validFrom !== null) {
        return {
            primary: `Starts ${formatDate(voucher.validFrom)}`,
            secondary:
                voucher.expiresAt !== null
                    ? `Expires ${formatDate(voucher.expiresAt)}`
                    : 'No expiration',
            textClassName: 'text-info',
        };
    }

    if (availability === 'expired' && voucher.expiresAt !== null) {
        return {
            primary: `Expired ${formatDate(voucher.expiresAt)}`,
            secondary:
                voucher.validFrom !== null
                    ? `Started ${formatDate(voucher.validFrom)}`
                    : 'Valid immediately',
            textClassName: 'text-warning',
        };
    }

    return {
        primary:
            voucher.expiresAt !== null
                ? `Expires ${formatDate(voucher.expiresAt)}`
                : 'No expiration',
        secondary:
            voucher.validFrom !== null
                ? `Started ${formatDate(voucher.validFrom)}`
                : 'Valid immediately',
        textClassName: 'text-foreground',
    };
}

/**
 * Render one concise summary metric using the shared semantic design tokens.
 */
function SummaryCard({
    label,
    value,
    description,
    icon: Icon,
    tone,
}: {
    label: string;
    value: number;
    description: string;
    icon: LucideIcon;
    tone: SummaryTone;
}) {
    const toneClasses: Record<SummaryTone, string> = {
        neutral: 'bg-muted text-foreground',
        success: 'bg-success-subtle text-success',
        info: 'bg-info-subtle text-info',
        warning: 'bg-warning-subtle text-warning',
    };

    return (
        <Card
            aria-label={label}
            className="gap-0 px-5 py-5 shadow-none transition-shadow hover:shadow-sm"
        >
            <div className="flex items-center gap-4">
                <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
                >
                    <Icon className="size-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                        {value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
        </Card>
    );
}

/**
 * Render one voucher row with semantic availability, usage, validity, and
 * protected management actions.
 */
function VoucherRow({ voucher, now }: { voucher: Voucher; now: Date }) {
    const [deleteOpen, setDeleteOpen] = useState(false);

    const availability = getVoucherAvailability(voucher, now);
    const presentation = availabilityPresentation[availability];
    const usagePercentage = getUsagePercentage(voucher);
    const lastRedemption = getLastRedemption(voucher);
    const validity = getValidityPresentation(voucher, availability);
    const redemptionCount = voucher.redemptions.length;
    const canDelete = redemptionCount === 0;

    return (
        <tr className="border-t transition-colors hover:bg-muted/20">
            <td className="px-4 py-4">
                <p className="font-mono font-semibold tracking-tight">
                    {voucher.code}
                </p>
            </td>

            <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                    <span
                        className={`size-2 shrink-0 rounded-full ${presentation.dotClassName}`}
                        aria-hidden="true"
                    />

                    <Badge
                        variant="outline"
                        className={presentation.badgeClassName}
                    >
                        {presentation.label}
                    </Badge>
                </div>
            </td>

            <td className="px-4 py-4">
                <div className="min-w-40">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-medium tabular-nums">
                            {voucher.usageCount} / {voucher.usageLimit}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {usagePercentage}%
                        </span>
                    </div>

                    <div
                        role="progressbar"
                        aria-label={`Usage for ${voucher.code}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={usagePercentage}
                        aria-valuetext={`${voucher.usageCount} of ${voucher.usageLimit} uses`}
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            className={`h-full rounded-full transition-[width] ${presentation.progressClassName}`}
                            style={{ width: `${usagePercentage}%` }}
                        />
                    </div>
                </div>
            </td>

            <td className="px-4 py-4">
                <div className="flex items-start gap-2">
                    <Clock3
                        className={`mt-0.5 size-4 shrink-0 ${
                            availability === 'scheduled'
                                ? 'text-info'
                                : availability === 'expired'
                                  ? 'text-warning'
                                  : 'text-muted-foreground'
                        }`}
                        aria-hidden="true"
                    />

                    <div>
                        <p className={`font-medium ${validity.textClassName}`}>
                            {validity.primary}
                        </p>

                        {validity.secondary !== null && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {validity.secondary}
                            </p>
                        )}
                    </div>
                </div>
            </td>

            <td className="px-4 py-4">
                {redemptionCount === 0 ? (
                    <span className="text-muted-foreground">
                        No redemptions yet
                    </span>
                ) : (
                    <div className="flex items-start gap-2">
                        <Users
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />

                        <div>
                            <p className="font-medium">
                                {redemptionCount}{' '}
                                {redemptionCount === 1
                                    ? 'redemption'
                                    : 'redemptions'}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                                {lastRedemption?.startedAt !== null &&
                                lastRedemption !== null
                                    ? `Last used ${formatDateTime(
                                          lastRedemption.startedAt,
                                      )}`
                                    : 'Latest time unavailable'}
                            </p>
                        </div>
                    </div>
                )}
            </td>

            <td className="px-4 py-4">
                <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={VoucherController.edit(voucher.id)}>
                            <Pencil aria-hidden="true" />
                            Edit
                        </Link>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={`More actions for ${voucher.code}`}
                            >
                                <MoreHorizontal aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onSelect={() =>
                                    router.patch(
                                        VoucherController.toggle(voucher.id)
                                            .url,
                                        {},
                                        {
                                            preserveScroll: true,
                                        },
                                    )
                                }
                            >
                                {voucher.active ? (
                                    <CirclePause aria-hidden="true" />
                                ) : (
                                    <CircleCheck aria-hidden="true" />
                                )}
                                {voucher.active
                                    ? 'Disable voucher'
                                    : 'Enable voucher'}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeleteOpen(true)}
                            >
                                <Trash2 aria-hidden="true" />
                                Delete voucher
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                        <DialogContent>
                            <DialogTitle>
                                Delete &quot;{voucher.code}&quot;?
                            </DialogTitle>

                            <DialogDescription>
                                {canDelete
                                    ? 'This cannot be undone.'
                                    : 'This voucher cannot be deleted because it has associated photobooth sessions. Its redemption history must be preserved.'}
                            </DialogDescription>

                            <form
                                {...VoucherController.destroy.form(voucher.id)}
                            >
                                {!canDelete && (
                                    <p className="mb-4 text-sm text-destructive">
                                        Redeemed vouchers must be retained for
                                        operational history.
                                    </p>
                                )}

                                <DialogFooter className="gap-2">
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                        >
                                            Cancel
                                        </Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={!canDelete}
                                    >
                                        Delete voucher
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </td>
        </tr>
    );
}

/**
 * Render the operator-focused Voucher Management page using the existing
 * AppLayout supplied by the global Inertia resolver.
 */
export default function VouchersIndex({
    vouchers,
    serverNow,
}: {
    vouchers: Voucher[];
    serverNow: string;
}) {
    const [search, setSearch] = useState('');
    const [availabilityFilter, setAvailabilityFilter] =
        useState<VoucherAvailabilityFilter>('all');

    setLayoutProps({
        breadcrumbs: [{ title: 'Vouchers', href: vouchersIndex() }],
    });

    const now = new Date(serverNow);
    const summary = getVoucherSummary(vouchers, now);
    const filteredVouchers = filterVouchers(
        vouchers,
        search,
        availabilityFilter,
        now,
    );
    const hasActiveFilters =
        search.trim().length > 0 || availabilityFilter !== 'all';

    return (
        <>
            <Head title="Vouchers" />

            <div className="flex flex-col gap-6 p-4 lg:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Heading
                        title="Vouchers"
                        description="Create and manage kiosk voucher codes."
                    />

                    <Button asChild className="self-start sm:self-auto">
                        <Link href={create()}>
                            <Plus aria-hidden="true" />
                            New voucher
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total vouchers"
                        value={summary.total}
                        description="All voucher codes"
                        icon={Ticket}
                        tone="neutral"
                    />

                    <SummaryCard
                        label="Usable now"
                        value={summary.usable}
                        description="Available to redeem"
                        icon={CircleCheck}
                        tone="success"
                    />

                    <SummaryCard
                        label="Total redemptions"
                        value={summary.totalRedemptions}
                        description="Across all vouchers"
                        icon={Users}
                        tone="info"
                    />

                    <SummaryCard
                        label="Needs attention"
                        value={summary.needsAttention}
                        description="Expired, exhausted, or disabled"
                        icon={TriangleAlert}
                        tone="warning"
                    />
                </div>

                <Card className="gap-0 p-4 shadow-none">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative min-w-0 flex-1 md:max-w-sm">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />

                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                aria-label="Search vouchers by code"
                                placeholder="Search vouchers by code..."
                                className="pl-9"
                            />
                        </div>

                        <Select
                            value={availabilityFilter}
                            onValueChange={(value) =>
                                setAvailabilityFilter(
                                    value as VoucherAvailabilityFilter,
                                )
                            }
                        >
                            <SelectTrigger
                                className="w-full md:w-48"
                                aria-label="Filter vouchers by availability"
                            >
                                <SelectValue placeholder="All availability" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="all">
                                    All availability
                                </SelectItem>
                                <SelectItem value="usable">Usable</SelectItem>
                                <SelectItem value="scheduled">
                                    Scheduled
                                </SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="exhausted">
                                    Exhausted
                                </SelectItem>
                                <SelectItem value="disabled">
                                    Disabled
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            type="button"
                            variant="outline"
                            disabled={!hasActiveFilters}
                            onClick={() => {
                                setSearch('');
                                setAvailabilityFilter('all');
                            }}
                            className="md:ml-auto"
                        >
                            <RotateCcw aria-hidden="true" />
                            Reset
                        </Button>
                    </div>
                </Card>

                <Card className="gap-0 overflow-hidden py-0 shadow-none">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1080px] text-sm">
                            <caption className="sr-only">
                                Voucher management list
                            </caption>

                            <thead className="bg-muted/40 text-left text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Voucher code
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Usage
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Validity
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Redemption summary
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredVouchers.map((voucher) => (
                                    <VoucherRow
                                        key={voucher.id}
                                        voucher={voucher}
                                        now={now}
                                    />
                                ))}

                                {filteredVouchers.length === 0 && (
                                    <tr className="border-t">
                                        <td
                                            colSpan={6}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            {vouchers.length === 0
                                                ? 'No vouchers yet.'
                                                : 'No vouchers match the current search or filter.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                        Showing {filteredVouchers.length} of {vouchers.length}{' '}
                        vouchers
                    </div>
                </Card>
            </div>
        </>
    );
}
