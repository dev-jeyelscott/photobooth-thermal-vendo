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
    ImageIcon,
    Images,
    LayoutGrid,
    Pencil,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
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
    DialogTrigger,
} from '@/components/ui/dialog';
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
    index as templatesIndex,
    reorder,
} from '@/routes/admin/templates';

export type Template = {
    id: number;
    name: string;
    slug: string;
    orientation: 'portrait' | 'landscape';
    layoutPath: string;
    layoutUrl: string;
    thumbnailPath: string | null;
    thumbnailUrl: string | null;
    photoSlots: number;
    printWidthMm: number;
    printHeightMm: number;
    active: boolean;
    sortOrder: number;
    printerCompatibility: Record<string, unknown> | null;
};

export type TemplateStatusFilter = 'all' | 'active' | 'inactive';
export type TemplateSortOption = 'priority' | 'name' | 'status';

type TemplateSummary = {
    total: number;
    active: number;
    inactive: number;
    averagePhotoSlots: string;
};

type SummaryTone = 'primary' | 'success' | 'neutral' | 'info';

/**
 * Calculate high-level template statistics directly from the existing page
 * payload without adding unnecessary aggregate endpoints.
 */
export function getTemplateSummary(templates: Template[]): TemplateSummary {
    const active = templates.filter((template) => template.active).length;
    const slotTotal = templates.reduce(
        (total, template) => total + template.photoSlots,
        0,
    );

    return {
        total: templates.length,
        active,
        inactive: templates.length - active,
        averagePhotoSlots:
            templates.length === 0
                ? '0'
                : (slotTotal / templates.length).toFixed(1),
    };
}

/**
 * Apply the page's client-side search, status filter, photo-slot filter, and
 * visual sorting while preserving server-backed display order by default.
 */
