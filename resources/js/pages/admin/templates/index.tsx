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
    Info,
    LayoutGrid,
    Pencil,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

type SummaryTone = 'primary' | 'success' | 'warning' | 'info';

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
 * Apply the page's client-side search, status filter, and visual sorting while
 * preserving the server-backed priority order when Priority is selected.
 */
export function filterAndSortTemplates(
    templates: Template[],
    search: string,
    statusFilter: TemplateStatusFilter,
    sortOption: TemplateSortOption,
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
 * Render one concise summary card with a consistent semantic visual treatment.
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
        primary:
            'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
        success:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        warning:
            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        info: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    };

    return (
        <Card
            aria-label={label}
            className="gap-0 px-5 py-5 shadow-sm transition-shadow hover:shadow-md"
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
 * Render a stored template thumbnail or a clear neutral fallback when no
 * thumbnail has been uploaded.
 */
function TemplatePreview({ template }: { template: Template }) {
    if (template.thumbnailUrl !== null) {
        return (
            <div className="flex size-[72px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30 xl:size-20">
                <img
                    src={template.thumbnailUrl}
                    alt={`${template.name} preview`}
                    className="size-full object-contain p-1"
                />
            </div>
        );
    }

    return (
        <div className="flex size-[72px] items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground xl:size-20">
            <ImageIcon className="size-7" aria-hidden="true" />
            <span className="sr-only">
                Preview unavailable for {template.name}
            </span>
        </div>
    );
}

/**
 * Render a sortable template row and preserve all existing management actions.
 */
function SortableTemplateRow({
    template,
    reorderEnabled,
    reordering,
    canMoveUp,
    canMoveDown,
    onMove,
}: {
    template: Template;
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
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={`grid grid-cols-[auto_72px_minmax(0,1fr)] items-center gap-3 border-t p-4 first:border-t-0 xl:grid-cols-[auto_80px_minmax(220px,1fr)_140px_110px_auto] xl:gap-4 ${
                isDragging
                    ? 'relative z-10 bg-background shadow-lg'
                    : 'bg-background'
            }`}
        >
            <Button
                ref={setActivatorNodeRef}
                type="button"
                variant="ghost"
                size="icon"
                disabled={!reorderEnabled || reordering}
                aria-label={`Drag ${template.name} to reorder`}
                className="cursor-grab text-muted-foreground active:cursor-grabbing"
                {...attributes}
                {...listeners}
            >
                <GripVertical aria-hidden="true" />
            </Button>

            <TemplatePreview template={template} />

            <div className="min-w-0">
                <p className="truncate font-semibold">{template.name}</p>
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                    {template.orientation} · {template.printWidthMm} ×{' '}
                    {template.printHeightMm} mm
                </p>
            </div>

            <div className="col-start-3 flex items-center gap-3 xl:col-start-auto">
                <Images
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
                <div>
                    <p className="text-xs text-muted-foreground">Photo Slots</p>
                    <p className="text-sm font-semibold">
                        {template.photoSlots}
                    </p>
                </div>
            </div>

            <div className="col-start-3 xl:col-start-auto">
                <Badge
                    variant="outline"
                    className={
                        template.active
                            ? 'gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'gap-1.5 border-border bg-muted text-muted-foreground'
                    }
                >
                    <span
                        className={`size-1.5 rounded-full ${
                            template.active
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground'
                        }`}
                        aria-hidden="true"
                    />
                    {template.active ? 'Active' : 'Inactive'}
                </Badge>
            </div>

            <div className="col-span-3 flex flex-wrap items-center gap-2 xl:col-span-1 xl:justify-end">
                <Button asChild variant="outline" size="sm">
                    <Link href={TemplateController.edit(template.id)}>
                        <Pencil aria-hidden="true" />
                        Edit
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
                            {...TemplateController.destroy.form(template.id)}
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
        </div>
    );
}

/**
 * Render the operator-focused template management experience.
 */
export default function TemplatesIndex({
    templates,
}: {
    templates: Template[];
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Templates', href: templatesIndex() }],
    });

    const [orderedTemplates, setOrderedTemplates] =
        useState<Template[]>(templates);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] =
        useState<TemplateStatusFilter>('all');
    const [sortOption, setSortOption] =
        useState<TemplateSortOption>('priority');
    const [reordering, setReordering] = useState(false);

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

    useEffect(() => {
        setOrderedTemplates(templates);
    }, [templates]);

    const summary = useMemo(
        () => getTemplateSummary(orderedTemplates),
        [orderedTemplates],
    );

    const visibleTemplates = useMemo(
        () =>
            filterAndSortTemplates(
                orderedTemplates,
                search,
                statusFilter,
                sortOption,
            ),
        [orderedTemplates, search, statusFilter, sortOption],
    );

    const reorderEnabled =
        search.trim() === '' &&
        statusFilter === 'all' &&
        sortOption === 'priority';

    /**
     * Persist a complete ordered ID list through the existing backend reorder
     * contract and roll back the optimistic UI if validation fails.
     */
    function persistOrder(nextTemplates: Template[]): void {
        const previousTemplates = orderedTemplates;

        setOrderedTemplates(nextTemplates);
        setReordering(true);

        router.patch(
            reorder.url(),
            {
                ordered_ids: nextTemplates.map((template) => template.id),
            },
            {
                preserveScroll: true,
                onError: () => {
                    setOrderedTemplates(previousTemplates);
                },
                onFinish: () => {
                    setReordering(false);
                },
            },
        );
    }

    /**
     * Move one template a single position while retaining the complete kiosk
     * priority list.
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
     * Restore the management view to its default complete priority list.
     */
    function resetView(): void {
        setSearch('');
        setStatusFilter('all');
        setSortOption('priority');
    }

    return (
        <>
            <Head title="Templates" />

            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            Templates
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Manage the photo templates available in your kiosk.
                            Templates at the top appear first.
                        </p>
                    </div>

                    <Button asChild size="lg" className="self-start">
                        <Link href={create()}>
                            <Plus aria-hidden="true" />
                            New Template
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total Templates"
                        value={summary.total}
                        description="All templates in your kiosk"
                        icon={<LayoutGrid className="size-6" />}
                        tone="primary"
                    />

                    <SummaryCard
                        label="Active"
                        value={summary.active}
                        description="Currently enabled"
                        icon={<CircleCheck className="size-6" />}
                        tone="success"
                    />

                    <SummaryCard
                        label="Inactive"
                        value={summary.inactive}
                        description="Currently disabled"
                        icon={<CirclePause className="size-6" />}
                        tone="warning"
                    />

                    <SummaryCard
                        label="Avg Photo Slots"
                        value={summary.averagePhotoSlots}
                        description="Across all templates"
                        icon={<Images className="size-6" />}
                        tone="info"
                    />
                </div>

                <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                    <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
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
                                    Sort by: Priority
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

                    {orderedTemplates.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <LayoutGrid className="size-6" />
                            </div>
                            <div>
                                <p className="font-medium">No templates yet.</p>
                                <p className="mt-1 text-sm text-muted-foreground">
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
                                <p className="mt-1 text-sm text-muted-foreground">
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
                                <div>
                                    {visibleTemplates.map((template) => {
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
                                                reorderEnabled={reorderEnabled}
                                                reordering={reordering}
                                                canMoveUp={priorityIndex > 0}
                                                canMoveDown={
                                                    priorityIndex >= 0 &&
                                                    priorityIndex <
                                                        orderedTemplates.length -
                                                            1
                                                }
                                                onMove={moveTemplate}
                                            />
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    {orderedTemplates.length > 0 && (
                        <div className="border-t p-4">
                            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                                <Info
                                    className="mt-0.5 size-5 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <div>
                                    <p className="text-sm font-medium">
                                        {reorderEnabled
                                            ? 'Drag the handle or use the arrows to reorder templates.'
                                            : 'Reordering is paused while filters or another sort are active.'}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {reorderEnabled
                                            ? 'Templates at the top appear first in the kiosk.'
                                            : 'Clear the search, select All Statuses, and sort by Priority to change kiosk order.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
