import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Form, Head, Link, router, setLayoutProps } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    CircleCheck,
    CirclePause,
    GripVertical,
    Layers,
    LayoutGrid,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
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
import { Switch } from '@/components/ui/switch';
import {
    create,
    index as stickersIndex,
    reorder,
} from '@/routes/admin/stickers';

export type Sticker = {
    id: number;
    name: string;
    assetUrl: string;
    thumbnailUrl: string | null;
    active: boolean;
    sortOrder: number;
    templateIds: number[];
};

export type StickerStatusFilter = 'all' | 'active' | 'inactive';
export type StickerSortOption = 'priority' | 'name' | 'status';

type StickerSummary = {
    total: number;
    active: number;
    inactive: number;
    allTemplates: number;
};

type SummaryTone = 'neutral' | 'success' | 'warning' | 'info';

/**
 * Calculate operator-focused sticker totals directly from the existing
 * management payload without introducing an additional aggregate endpoint.
 */
export function getStickerSummary(stickers: Sticker[]): StickerSummary {
    const active = stickers.filter((sticker) => sticker.active).length;

    return {
        total: stickers.length,
        active,
        inactive: stickers.length - active,
        allTemplates: stickers.filter(
            (sticker) => sticker.templateIds.length === 0,
        ).length,
    };
}

/**
 * Convert the repository's template-restriction contract into plain language
 * for non-technical administrators.
 */
export function getStickerCompatibilityLabel(sticker: Sticker): string {
    if (sticker.templateIds.length === 0) {
        return 'All templates';
    }

    if (sticker.templateIds.length === 1) {
        return 'Limited to 1 template';
    }

    return `Limited to ${sticker.templateIds.length} templates`;
}

/**
 * Apply client-side search, status filtering, and visual sorting while keeping
 * the backend-provided priority order untouched when Priority is selected.
 */
export function filterAndSortStickers(
    stickers: Sticker[],
    search: string,
    statusFilter: StickerStatusFilter,
    sortOption: StickerSortOption,
): Sticker[] {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = stickers.filter((sticker) => {
        const matchesSearch =
            normalizedSearch.length === 0 ||
            sticker.name.toLowerCase().includes(normalizedSearch);

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && sticker.active) ||
            (statusFilter === 'inactive' && !sticker.active);

        return matchesSearch && matchesStatus;
    });

    if (sortOption === 'priority') {
        return filtered;
    }

    return [...filtered].sort((first, second) => {
        if (sortOption === 'name') {
            return first.name.localeCompare(second.name);
        }

        if (first.active !== second.active) {
            return first.active ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
    });
}

/**
 * Render one concise summary card using the application's semantic design
 * tokens instead of introducing page-specific colors.
 */