export function filterAndSortTemplates(
    templates: Template[],
    search: string,
    statusFilter: TemplateStatusFilter,
    sortOption: TemplateSortOption,
    photoSlotsFilter = 'all',
): Template[] {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = templates.filter((template) => {
        const matchesSearch =
            normalizedSearch.length === 0 ||
            template.name.toLowerCase().includes(normalizedSearch) ||
            template.slug.toLowerCase().includes(normalizedSearch) ||
            template.orientation.toLowerCase().includes(normalizedSearch);

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && template.active) ||
            (statusFilter === 'inactive' && !template.active);

        const matchesPhotoSlots =
            photoSlotsFilter === 'all' ||
            template.photoSlots === Number(photoSlotsFilter);

        return matchesSearch && matchesStatus && matchesPhotoSlots;
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
 * Render one compact summary metric using the canonical semantic color system.
 */
function SummaryCard({
    label,
    value,
    description,
    icon,
    tone,
}: {
    label: string;
    value: string | number;
    description: string;
    icon: ReactNode;
    tone: SummaryTone;
}) {
    const toneClasses: Record<SummaryTone, string> = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success-subtle text-success',
        neutral: 'bg-muted text-muted-foreground',
        info: 'bg-info-subtle text-info',
    };

    return (
        <Card
            aria-label={label}
            className="gap-0 rounded-xl px-5 py-4 shadow-xs"
        >
            <div className="flex min-h-20 items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-card-title">{label}</p>
                        <span
                            className="size-1.5 rounded-full bg-muted-foreground/35"
                            aria-hidden="true"
                        />
                    </div>
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
                    {icon}
                </div>
            </div>
        </Card>
    );
}

/**
 * Render a stored template thumbnail or a clear neutral fallback when no
 * thumbnail has been uploaded.
 */
function TemplatePreview({ template }: { template: Template }) {
    if (template.thumbnailUrl !== null) {
        return (
            <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                <img
                    src={template.thumbnailUrl}
                    alt={`${template.name} preview`}
                    className="size-full object-contain p-1"
                />
            </div>
        );
    }

    return (
        <div className="flex h-14 w-20 items-center justify-center rounded-md border bg-muted/35 text-muted-foreground">
            <ImageIcon className="size-5" aria-hidden="true" />
            <span className="sr-only">
                Preview unavailable for {template.name}
            </span>
        </div>
    );
}

/**
 * Render the active or inactive template state using canonical semantic status
 * colors and a text label so state is never communicated by color alone.
 */
function TemplateStatusBadge({ active }: { active: boolean }) {
    return (
        <Badge
            variant="outline"
            className={
                active
                    ? 'gap-1.5 border-success/25 bg-success-subtle text-success-foreground'
                    : 'gap-1.5 border-border bg-muted text-muted-foreground'
            }
        >
            <span
                className={`size-1.5 rounded-full ${
                    active ? 'bg-success' : 'bg-muted-foreground'
                }`}
                aria-hidden="true"
            />
            {active ? 'Active' : 'Inactive'}
        </Badge>
    );
}

/**
 * Render one sortable semantic table row while preserving edit, toggle,
 * accessible arrow reordering, drag reordering, and guarded deletion.
 */
function SortableTemplateRow({
    template,
    displayOrder,
    reorderEnabled,
    reordering,
    canMoveUp,
    canMoveDown,
    onMove,
}: {
    template: Template;
    displayOrder: number;
    reorderEnabled: boolean;
    reordering: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (templateId: number, direction: -1 | 1) => void;
}) {
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: template.id,
        disabled: !reorderEnabled || reordering,
    });

    return (
        <tr
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={
                isDragging
                    ? 'relative z-10 border-t bg-background shadow-md'
                    : 'border-t bg-background transition-colors hover:bg-muted/20'
            }
        >
            <td className="w-12 px-2 py-table-y text-center">
                <Button
                    ref={setActivatorNodeRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!reorderEnabled || reordering}
                    aria-label={`Drag ${template.name} to reorder`}
                    className="size-8 cursor-grab text-muted-foreground active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical aria-hidden="true" />
                </Button>
            </td>

            <td className="w-28 px-table-x py-table-y text-sm font-medium tabular-nums">
                {displayOrder}
            </td>

            <td className="w-28 px-table-x py-table-y">
                <TemplatePreview template={template} />
            </td>

            <td className="min-w-64 px-table-x py-table-y">
                <p className="font-medium text-foreground">{template.name}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                    {template.slug} · {template.orientation}
                </p>
            </td>

            <td className="w-32 px-table-x py-table-y">
                <div className="flex items-center gap-2">
                    <Images
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <span className="tabular-nums">{template.photoSlots}</span>
                </div>
            </td>

            <td className="w-32 px-table-x py-table-y tabular-nums">
                {template.printWidthMm} × {template.printHeightMm}
            </td>

            <td className="w-32 px-table-x py-table-y">
                <TemplateStatusBadge active={template.active} />
            </td>

            <td className="w-56 px-table-x py-table-y">
                <div className="flex items-center justify-end gap-1.5">
                    <Button asChild variant="outline" size="icon">
                        <Link href={TemplateController.edit(template.id)}>
                            <Pencil aria-hidden="true" />
                            <span className="sr-only">
                                Edit {template.name}
                            </span>
                        </Link>
                    </Button>

                    <Form
                        {...TemplateController.toggle.form(template.id)}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing, submit }) => (
                            <Switch
                                checked={template.active}
                                disabled={processing}
                                onCheckedChange={() => submit()}
                                aria-label={`${
                                    template.active ? 'Disable' : 'Enable'
                                } ${template.name}`}
                                className="data-[state=checked]:bg-success"
                            />
                        )}
                    </Form>

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={!reorderEnabled || reordering || !canMoveUp}
                        onClick={() => onMove(template.id, -1)}
                        aria-label={`Move ${template.name} up`}
                    >
                        <ArrowUp aria-hidden="true" />
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={!reorderEnabled || reordering || !canMoveDown}
                        onClick={() => onMove(template.id, 1)}
                        aria-label={`Move ${template.name} down`}
                    >
                        <ArrowDown aria-hidden="true" />
                    </Button>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={`Delete ${template.name}`}
                                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <Trash2 aria-hidden="true" />
                            </Button>
                        </DialogTrigger>

                        <DialogContent>
                            <DialogTitle>
                                Delete &quot;{template.name}&quot;?
                            </DialogTitle>

                            <DialogDescription>
                                This cannot be undone. Templates referenced by
                                existing photobooth sessions cannot be deleted.
                            </DialogDescription>

                            <Form
                                {...TemplateController.destroy.form(
                                    template.id,
                                )}
                                options={{ preserveScroll: true }}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        {errors.template && (
                                            <p className="text-sm text-destructive">
                                                {errors.template}
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
                                                    : 'Delete Template'}
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
    );
}

/**
 * Render the operator-focused template management experience using the shared
 * admin shell, canonical tokens, and the existing Laravel route contracts.
 */
