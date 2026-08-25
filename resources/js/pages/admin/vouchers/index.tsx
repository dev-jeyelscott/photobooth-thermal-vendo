import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarClock,
    CircleCheck,
    CirclePause,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Ticket,
    Trash2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
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
export type VoucherSortOption = 'default' | 'code' | 'status' | 'usage';

type VoucherSummary = {
    total: number;
    usable: number;
    totalRedemptions: number;
    expiredOrScheduled: number;
};

type SummaryTone = 'primary' | 'success' | 'info' | 'warning';

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
            'border-destructive/30 bg-destructive/10 text-destructive-foreground',
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

const availabilitySortOrder: Record<VoucherAvailability, number> = {
    usable: 0,
    scheduled: 1,
    expired: 2,
    exhausted: 3,
    disabled: 4,
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
 * Calculate the four high-level voucher metrics from the authoritative page
 * payload without adding another analytics endpoint.
 */
export function getVoucherSummary(
    vouchers: Voucher[],
    now: Date,
): VoucherSummary {
    return vouchers.reduce<VoucherSummary>(
        (summary, voucher) => {
            const availability = getVoucherAvailability(voucher, now);

            summary.total += 1;
            summary.totalRedemptions += voucher.usageCount;

            if (availability === 'usable') {
                summary.usable += 1;
            }

            if (availability === 'expired' || availability === 'scheduled') {
                summary.expiredOrScheduled += 1;
            }

            return summary;
        },
        {
            total: 0,
            usable: 0,
            totalRedemptions: 0,
            expiredOrScheduled: 0,
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

            if (latest === null || latest.startedAt === null) {
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
 * Filter and sort vouchers on the already-loaded management payload while
 * preserving controller order for the default view.
 */
export function filterAndSortVouchers(
    vouchers: Voucher[],
    search: string,
    availabilityFilter: VoucherAvailabilityFilter,
    sortOption: VoucherSortOption,
    now: Date,
): Voucher[] {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = vouchers.filter((voucher) => {
        const matchesSearch =
            normalizedSearch.length === 0 ||
            voucher.code.toLowerCase().includes(normalizedSearch);
        const matchesAvailability =
            availabilityFilter === 'all' ||
            getVoucherAvailability(voucher, now) === availabilityFilter;

        return matchesSearch && matchesAvailability;
    });

    if (sortOption === 'default') {
        return filtered;
    }

    return [...filtered].sort((first, second) => {
        if (sortOption === 'code') {
            return first.code.localeCompare(second.code);
        }

        if (sortOption === 'usage') {
            return (
                second.usageCount - first.usageCount ||
                first.code.localeCompare(second.code)
            );
        }

        return (
            availabilitySortOrder[getVoucherAvailability(first, now)] -
                availabilitySortOrder[getVoucherAvailability(second, now)] ||
            first.code.localeCompare(second.code)
        );
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
        year: 'numeric',
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
            textClassName: 'text-info-foreground',
        };
    }

    if (availability === 'expired' && voucher.expiresAt !== null) {
        return {
            primary: `Expired ${formatDate(voucher.expiresAt)}`,
            secondary:
                voucher.validFrom !== null
                    ? `Started ${formatDate(voucher.validFrom)}`
                    : 'Valid immediately',
            textClassName: 'text-warning-foreground',
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
 * Render one compact summary metric using only canonical semantic tokens.
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
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success-subtle text-success',
        info: 'bg-info-subtle text-info',
        warning: 'bg-warning-subtle text-warning',
    };

    return (
        <Card
            aria-label={label}
            className="gap-0 rounded-xl px-5 py-4 shadow-xs"
        >
            <div className="flex min-h-20 items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-card-title">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                        {value}
                    </p>
                    <p className="mt-1 text-caption text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div
                    className={`flex size-12 shrink-0 items-center justify-center rounded-full ${toneClasses[tone]}`}
                >
                    <Icon className="size-5" aria-hidden="true" />
                </div>
            </div>
        </Card>
    );
}

/**
 * Render one voucher table row while preserving edit, toggle, and guarded
 * deletion through the current Wayfinder route contract.
 */
function VoucherRow({ voucher, now }: { voucher: Voucher; now: Date }) {
    const [deleteOpen, setDeleteOpen] = useState(false);
    const availability = getVoucherAvailability(voucher, now);
    const presentation = availabilityPresentation[availability];
    const usagePercentage = getUsagePercentage(voucher);
    const lastRedemption = getLastRedemption(voucher);
    const validity = getValidityPresentation(voucher, availability);
    const canDelete = voucher.redemptions.length === 0;

    return (
        <tr className="border-t bg-background transition-colors hover:bg-muted/20">
            <td className="px-table-x py-table-y">
                <p className="font-mono font-semibold tracking-tight">
                    {voucher.code}
                </p>
            </td>

            <td className="px-table-x py-table-y">
                <div className="min-w-36">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="font-medium tabular-nums">
                            {voucher.usageLimit}
                        </span>
                        <span className="text-caption text-muted-foreground tabular-nums">
                            {usagePercentage}% used
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

            <td className="px-table-x py-table-y">
                <p className="font-medium tabular-nums">{voucher.usageCount}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                    {lastRedemption?.startedAt
                        ? `Last ${formatDateTime(lastRedemption.startedAt)}`
                        : 'No redemption time'}
                </p>
            </td>

            <td className="px-table-x py-table-y">
                <p className={`font-medium ${validity.textClassName}`}>
                    {validity.primary}
                </p>
                {validity.secondary !== null && (
                    <p className="mt-0.5 text-caption text-muted-foreground">
                        {validity.secondary}
                    </p>
                )}
            </td>

            <td className="px-table-x py-table-y">
                <Badge
                    variant="outline"
                    className={`gap-1.5 ${presentation.badgeClassName}`}
                >
                    <span
                        className={`size-1.5 rounded-full ${presentation.dotClassName}`}
                        aria-hidden="true"
                    />
                    {presentation.label}
                </Badge>
            </td>

            <td className="px-table-x py-table-y">
                <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="outline" size="icon">
                        <Link
                            href={VoucherController.edit(voucher.id)}
                            aria-label={`Edit ${voucher.code}`}
                        >
                            <Pencil aria-hidden="true" />
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
                                        { preserveScroll: true },
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
                                    ? 'This permanently deletes the unused voucher and cannot be undone.'
                                    : 'This voucher has associated photobooth sessions, so its redemption history must be preserved.'}
                            </DialogDescription>

                            <form
                                {...VoucherController.destroy.form(voucher.id)}
                            >
                                {!canDelete && (
                                    <p className="mb-4 text-sm text-destructive-foreground">
                                        Redeemed vouchers cannot be deleted.
                                    </p>
                                )}

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">
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
 * Render the voucher management workspace inside the resolver-owned AppLayout.
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
    const [sortOption, setSortOption] = useState<VoucherSortOption>('default');

    setLayoutProps({
        breadcrumbs: [{ title: 'Vouchers', href: vouchersIndex() }],
    });

    const now = new Date(serverNow);
    const summary = getVoucherSummary(vouchers, now);
    const visibleVouchers = filterAndSortVouchers(
        vouchers,
        search,
        availabilityFilter,
        sortOption,
        now,
    );
    const hasActiveView =
        search.trim().length > 0 ||
        availabilityFilter !== 'all' ||
        sortOption !== 'default';

    /**
     * Restore the default server-backed voucher management view.
     */
    function resetView(): void {
        setSearch('');
        setAvailabilityFilter('all');
        setSortOption('default');
    }

    return (
        <>
            <Head title="Vouchers" />

            <div className="flex w-full flex-col gap-section p-page md:p-page-desktop">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-page-title sm:text-2xl">
                            Vouchers
                        </h1>
                        <p className="mt-1 text-body text-muted-foreground">
                            Manage voucher codes for photobooth sessions.
                        </p>
                    </div>

                    <Button asChild className="self-start">
                        <Link href={create()}>
                            <Plus aria-hidden="true" />
                            Create voucher
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total vouchers"
                        value={summary.total}
                        description="All voucher codes"
                        icon={Ticket}
                        tone="primary"
                    />
                    <SummaryCard
                        label="Usable now"
                        value={summary.usable}
                        description={
                            summary.total === 0
                                ? 'No vouchers yet'
                                : `${((summary.usable / summary.total) * 100).toFixed(1)}% of total`
                        }
                        icon={CircleCheck}
                        tone="success"
                    />
                    <SummaryCard
                        label="Redeemed"
                        value={summary.totalRedemptions}
                        description="Recorded voucher uses"
                        icon={Users}
                        tone="info"
                    />
                    <SummaryCard
                        label="Expired / scheduled"
                        value={summary.expiredOrScheduled}
                        description="Time-bound voucher states"
                        icon={CalendarClock}
                        tone="warning"
                    />
                </div>

                <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                    <div className="grid gap-toolbar border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_13rem_13rem_auto]">
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search vouchers..."
                                aria-label="Search vouchers"
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
                                className="w-full"
                                aria-label="Filter vouchers by status"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All statuses
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

                        <Select
                            value={sortOption}
                            onValueChange={(value) =>
                                setSortOption(value as VoucherSortOption)
                            }
                        >
                            <SelectTrigger
                                className="w-full"
                                aria-label="Sort vouchers"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">
                                    Newest first
                                </SelectItem>
                                <SelectItem value="code">Code</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="usage">
                                    Most redeemed
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            type="button"
                            variant="outline"
                            disabled={!hasActiveView}
                            onClick={resetView}
                        >
                            <RotateCcw aria-hidden="true" />
                            Reset
                        </Button>
                    </div>

                    {vouchers.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Ticket className="size-6" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-medium">No vouchers yet.</p>
                                <p className="mt-1 text-body text-muted-foreground">
                                    Create the first voucher to unlock sessions
                                    without a payment checkout.
                                </p>
                            </div>
                            <Button asChild size="sm">
                                <Link href={create()}>
                                    <Plus aria-hidden="true" />
                                    Create voucher
                                </Link>
                            </Button>
                        </div>
                    ) : visibleVouchers.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Search className="size-6" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-medium">
                                    No vouchers match your filters.
                                </p>
                                <p className="mt-1 text-body text-muted-foreground">
                                    Try another search or reset the current
                                    view.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={resetView}
                            >
                                Reset filters
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table
                                className="w-full min-w-[1040px] border-collapse text-sm"
                                aria-label="Vouchers"
                            >
                                <thead className="bg-muted/35 text-caption text-muted-foreground">
                                    <tr>
                                        <th className="px-table-x py-3 text-left font-medium">
                                            Code
                                        </th>
                                        <th className="px-table-x py-3 text-left font-medium">
                                            Usage limit
                                        </th>
                                        <th className="px-table-x py-3 text-left font-medium">
                                            Redeemed
                                        </th>
                                        <th className="px-table-x py-3 text-left font-medium">
                                            Validity
                                        </th>
                                        <th className="px-table-x py-3 text-left font-medium">
                                            Status
                                        </th>
                                        <th className="px-table-x py-3 text-right font-medium">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleVouchers.map((voucher) => (
                                        <VoucherRow
                                            key={voucher.id}
                                            voucher={voucher}
                                            now={now}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex flex-col gap-1 border-t px-4 py-3 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Showing {visibleVouchers.length} of{' '}
                            {vouchers.length} vouchers
                        </span>
                        <span>
                            Availability uses the server-provided current time.
                        </span>
                    </div>
                </Card>
            </div>
        </>
    );
}