function SummaryCard({
    label,
    value,
    description,
    icon,
    tone,
}: {
    label: string;
    value: number;
    description: string;
    icon: ReactNode;
    tone: SummaryTone;
}) {
    const toneClasses: Record<SummaryTone, string> = {
        neutral: 'bg-muted text-foreground',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        info: 'bg-info-subtle text-info',
    };

    return (
        <Card
            aria-label={label}
            className="gap-0 px-5 py-5 transition-shadow hover:shadow-md"
        >
            <div className="flex items-center gap-4">
                <div
                    className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
                >
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-2xl font-semibold tracking-tight">
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
 * Render the preferred sticker thumbnail and fall back to the primary asset
 * when no dedicated thumbnail exists.
 */
function StickerPreview({ sticker }: { sticker: Sticker }) {
    return (
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
            <img
                src={sticker.thumbnailUrl ?? sticker.assetUrl}
                alt={sticker.name}
                className="size-full object-contain p-1"
            />
        </div>
    );
}

/**
 * Render one sortable sticker management row with compact operator actions,
 * accessible ordering fallbacks, and protected destructive deletion.
 */
function SortableStickerRow({
    sticker,
    priority,
    reorderEnabled,
    reordering,
    canMoveUp,
    canMoveDown,
    onMove,
}: {
    sticker: Sticker;
    priority: number;
    reorderEnabled: boolean;
    reordering: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (stickerId: number, direction: -1 | 1) => void;
}) {
    const [deleteOpen, setDeleteOpen] = useState(false);

    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: sticker.id,
        disabled: !reorderEnabled || reordering,
    });

    return (
        <>
            <div
                ref={setNodeRef}
                style={{
                    transform: CSS.Transform.toString(transform),
                    transition,
                }}
                className={`grid grid-cols-[44px_52px_minmax(0,1fr)] items-center gap-3 border-b bg-background p-4 last:border-b-0 lg:grid-cols-[44px_52px_minmax(240px,1fr)_minmax(170px,0.75fr)_160px_160px] lg:gap-4 ${
                    isDragging ? 'relative z-10 shadow-lg' : ''
                }`}
            >
                <Button
                    ref={setActivatorNodeRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!reorderEnabled || reordering}
                    aria-label={`Drag ${sticker.name} to reorder`}
                    className="cursor-grab text-muted-foreground active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical aria-hidden="true" />
                </Button>

                <div
                    className="flex size-9 items-center justify-center rounded-md bg-muted text-sm font-medium"
                    aria-label={`Priority ${priority}`}
                >
                    {priority}
                </div>

                <div className="flex min-w-0 items-center gap-3">
                    <StickerPreview sticker={sticker} />

                    <div className="min-w-0">
                        <p className="truncate font-semibold">{sticker.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Sticker overlay
                        </p>
                    </div>
                </div>

                <div className="col-start-3 flex items-center gap-2 text-sm lg:col-start-auto">
                    <LayoutGrid
                        className="size-4 shrink-0 text-info"
                        aria-hidden="true"
                    />
                    <span className="text-muted-foreground">
                        {getStickerCompatibilityLabel(sticker)}
                    </span>
                </div>

                <div className="col-start-3 flex items-center gap-3 lg:col-start-auto">
                    <Badge
                        variant="outline"
                        className={
                            sticker.active
                                ? 'border-success/30 bg-success-subtle text-success-foreground'
                                : 'border-border bg-muted text-muted-foreground'
                        }
                    >
                        {sticker.active ? 'Active' : 'Inactive'}
                    </Badge>

                    <Form
                        {...StickerController.toggle.form(sticker.id)}
                        options={{ preserveScroll: true }}
                        className="inline-flex"
                    >
                        {({ processing, submit }) => (
                            <Switch
                                checked={sticker.active}
                                disabled={processing}
                                onCheckedChange={() => submit()}
                                aria-label={`${
                                    sticker.active ? 'Disable' : 'Enable'
                                } ${sticker.name}`}
                                className="data-[state=checked]:bg-success"
                            />
                        )}
                    </Form>
                </div>

                <div className="col-start-3 flex items-center gap-2 lg:col-start-auto lg:justify-end">
                    <Button asChild variant="outline" size="sm">
                        <Link href={StickerController.edit(sticker.id)}>
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
                                aria-label={`More actions for ${sticker.name}`}
                            >
                                <MoreHorizontal aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                disabled={
                                    !reorderEnabled || reordering || !canMoveUp
                                }
                                onSelect={() => onMove(sticker.id, -1)}
                            >
                                <ArrowUp aria-hidden="true" />
                                Move up
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                disabled={
                                    !reorderEnabled ||
                                    reordering ||
                                    !canMoveDown
                                }
                                onSelect={() => onMove(sticker.id, 1)}
                            >
                                <ArrowDown aria-hidden="true" />
                                Move down
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeleteOpen(true)}
                            >
                                <Trash2 aria-hidden="true" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogTitle>
                        Delete &quot;{sticker.name}&quot;?
                    </DialogTitle>

                    <DialogDescription>
                        This cannot be undone. Stickers referenced by existing
                        photobooth sessions cannot be deleted.
                    </DialogDescription>

                    <Form
                        {...StickerController.destroy.form(sticker.id)}
                        options={{ preserveScroll: true }}
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
                                        disabled={processing}
                                    >
                                        {processing
                                            ? 'Deleting...'
                                            : 'Delete sticker'}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * Render the redesigned operator-focused Sticker Management experience while
 * preserving all existing CRUD and reorder contracts.
 */
export default function StickersIndex({ stickers }: { stickers: Sticker[] }) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Stickers', href: stickersIndex() }],
    });

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] =
        useState<StickerStatusFilter>('all');
    const [sortOption, setSortOption] = useState<StickerSortOption>('priority');
    const [reordering, setReordering] = useState(false);
    const [optimisticOrderIds, setOptimisticOrderIds] = useState<
        number[] | null
    >(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const canonicalStickers = useMemo(
        () =>
            [...stickers].sort(
                (first, second) => first.sortOrder - second.sortOrder,
            ),
        [stickers],
    );

    const orderedStickers = useMemo(() => {
        if (optimisticOrderIds === null) {
            return canonicalStickers;
        }

        const stickersById = new Map(
            canonicalStickers.map((sticker) => [sticker.id, sticker]),
        );

        const optimisticStickers = optimisticOrderIds.flatMap((stickerId) => {
            const sticker = stickersById.get(stickerId);

            return sticker === undefined ? [] : [sticker];
        });

        const optimisticIds = new Set(optimisticOrderIds);
        const newCanonicalStickers = canonicalStickers.filter(
            (sticker) => !optimisticIds.has(sticker.id),
        );

        return [...optimisticStickers, ...newCanonicalStickers];
    }, [canonicalStickers, optimisticOrderIds]);

    const summary = useMemo(
        () => getStickerSummary(orderedStickers),
        [orderedStickers],
    );

    const visibleStickers = useMemo(
        () =>
            filterAndSortStickers(
                orderedStickers,
                search,
                statusFilter,
                sortOption,
            ),
        [orderedStickers, search, statusFilter, sortOption],
    );

    const reorderEnabled =
        search.trim() === '' &&
        statusFilter === 'all' &&
        sortOption === 'priority';

    /**
     * Persist a complete canonical sticker order using temporary optimistic
     * IDs while allowing refreshed Inertia props to remain authoritative.
     */
    function persistOrder(nextStickers: Sticker[]): void {
        const orderedIds = nextStickers.map((sticker) => sticker.id);

        setOptimisticOrderIds(orderedIds);
        setReordering(true);

        router.patch(
            reorder.url(),
            {
                ordered_ids: orderedIds,
            },
            {
                preserveScroll: true,
                onError: () => {
                    setOptimisticOrderIds(null);
                },
                onFinish: () => {
                    setOptimisticOrderIds(null);
                    setReordering(false);
                },
            },
        );
    }

    /**
     * Move one sticker by a single canonical priority position using the same
     * persistence contract as drag-and-drop ordering.
     */
    function moveSticker(stickerId: number, direction: -1 | 1): void {
        if (!reorderEnabled || reordering) {
            return;
        }

        const currentIndex = orderedStickers.findIndex(
            (sticker) => sticker.id === stickerId,
        );
        const targetIndex = currentIndex + direction;

        if (
            currentIndex < 0 ||
            targetIndex < 0 ||
            targetIndex >= orderedStickers.length
        ) {
            return;
        }

        persistOrder(arrayMove(orderedStickers, currentIndex, targetIndex));
    }

    /**
     * Translate a completed dnd-kit interaction into the application's
     * existing complete ordered-ID reorder request.
     */
    function handleDragEnd(event: DragEndEvent): void {
        if (
            !reorderEnabled ||
            reordering ||
            event.over === null ||
            event.active.id === event.over.id
        ) {
            return;
        }

        const currentIndex = orderedStickers.findIndex(
            (sticker) => sticker.id === event.active.id,
        );
        const targetIndex = orderedStickers.findIndex(
            (sticker) => sticker.id === event.over?.id,
        );

        if (currentIndex < 0 || targetIndex < 0) {
            return;
        }

        persistOrder(arrayMove(orderedStickers, currentIndex, targetIndex));
    }

    return (
        <>
            <Head title="Stickers" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="[&>header]:mb-0">
                        <Heading
                            title="Stickers"
                            description="Manage the sticker overlays available in the kiosk."
                        />
                    </div>

                    <Button asChild className="sm:self-start">
                        <Link href={create()}>
                            <Plus aria-hidden="true" />
                            New sticker
                        </Link>
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total stickers"
                        value={summary.total}
                        description="All stickers in the system"
                        icon={<Layers className="size-6" aria-hidden="true" />}
                        tone="neutral"
                    />

                    <SummaryCard
                        label="Active"
                        value={summary.active}
                        description="Visible in the kiosk"
                        icon={
                            <CircleCheck
                                className="size-6"
                                aria-hidden="true"
                            />
                        }
                        tone="success"
                    />

                    <SummaryCard
                        label="Inactive"
                        value={summary.inactive}
                        description="Hidden from the kiosk"
                        icon={
                            <CirclePause
                                className="size-6"
                                aria-hidden="true"
                            />
                        }
                        tone="warning"
                    />

                    <SummaryCard
                        label="Compatibility"
                        value={summary.allTemplates}
                        description="Available on all templates"
                        icon={
                            <LayoutGrid className="size-6" aria-hidden="true" />
                        }
                        tone="info"
                    />
                </div>

                <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                            <div className="relative w-full md:max-w-xl">
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
                                    placeholder="Search stickers..."
                                    aria-label="Search stickers"
                                    className="pl-9"
                                />
                            </div>

                            <div
                                role="group"
                                aria-label="Filter stickers by status"
                                className="inline-flex w-fit items-center rounded-lg border bg-background p-1"
                            >
                                <Button
                                    type="button"
                                    variant={
                                        statusFilter === 'all'
                                            ? 'secondary'
                                            : 'ghost'
                                    }
                                    size="sm"
                                    aria-pressed={statusFilter === 'all'}
                                    onClick={() => setStatusFilter('all')}
                                >
                                    All
                                </Button>

                                <Button
                                    type="button"
                                    variant={
                                        statusFilter === 'active'
                                            ? 'secondary'
                                            : 'ghost'
                                    }
                                    size="sm"
                                    aria-pressed={statusFilter === 'active'}
                                    onClick={() => setStatusFilter('active')}
                                >
                                    Active
                                </Button>

                                <Button
                                    type="button"
                                    variant={
                                        statusFilter === 'inactive'
                                            ? 'secondary'
                                            : 'ghost'
                                    }
                                    size="sm"
                                    aria-pressed={statusFilter === 'inactive'}
                                    onClick={() => setStatusFilter('inactive')}
                                >
                                    Inactive
                                </Button>
                            </div>
                        </div>

                        <Select
                            value={sortOption}
                            onValueChange={(value) =>
                                setSortOption(value as StickerSortOption)
                            }
                        >
                            <SelectTrigger
                                className="w-full lg:w-44"
                                aria-label="Sort stickers"
                            >
                                <SelectValue placeholder="Sort stickers" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="priority">
                                    Sort by: Order
                                </SelectItem>
                                <SelectItem value="name">
                                    Sort by: Name
                                </SelectItem>
                                <SelectItem value="status">
                                    Sort by: Status
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="hidden grid-cols-[44px_52px_minmax(240px,1fr)_minmax(170px,0.75fr)_160px_160px] items-center gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground lg:grid">
                        <span className="sr-only">Reorder</span>
                        <span>Order</span>
                        <span>Sticker</span>
                        <span>Compatibility</span>
                        <span>Status</span>
                        <span className="text-right">Actions</span>
                    </div>

                    {orderedStickers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                <Layers className="size-6" aria-hidden="true" />
                            </div>

                            <div>
                                <p className="font-medium">No stickers yet.</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Add your first sticker overlay for the
                                    kiosk.
                                </p>
                            </div>

                            <Button asChild size="sm">
                                <Link href={create()}>
                                    <Plus aria-hidden="true" />
                                    New sticker
                                </Link>
                            </Button>
                        </div>
                    ) : visibleStickers.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <p className="font-medium">
                                No stickers match your current search or
                                filters.
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Adjust the search or status filter to see more
                                results.
                            </p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={visibleStickers.map(
                                    (sticker) => sticker.id,
                                )}
                                strategy={verticalListSortingStrategy}
                            >
                                {visibleStickers.map((sticker) => {
                                    const canonicalIndex =
                                        orderedStickers.findIndex(
                                            (candidate) =>
                                                candidate.id === sticker.id,
                                        );

                                    return (
                                        <SortableStickerRow
                                            key={sticker.id}
                                            sticker={sticker}
                                            priority={canonicalIndex + 1}
                                            reorderEnabled={reorderEnabled}
                                            reordering={reordering}
                                            canMoveUp={canonicalIndex > 0}
                                            canMoveDown={
                                                canonicalIndex <
                                                orderedStickers.length - 1
                                            }
                                            onMove={moveSticker}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    )}

                    {orderedStickers.length > 0 && (
                        <div className="flex flex-col gap-1 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                Showing {visibleStickers.length} of{' '}
                                {orderedStickers.length} stickers
                            </span>

                            {!reorderEnabled && orderedStickers.length > 1 && (
                                <span className="text-xs">
                                    Clear filters and sort by order to reorder.
                                </span>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