export default function TemplatesIndex({
    templates,
}: {
    templates: Template[];
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Templates', href: templatesIndex() }],
    });

    const [optimisticTemplates, setOptimisticTemplates] = useState<
        Template[] | null
    >(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] =
        useState<TemplateStatusFilter>('all');
    const [photoSlotsFilter, setPhotoSlotsFilter] = useState('all');
    const [sortOption, setSortOption] =
        useState<TemplateSortOption>('priority');
    const [reordering, setReordering] = useState(false);

    const orderedTemplates = optimisticTemplates ?? templates;

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

    const summary = useMemo(
        () => getTemplateSummary(orderedTemplates),
        [orderedTemplates],
    );

    const photoSlotOptions = useMemo(
        () =>
            [
                ...new Set(
                    orderedTemplates.map((template) => template.photoSlots),
                ),
            ]
                .sort((first, second) => first - second)
                .map(String),
        [orderedTemplates],
    );

    const visibleTemplates = useMemo(
        () =>
            filterAndSortTemplates(
                orderedTemplates,
                search,
                statusFilter,
                sortOption,
                photoSlotsFilter,
            ),
        [orderedTemplates, photoSlotsFilter, search, sortOption, statusFilter],
    );

    const reorderEnabled =
        search.trim() === '' &&
        statusFilter === 'all' &&
        photoSlotsFilter === 'all' &&
        sortOption === 'priority';

    /**
     * Persist a complete ordered ID list through the existing backend reorder
     * contract and keep the server payload authoritative after completion.
     */
    function persistOrder(nextTemplates: Template[]): void {
        setOptimisticTemplates(nextTemplates);
        setReordering(true);

        router.patch(
            reorder.url(),
            {
                ordered_ids: nextTemplates.map((template) => template.id),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOptimisticTemplates(null);
                },
                onError: () => {
                    setOptimisticTemplates(null);
                },
                onFinish: () => {
                    setReordering(false);
                },
            },
        );
    }

    /**
     * Move one template a single priority position while retaining the complete
     * kiosk order submitted to the backend.
     */
    function moveTemplate(templateId: number, direction: -1 | 1): void {
        if (!reorderEnabled || reordering) {
            return;
        }

        const currentIndex = orderedTemplates.findIndex(
            (template) => template.id === templateId,
        );
        const targetIndex = currentIndex + direction;

        if (
            currentIndex < 0 ||
            targetIndex < 0 ||
            targetIndex >= orderedTemplates.length
        ) {
            return;
        }

        persistOrder(arrayMove(orderedTemplates, currentIndex, targetIndex));
    }

    /**
     * Persist the new priority after an accessible pointer or keyboard drag.
     */
    function handleDragEnd(event: DragEndEvent): void {
        if (!reorderEnabled || reordering || event.over === null) {
            return;
        }

        const activeId = Number(event.active.id);
        const overId = Number(event.over.id);

        if (activeId === overId) {
            return;
        }

        const oldIndex = orderedTemplates.findIndex(
            (template) => template.id === activeId,
        );
        const newIndex = orderedTemplates.findIndex(
            (template) => template.id === overId,
        );

        if (oldIndex < 0 || newIndex < 0) {
            return;
        }

        persistOrder(arrayMove(orderedTemplates, oldIndex, newIndex));
    }

    /**
     * Restore the management view to the unfiltered server-backed display order.
     */
    function resetView(): void {
        setSearch('');
        setStatusFilter('all');
        setPhotoSlotsFilter('all');
        setSortOption('priority');
    }

    return (
        <>
            <Head title="Templates" />

            <div className="flex w-full flex-col gap-section p-page md:p-page-desktop">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-page-title sm:text-2xl">
                            Templates
                        </h1>
                        <p className="mt-1 text-body text-muted-foreground">
                            Manage printable photo layouts for the photobooth.
                        </p>
                    </div>

                    <Button asChild className="self-start">
                        <Link href={create()}>
                            <Plus aria-hidden="true" />
                            Create Template
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total Templates"
                        value={summary.total}
                        description="All time"
                        icon={<LayoutGrid className="size-5" />}
                        tone="primary"
                    />

                    <SummaryCard
                        label="Active Templates"
                        value={summary.active}
                        description={
                            summary.total === 0
                                ? 'No templates yet'
                                : `${((summary.active / summary.total) * 100).toFixed(1)}% of total`
                        }
                        icon={<CircleCheck className="size-5" />}
                        tone="success"
                    />

                    <SummaryCard
                        label="Inactive Templates"
                        value={summary.inactive}
                        description={
                            summary.total === 0
                                ? 'No templates yet'
                                : `${((summary.inactive / summary.total) * 100).toFixed(1)}% of total`
                        }
                        icon={<CirclePause className="size-5" />}
                        tone="neutral"
                    />

                    <SummaryCard
                        label="Average Photo Slots"
                        value={summary.averagePhotoSlots}
                        description="Across all templates"
                        icon={<Images className="size-5" />}
                        tone="info"
                    />
                </div>

                <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                    <div className="grid gap-toolbar border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_12rem_12rem_13rem]">
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
                                placeholder="Search templates..."
                                aria-label="Search templates"
                                className="pl-9"
                            />
                        </div>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) =>
                                setStatusFilter(value as TemplateStatusFilter)
                            }
                        >
                            <SelectTrigger
                                className="w-full"
                                aria-label="Filter templates by status"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Statuses
                                </SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">
                                    Inactive
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={photoSlotsFilter}
                            onValueChange={setPhotoSlotsFilter}
                        >
                            <SelectTrigger
                                className="w-full"
                                aria-label="Filter templates by photo slots"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Photo Slots
                                </SelectItem>
                                {photoSlotOptions.map((photoSlots) => (
                                    <SelectItem
                                        key={photoSlots}
                                        value={photoSlots}
                                    >
                                        {photoSlots}{' '}
                                        {photoSlots === '1' ? 'slot' : 'slots'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={sortOption}
                            onValueChange={(value) =>
                                setSortOption(value as TemplateSortOption)
                            }
                        >
                            <SelectTrigger
                                className="w-full"
                                aria-label="Sort templates"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="priority">
                                    Display Order
                                </SelectItem>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {orderedTemplates.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <LayoutGrid className="size-6" />
                            </div>
                            <div>
                                <p className="font-medium">No templates yet.</p>
                                <p className="mt-1 text-body text-muted-foreground">
                                    Create your first template to make it
                                    available in the kiosk.
                                </p>
                            </div>
                        </div>
                    ) : visibleTemplates.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Search className="size-6" />
                            </div>
                            <div>
                                <p className="font-medium">
                                    No templates match your filters.
                                </p>
                                <p className="mt-1 text-body text-muted-foreground">
                                    Try another search or reset the current
                                    filters.
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
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={visibleTemplates.map(
                                    (template) => template.id,
                                )}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="overflow-x-auto">
                                    <table
                                        className="w-full min-w-[1180px] border-collapse text-sm"
                                        aria-label="Photo templates"
                                    >
                                        <thead className="bg-muted/35 text-caption text-muted-foreground">
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className="w-12 px-2 py-3 text-center font-medium"
                                                >
                                                    <span className="sr-only">
                                                        Reorder
                                                    </span>
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-left font-medium"
                                                >
                                                    Display Order
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-left font-medium"
                                                >
                                                    Preview
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-left font-medium"
                                                >
                                                    Template Name
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-left font-medium"
                                                >
                                                    Photo Slots
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-left font-medium"
                                                >
                                                    Print Size (mm)
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-left font-medium"
                                                >
                                                    State
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-table-x py-3 text-right font-medium"
                                                >
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleTemplates.map(
                                                (template) => {
                                                    const priorityIndex =
                                                        orderedTemplates.findIndex(
                                                            (candidate) =>
                                                                candidate.id ===
                                                                template.id,
                                                        );

                                                    return (
                                                        <SortableTemplateRow
                                                            key={template.id}
                                                            template={template}
                                                            displayOrder={
                                                                priorityIndex +
                                                                1
                                                            }
                                                            reorderEnabled={
                                                                reorderEnabled
                                                            }
                                                            reordering={
                                                                reordering
                                                            }
                                                            canMoveUp={
                                                                priorityIndex >
                                                                0
                                                            }
                                                            canMoveDown={
                                                                priorityIndex >=
                                                                    0 &&
                                                                priorityIndex <
                                                                    orderedTemplates.length -
                                                                        1
                                                            }
                                                            onMove={
                                                                moveTemplate
                                                            }
                                                        />
                                                    );
                                                },
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    {orderedTemplates.length > 0 && (
                        <div className="flex flex-col gap-1 border-t px-4 py-3 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                Showing {visibleTemplates.length} of{' '}
                                {orderedTemplates.length} templates
                            </span>
                            <span>
                                {reorderEnabled
                                    ? 'Drag rows or use the arrow controls to change kiosk display order.'
                                    : 'Clear filters and select Display Order to enable reordering.'}
                            </span>
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
