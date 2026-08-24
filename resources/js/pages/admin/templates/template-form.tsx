import { Form, Link } from '@inertiajs/react';
import {
    ChevronDown,
    Clock3,
    Copy,
    ExternalLink,
    FileImage,
    FileText,
    Info,
    Lightbulb,
    Plus,
    Save,
    Trash2,
    TriangleAlert,
    Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index as templatesIndex } from '@/routes/admin/templates';
import type { RouteFormDefinition } from '@/wayfinder';

type Orientation = 'portrait' | 'landscape';
type LayoutCoordinate = 'x' | 'y' | 'width' | 'height';
type PreviewScale = 50 | 75 | 100;

export type LayoutSlot = {
    slot: number;
    x: number;
    y: number;
    width: number;
    height: number;
    [key: string]: unknown;
};

export type LayoutConfig = {
    slots: LayoutSlot[];
    [key: string]: unknown;
};

export type Template = {
    id: number;
    name: string;
    slug: string;
    orientation: Orientation;
    layoutPath: string;
    layoutUrl?: string;
    thumbnailPath: string | null;
    thumbnailUrl?: string | null;
    photoSlots: number;
    layoutConfig: Record<string, unknown> | null;
    printWidthMm: number;
    printHeightMm: number;
    active: boolean;
    sortOrder: number;
    printerCompatibility: Record<string, unknown> | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

const DEFAULT_PHOTO_SLOTS = 1;
const DEFAULT_PRINT_WIDTH_MM = 100;
const DEFAULT_PRINT_HEIGHT_MM = 150;

const textareaClassName =
    'flex min-h-28 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';

/**
 * Determine whether an unknown JSON value is a plain object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Determine whether a decoded layout slot contains all renderer-required integer fields.
 */
function isLayoutSlot(value: unknown): value is LayoutSlot {
    if (!isRecord(value)) {
        return false;
    }

    return (
        Number.isInteger(value.slot) &&
        Number.isInteger(value.x) &&
        Number.isInteger(value.y) &&
        Number.isInteger(value.width) &&
        Number.isInteger(value.height)
    );
}

/**
 * Build a valid initial layout that fills the print area with vertical slots.
 */
export function buildDefaultLayoutConfig(
    photoSlots: number,
    printWidthMm: number,
    printHeightMm: number,
): LayoutConfig {
    const safeSlotCount = Math.max(1, Math.trunc(photoSlots));
    const safeWidth = Math.max(1, Math.trunc(printWidthMm));
    const safeHeight = Math.max(1, Math.trunc(printHeightMm));
    const canStackVertically = safeHeight >= safeSlotCount;
    let currentY = 0;

    const slots = Array.from({ length: safeSlotCount }, (_, index) => {
        if (!canStackVertically) {
            return {
                slot: index + 1,
                x: 0,
                y: 0,
                width: safeWidth,
                height: safeHeight,
            };
        }

        const baseHeight = Math.floor(safeHeight / safeSlotCount);
        const remainder = safeHeight % safeSlotCount;
        const height = baseHeight + (index < remainder ? 1 : 0);
        const y = currentY;

        currentY += height;

        return {
            slot: index + 1,
            x: 0,
            y,
            width: safeWidth,
            height,
        };
    });

    return { slots };
}

/**
 * Append or remove slots while preserving existing geometry and reindexing slot numbers.
 */
export function resizeLayoutConfig(
    configuration: LayoutConfig,
    requestedCount: number,
    printWidthMm: number,
    printHeightMm: number,
): LayoutConfig {
    const count = Math.max(1, Math.trunc(requestedCount));
    const safeWidth = Math.max(1, Math.trunc(printWidthMm));
    const safeHeight = Math.max(1, Math.trunc(printHeightMm));
    const slots = configuration.slots
        .slice(0, count)
        .map((slot, index) => ({ ...slot, slot: index + 1 }));

    while (slots.length < count) {
        const previous = slots.at(-1);
        const width = Math.min(
            safeWidth,
            Math.max(1, previous?.width ?? safeWidth),
        );
        const height = Math.min(
            safeHeight,
            Math.max(
                1,
                previous?.height ?? Math.floor(safeHeight / Math.max(count, 1)),
            ),
        );
        const candidateY = previous ? previous.y + previous.height : 0;
        const y = candidateY + height <= safeHeight ? candidateY : 0;

        slots.push({
            slot: slots.length + 1,
            x: 0,
            y,
            width,
            height,
        });
    }

    return {
        ...configuration,
        slots: slots.map((slot, index) => ({
            ...slot,
            slot: index + 1,
        })),
    };
}

/**
 * Normalize an existing persisted layout while retaining supported unknown metadata.
 */
export function normalizeLayoutConfig(
    value: Record<string, unknown> | null | undefined,
    photoSlots: number,
    printWidthMm: number,
    printHeightMm: number,
): LayoutConfig {
    if (!isRecord(value) || !Array.isArray(value.slots)) {
        return buildDefaultLayoutConfig(
            photoSlots,
            printWidthMm,
            printHeightMm,
        );
    }

    const validSlots = value.slots.filter(isLayoutSlot).map((slot, index) => ({
        ...slot,
        slot: index + 1,
    }));

    if (validSlots.length === 0) {
        return buildDefaultLayoutConfig(
            photoSlots,
            printWidthMm,
            printHeightMm,
        );
    }

    return resizeLayoutConfig(
        {
            ...value,
            slots: validSlots,
        },
        photoSlots,
        printWidthMm,
        printHeightMm,
    );
}

/**
 * Determine whether one slot is valid and fully contained by the print canvas.
 */
function isSlotWithinPrintArea(
    slot: LayoutSlot,
    printWidthMm: number,
    printHeightMm: number,
): boolean {
    return (
        Number.isInteger(slot.slot) &&
        Number.isInteger(slot.x) &&
        Number.isInteger(slot.y) &&
        Number.isInteger(slot.width) &&
        Number.isInteger(slot.height) &&
        slot.x >= 0 &&
        slot.y >= 0 &&
        slot.width > 0 &&
        slot.height > 0 &&
        slot.x + slot.width <= printWidthMm &&
        slot.y + slot.height <= printHeightMm
    );
}

/**
 * Return the first human-readable validation issue for the current visual layout.
 */
export function getLayoutValidationMessage(
    configuration: LayoutConfig,
    printWidthMm: number,
    printHeightMm: number,
): string | null {
    if (configuration.slots.length === 0) {
        return 'At least one photo slot is required.';
    }

    for (const [index, slot] of configuration.slots.entries()) {
        if (slot.slot !== index + 1) {
            return 'Photo slots must be sequentially numbered starting at 1.';
        }

        if (
            !Number.isInteger(slot.x) ||
            !Number.isInteger(slot.y) ||
            !Number.isInteger(slot.width) ||
            !Number.isInteger(slot.height)
        ) {
            return `Slot ${index + 1} must use whole millimeter values.`;
        }

        if (slot.x < 0 || slot.y < 0) {
            return `Slot ${index + 1} cannot use a negative X or Y position.`;
        }

        if (slot.width <= 0 || slot.height <= 0) {
            return `Slot ${index + 1} must have a positive width and height.`;
        }

        if (!isSlotWithinPrintArea(slot, printWidthMm, printHeightMm)) {
            return `Slot ${index + 1} must remain inside the ${printWidthMm} mm × ${printHeightMm} mm print area.`;
        }
    }

    return null;
}

/**
 * Parse an advanced JSON draft and return a canonical layout configuration.
 */
function parseLayoutJsonDraft(
    value: string,
    printWidthMm: number,
    printHeightMm: number,
): { configuration: LayoutConfig | null; error: string | null } {
    let decoded: unknown;

    try {
        decoded = JSON.parse(value);
    } catch {
        return {
            configuration: null,
            error: 'Layout JSON must be valid JSON.',
        };
    }

    if (!isRecord(decoded) || !Array.isArray(decoded.slots)) {
        return {
            configuration: null,
            error: 'Layout JSON must contain a slots array.',
        };
    }

    if (decoded.slots.length === 0) {
        return {
            configuration: null,
            error: 'Layout JSON must contain at least one slot.',
        };
    }

    if (!decoded.slots.every(isLayoutSlot)) {
        return {
            configuration: null,
            error: 'Each JSON slot must contain integer slot, x, y, width, and height values.',
        };
    }

    const configuration: LayoutConfig = {
        ...decoded,
        slots: decoded.slots.map((slot, index) => ({
            ...slot,
            slot: index + 1,
        })),
    };

    return {
        configuration,
        error: getLayoutValidationMessage(
            configuration,
            printWidthMm,
            printHeightMm,
        ),
    };
}

/**
 * Format persisted timestamps for operator-readable metadata.
 */
function formatTimestamp(value: string | null | undefined): string {
    if (!value) {
        return 'Not available';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

/**
 * Manage a temporary browser object URL for newly selected image previews.
 */
function useFilePreview(initialUrl: string | null | undefined) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(
        initialUrl ?? null,
    );
    const [fileName, setFileName] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
        };
    }, []);

    /**
     * Replace the current temporary preview while safely revoking its previous object URL.
     */
    function selectFile(file: File | null): void {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }

        if (!file) {
            setPreviewUrl(initialUrl ?? null);
            setFileName(null);

            return;
        }

        const objectUrl = URL.createObjectURL(file);

        objectUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
        setFileName(file.name);
    }

    return {
        previewUrl,
        fileName,
        selectFile,
    };
}

/**
 * Render one numbered form section using the canonical admin Card surface.
 */
function TemplateSection({
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
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <div className="flex items-start gap-3 border-b px-4 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary text-caption font-semibold text-primary">
                    {number}
                </span>
                <div className="min-w-0">
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
 * Render an image upload field with current-asset and local-file preview support.
 */
function AssetUploadField({
    id,
    name,
    label,
    required,
    previewUrl,
    fileName,
    currentUrl,
    error,
    onFileChange,
}: {
    id: string;
    name: string;
    label: string;
    required: boolean;
    previewUrl: string | null;
    fileName: string | null;
    currentUrl?: string | null;
    error?: string;
    onFileChange: (file: File | null) => void;
}) {
    const errorId = `${id}-error`;

    return (
        <div className="grid gap-field">
            <Label htmlFor={id}>
                {label}
                {required && (
                    <span
                        className="ml-1 text-destructive-foreground"
                        aria-hidden="true"
                    >
                        *
                    </span>
                )}
            </Label>

            <div className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt={`${label} preview`}
                            className="size-full object-contain p-2"
                        />
                    ) : (
                        <FileImage
                            className="size-8 text-muted-foreground"
                            aria-hidden="true"
                        />
                    )}
                </div>

                <div className="grid gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Upload
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                        {fileName ?? 'Choose an image file'}
                    </div>

                    <Input
                        id={id}
                        name={name}
                        type="file"
                        accept="image/*"
                        required={required}
                        aria-invalid={!!error}
                        aria-describedby={error ? errorId : undefined}
                        onChange={(event) =>
                            onFileChange(event.target.files?.[0] ?? null)
                        }
                    />

                    <p className="text-caption text-muted-foreground">
                        PNG, JPG, WebP, or another Laravel-supported image, up
                        to 5 MB.
                    </p>

                    {currentUrl && (
                        <a
                            href={currentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-fit items-center gap-1 text-sm font-medium underline underline-offset-4"
                        >
                            View current {label.toLowerCase()}
                            <ExternalLink
                                className="size-3.5"
                                aria-hidden="true"
                            />
                        </a>
                    )}
                </div>
            </div>

            <InputError id={errorId} message={error} />
        </div>
    );
}

/**
 * Render responsive visual controls for editing photo slot geometry.
 */
function LayoutSlotEditor({
    slots,
    printWidthMm,
    printHeightMm,
    onUpdate,
    onRemove,
    onAdd,
}: {
    slots: LayoutSlot[];
    printWidthMm: number;
    printHeightMm: number;
    onUpdate: (
        index: number,
        coordinate: LayoutCoordinate,
        value: number,
    ) => void;
    onRemove: (index: number) => void;
    onAdd: () => void;
}) {
    return (
        <div className="grid gap-3">
            <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">
                        Template photo slot geometry in millimeters
                    </caption>
                    <thead className="bg-muted/50 text-left text-caption text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 font-medium">Slot</th>
                            <th className="px-3 py-2 font-medium">X (mm)</th>
                            <th className="px-3 py-2 font-medium">Y (mm)</th>
                            <th className="px-3 py-2 font-medium">
                                Width (mm)
                            </th>
                            <th className="px-3 py-2 font-medium">
                                Height (mm)
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {slots.map((slot, index) => {
                            const valid = isSlotWithinPrintArea(
                                slot,
                                printWidthMm,
                                printHeightMm,
                            );

                            return (
                                <tr key={slot.slot} className="border-t">
                                    <td className="px-3 py-2 font-medium">
                                        {slot.slot}
                                    </td>

                                    {(
                                        [
                                            'x',
                                            'y',
                                            'width',
                                            'height',
                                        ] as LayoutCoordinate[]
                                    ).map((coordinate) => (
                                        <td
                                            key={coordinate}
                                            className="px-3 py-2"
                                        >
                                            <Input
                                                type="number"
                                                min={
                                                    coordinate === 'x' ||
                                                    coordinate === 'y'
                                                        ? 0
                                                        : 1
                                                }
                                                value={slot[coordinate]}
                                                aria-label={`Slot ${slot.slot} ${coordinate} in millimeters`}
                                                aria-invalid={!valid}
                                                onChange={(event) =>
                                                    onUpdate(
                                                        index,
                                                        coordinate,
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                            />
                                        </td>
                                    ))}

                                    <td className="px-3 py-2 text-right">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    disabled={slots.length <= 1}
                                                    aria-label={`Remove slot ${slot.slot}`}
                                                    onClick={() =>
                                                        onRemove(index)
                                                    }
                                                >
                                                    <Trash2 aria-hidden="true" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Remove slot {slot.slot}
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-3 md:hidden">
                {slots.map((slot, index) => {
                    const valid = isSlotWithinPrintArea(
                        slot,
                        printWidthMm,
                        printHeightMm,
                    );

                    return (
                        <fieldset
                            key={slot.slot}
                            className="grid gap-3 rounded-lg border p-3"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <legend className="text-sm font-semibold">
                                    Slot {slot.slot}
                                </legend>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={slots.length <= 1}
                                    onClick={() => onRemove(index)}
                                >
                                    <Trash2 aria-hidden="true" />
                                    Remove
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {(
                                    [
                                        'x',
                                        'y',
                                        'width',
                                        'height',
                                    ] as LayoutCoordinate[]
                                ).map((coordinate) => (
                                    <div
                                        key={coordinate}
                                        className="grid gap-field"
                                    >
                                        <Label
                                            htmlFor={`slot-${slot.slot}-${coordinate}`}
                                            className="capitalize"
                                        >
                                            {coordinate} (mm)
                                        </Label>
                                        <Input
                                            id={`slot-${slot.slot}-${coordinate}`}
                                            type="number"
                                            min={
                                                coordinate === 'x' ||
                                                coordinate === 'y'
                                                    ? 0
                                                    : 1
                                            }
                                            value={slot[coordinate]}
                                            aria-invalid={!valid}
                                            onChange={(event) =>
                                                onUpdate(
                                                    index,
                                                    coordinate,
                                                    Number(event.target.value),
                                                )
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    );
                })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={onAdd}
                >
                    <Plus aria-hidden="true" />
                    Add Slot
                </Button>

                <p className="text-caption text-muted-foreground">
                    All measurements are in millimeters.
                </p>
            </div>
        </div>
    );
}

/**
 * Render the form-driven print preview using the same millimeter geometry as the server renderer.
 */
function LivePrintPreview({
    configuration,
    printWidthMm,
    printHeightMm,
    orientation,
    layoutPreviewUrl,
    scale,
    onScaleChange,
}: {
    configuration: LayoutConfig;
    printWidthMm: number;
    printHeightMm: number;
    orientation: Orientation;
    layoutPreviewUrl: string | null;
    scale: PreviewScale;
    onScaleChange: (scale: PreviewScale) => void;
}) {
    const safeWidth = Math.max(1, printWidthMm);
    const safeHeight = Math.max(1, printHeightMm);
    const scaleFactor = scale / 100;
    const maxHeight = 320 * scaleFactor;
    const maxWidth = 420 * scaleFactor;
    const aspectRatio = safeWidth / safeHeight;

    let displayHeight = maxHeight;
    let displayWidth = maxHeight * aspectRatio;

    if (displayWidth > maxWidth) {
        displayWidth = maxWidth;
        displayHeight = maxWidth / aspectRatio;
    }

    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-card-title">Live Print Preview</h2>
                    <Info
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                </div>

                <Select
                    value={String(scale)}
                    onValueChange={(value) =>
                        onScaleChange(Number(value) as PreviewScale)
                    }
                >
                    <SelectTrigger
                        className="w-full sm:w-32"
                        aria-label="Preview scale"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="50">Scale: 50%</SelectItem>
                        <SelectItem value="75">Scale: 75%</SelectItem>
                        <SelectItem value="100">Scale: 100%</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="p-4">
                <div className="flex min-h-80 items-center justify-center overflow-auto rounded-lg border bg-muted/20 p-6">
                    <div className="grid justify-items-center gap-2">
                        <div className="text-caption text-muted-foreground">
                            {safeWidth} mm
                        </div>

                        <div className="flex items-center gap-3">
                            <div
                                role="img"
                                aria-label={`${orientation} template preview, ${safeWidth} by ${safeHeight} millimeters`}
                                className="relative shrink-0 overflow-hidden border bg-white shadow-sm"
                                style={{
                                    width: `${displayWidth}px`,
                                    height: `${displayHeight}px`,
                                }}
                            >
                                {layoutPreviewUrl && (
                                    <img
                                        src={layoutPreviewUrl}
                                        alt=""
                                        aria-hidden="true"
                                        className="absolute inset-0 size-full object-fill"
                                    />
                                )}

                                {configuration.slots.map((slot) => {
                                    const valid = isSlotWithinPrintArea(
                                        slot,
                                        safeWidth,
                                        safeHeight,
                                    );

                                    return (
                                        <div
                                            key={slot.slot}
                                            className={`absolute flex items-center justify-center border text-[10px] font-semibold ${
                                                valid
                                                    ? 'border-foreground/60 bg-background/20 text-foreground'
                                                    : 'border-destructive bg-destructive/10 text-destructive-foreground'
                                            }`}
                                            style={{
                                                left: `${(slot.x / safeWidth) * 100}%`,
                                                top: `${(slot.y / safeHeight) * 100}%`,
                                                width: `${(slot.width / safeWidth) * 100}%`,
                                                height: `${(slot.height / safeHeight) * 100}%`,
                                            }}
                                        >
                                            <span className="sr-only">
                                                Photo slot {slot.slot}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="text-caption text-muted-foreground">
                                {safeHeight} mm
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-3 text-caption text-muted-foreground">
                    Preview reflects print proportions and configured slot
                    geometry.
                </p>
            </div>
        </Card>
    );
}

/**
 * Render a concise summary of the current unsaved form state.
 */
function TemplateSummary({
    slug,
    orientation,
    active,
    printWidthMm,
    printHeightMm,
    photoSlots,
    sortOrder,
}: {
    slug: string;
    orientation: Orientation;
    active: boolean;
    printWidthMm: number;
    printHeightMm: number;
    photoSlots: number;
    sortOrder: number;
}) {
    return (
        <Card className="gap-0 py-0 shadow-none">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <FileText
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
                <h2 className="text-card-title">Template Summary</h2>
            </div>

            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 text-sm">
                <dt className="text-muted-foreground">Print Size</dt>
                <dd>
                    {printWidthMm} mm × {printHeightMm} mm
                </dd>

                <dt className="text-muted-foreground">Slot Count</dt>
                <dd>{photoSlots}</dd>

                <dt className="text-muted-foreground">Orientation</dt>
                <dd className="capitalize">{orientation}</dd>

                <dt className="text-muted-foreground">Status</dt>
                <dd>
                    <Badge
                        variant="outline"
                        className={
                            active
                                ? 'border-success/25 bg-success-subtle text-success-foreground'
                                : 'border-border bg-muted text-muted-foreground'
                        }
                    >
                        {active ? 'Active' : 'Inactive'}
                    </Badge>
                </dd>

                <dt className="text-muted-foreground">Slug</dt>
                <dd className="truncate font-mono text-xs">
                    {slug || 'Not set'}
                </dd>

                <dt className="text-muted-foreground">Display Order</dt>
                <dd>{sortOrder}</dd>
            </dl>
        </Card>
    );
}

/**
 * Render only real persisted metadata for an existing template.
 */
function TemplateMetadata({ template }: { template: Template }) {
    return (
        <Card className="gap-0 py-0 shadow-none">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Clock3
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
                <h2 className="text-card-title">Template Metadata</h2>
            </div>

            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 text-sm">
                <dt className="text-muted-foreground">Template ID</dt>
                <dd>{template.id}</dd>

                <dt className="text-muted-foreground">Internal Slug</dt>
                <dd className="truncate font-mono text-xs">{template.slug}</dd>

                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatTimestamp(template.createdAt)}</dd>

                <dt className="text-muted-foreground">Last Updated</dt>
                <dd>{formatTimestamp(template.updatedAt)}</dd>
            </dl>
        </Card>
    );
}

/**
 * Render non-persistent operational guidance for a newly created template.
 */
function GuidelinesCard({
    printWidthMm,
    printHeightMm,
}: {
    printWidthMm: number;
    printHeightMm: number;
}) {
    return (
        <Card className="gap-0 py-0 shadow-none">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Lightbulb className="size-4 text-warning" aria-hidden="true" />
                <h2 className="text-card-title">Guidelines</h2>
            </div>

            <ul className="grid list-disc gap-2 p-4 pl-8 text-sm text-muted-foreground">
                <li>
                    Keep every slot inside the {printWidthMm} mm ×{' '}
                    {printHeightMm} mm print area.
                </li>
                <li>Leave intentional spacing when the layout needs it.</li>
                <li>Verify the preview before publishing the template.</li>
                <li>Save the template before it becomes available for use.</li>
            </ul>
        </Card>
    );
}

/**
 * Render guarded template deletion using the existing Wayfinder destroy form.
 */
function DangerZone({ template }: { template: Template }) {
    return (
        <Card className="gap-0 border-destructive/40 bg-destructive/5 py-0 shadow-none">
            <div className="flex items-center gap-2 border-b border-destructive/25 px-4 py-3">
                <TriangleAlert
                    className="size-4 text-destructive-foreground"
                    aria-hidden="true"
                />
                <h2 className="text-card-title text-destructive-foreground">
                    Danger Zone
                </h2>
            </div>

            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    Deleting an unused template is permanent and cannot be
                    undone.
                </p>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            type="button"
                            variant="destructive"
                            className="shrink-0"
                        >
                            <Trash2 aria-hidden="true" />
                            Delete Template
                        </Button>
                    </DialogTrigger>

                    <DialogContent>
                        <Form
                            {...TemplateController.destroy.form(template.id)}
                            options={{ preserveScroll: true }}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Delete template?
                                        </DialogTitle>
                                        <DialogDescription>
                                            This permanently deletes{' '}
                                            <strong>{template.name}</strong> and
                                            its stored template assets. The
                                            server will reject deletion when
                                            historical photobooth sessions still
                                            reference this template.
                                        </DialogDescription>
                                    </DialogHeader>

                                    {errors.template && (
                                        <p
                                            role="alert"
                                            className="text-sm text-destructive-foreground"
                                        >
                                            {errors.template}
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
                                                : 'Delete template'}
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
 * Render the shared responsive Create/Edit template management workspace.
 */
export default function TemplateForm({
    form,
    template,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    template?: Template;
}) {
    const initialPrintWidth = template?.printWidthMm ?? DEFAULT_PRINT_WIDTH_MM;
    const initialPrintHeight =
        template?.printHeightMm ?? DEFAULT_PRINT_HEIGHT_MM;
    const initialPhotoSlots = template?.photoSlots ?? DEFAULT_PHOTO_SLOTS;
    const initialLayoutConfig = normalizeLayoutConfig(
        template?.layoutConfig,
        initialPhotoSlots,
        initialPrintWidth,
        initialPrintHeight,
    );

    const [name, setName] = useState(template?.name ?? '');
    const [slug, setSlug] = useState(template?.slug ?? '');
    const [orientation, setOrientation] = useState<Orientation>(
        template?.orientation ?? 'portrait',
    );
    const [active, setActive] = useState(template?.active ?? true);
    const [sortOrder, setSortOrder] = useState(template?.sortOrder ?? 0);
    const [printWidthMm, setPrintWidthMm] = useState(initialPrintWidth);
    const [printHeightMm, setPrintHeightMm] = useState(initialPrintHeight);
    const [layoutConfig, setLayoutConfig] =
        useState<LayoutConfig>(initialLayoutConfig);
    const [layoutJsonDraft, setLayoutJsonDraft] = useState(
        JSON.stringify(initialLayoutConfig, null, 2),
    );
    const [layoutJsonError, setLayoutJsonError] = useState<string | null>(null);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [previewScale, setPreviewScale] = useState<PreviewScale>(100);
    const [printerCompatibility, setPrinterCompatibility] = useState(
        template?.printerCompatibility
            ? JSON.stringify(template.printerCompatibility, null, 2)
            : '',
    );

    const layoutPreview = useFilePreview(template?.layoutUrl);
    const thumbnailPreview = useFilePreview(template?.thumbnailUrl);
    const photoSlots = layoutConfig.slots.length;
    const layoutValidationMessage = getLayoutValidationMessage(
        layoutConfig,
        printWidthMm,
        printHeightMm,
    );

    /**
     * Commit slot-editor changes and reset the optional JSON draft to canonical state.
     */
    function commitLayoutConfiguration(next: LayoutConfig): void {
        const canonical: LayoutConfig = {
            ...next,
            slots: next.slots.map((slot, index) => ({
                ...slot,
                slot: index + 1,
            })),
        };

        setLayoutConfig(canonical);
        setLayoutJsonDraft(JSON.stringify(canonical, null, 2));
        setLayoutJsonError(null);
    }

    /**
     * Resize the canonical slot collection when the operator changes photo_slots.
     */
    function handlePhotoSlotCountChange(value: number): void {
        if (!Number.isFinite(value)) {
            return;
        }

        commitLayoutConfiguration(
            resizeLayoutConfig(
                layoutConfig,
                Math.max(1, Math.trunc(value)),
                printWidthMm,
                printHeightMm,
            ),
        );
    }

    /**
     * Update one millimeter coordinate while preserving all other slot metadata.
     */
    function handleSlotUpdate(
        index: number,
        coordinate: LayoutCoordinate,
        value: number,
    ): void {
        if (!Number.isFinite(value)) {
            return;
        }

        const slots = layoutConfig.slots.map((slot, slotIndex) =>
            slotIndex === index
                ? {
                      ...slot,
                      [coordinate]: Math.trunc(value),
                  }
                : slot,
        );

        commitLayoutConfiguration({
            ...layoutConfig,
            slots,
        });
    }

    /**
     * Append one new editable slot while keeping photo_slots synchronized.
     */
    function handleAddSlot(): void {
        commitLayoutConfiguration(
            resizeLayoutConfig(
                layoutConfig,
                photoSlots + 1,
                printWidthMm,
                printHeightMm,
            ),
        );
    }

    /**
     * Remove one slot and deterministically reindex the remaining slots.
     */
    function handleRemoveSlot(index: number): void {
        if (photoSlots <= 1) {
            return;
        }

        commitLayoutConfiguration({
            ...layoutConfig,
            slots: layoutConfig.slots.filter(
                (_, slotIndex) => slotIndex !== index,
            ),
        });
    }

    /**
     * Apply a valid advanced JSON draft back into the canonical visual slot state.
     */
    function handleApplyJson(): void {
        const result = parseLayoutJsonDraft(
            layoutJsonDraft,
            printWidthMm,
            printHeightMm,
        );

        if (!result.configuration) {
            setLayoutJsonError(result.error);

            return;
        }

        commitLayoutConfiguration(result.configuration);
    }

    /**
     * Replace the advanced JSON draft with a formatted canonical configuration.
     */
    function handleFormatJson(): void {
        setLayoutJsonDraft(JSON.stringify(layoutConfig, null, 2));
        setLayoutJsonError(null);
    }

    /**
     * Copy the currently canonical layout configuration when Clipboard API support exists.
     */
    function handleCopyJson(): void {
        if (!navigator.clipboard?.writeText) {
            return;
        }

        void navigator.clipboard.writeText(
            JSON.stringify(layoutConfig, null, 2),
        );
    }

    return (
        <Form
            {...form}
            options={{ preserveScroll: true }}
            className="flex w-full flex-col gap-section p-page md:p-page-desktop"
        >
            {({ processing, errors }) => (
                <>
                    <input
                        type="hidden"
                        name="layout_config"
                        value={JSON.stringify(layoutConfig)}
                    />
                    <input
                        type="hidden"
                        name="orientation"
                        value={orientation}
                    />
                    <input
                        type="hidden"
                        name="active"
                        value={active ? '1' : '0'}
                    />

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h1 className="text-page-title sm:text-2xl">
                                {template ? 'Edit Template' : 'Create Template'}
                            </h1>
                            <p className="mt-1 text-body text-muted-foreground">
                                {template
                                    ? 'Update this printable photobooth layout and its rendering configuration.'
                                    : 'Configure a new printable layout for the photobooth.'}
                            </p>
                        </div>

                        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                            <Button variant="outline" asChild>
                                <Link href={templatesIndex()}>Cancel</Link>
                            </Button>

                            <Button
                                type="submit"
                                disabled={
                                    processing ||
                                    layoutValidationMessage !== null
                                }
                            >
                                <Save aria-hidden="true" />
                                {processing
                                    ? 'Saving...'
                                    : template
                                      ? 'Save Changes'
                                      : 'Save Template'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
                        <div className="grid min-w-0 gap-4">
                            <TemplateSection number={1} title="Basic Details">
                                <div className="grid gap-form md:grid-cols-2 xl:grid-cols-3">
                                    <div className="grid gap-field">
                                        <Label htmlFor="name">
                                            Template Name
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            required
                                            value={name}
                                            placeholder="Classic Strip"
                                            aria-invalid={!!errors.name}
                                            aria-describedby={
                                                errors.name
                                                    ? 'name-error'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                setName(event.target.value)
                                            }
                                        />
                                        <InputError
                                            id="name-error"
                                            message={errors.name}
                                        />
                                    </div>

                                    <div className="grid gap-field">
                                        <Label htmlFor="slug">
                                            Internal Slug / Identifier
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="slug"
                                            name="slug"
                                            required
                                            value={slug}
                                            placeholder="classic-strip"
                                            aria-invalid={!!errors.slug}
                                            aria-describedby={
                                                errors.slug
                                                    ? 'slug-error'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                setSlug(event.target.value)
                                            }
                                        />
                                        <InputError
                                            id="slug-error"
                                            message={errors.slug}
                                        />
                                    </div>

                                    <div className="grid gap-field">
                                        <Label htmlFor="status">Status</Label>
                                        <Select
                                            value={
                                                active ? 'active' : 'inactive'
                                            }
                                            onValueChange={(value) =>
                                                setActive(value === 'active')
                                            }
                                        >
                                            <SelectTrigger
                                                id="status"
                                                className="w-full"
                                                aria-invalid={!!errors.active}
                                                aria-describedby={
                                                    errors.active
                                                        ? 'active-error'
                                                        : undefined
                                                }
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">
                                                    Active
                                                </SelectItem>
                                                <SelectItem value="inactive">
                                                    Inactive
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            id="active-error"
                                            message={errors.active}
                                        />
                                    </div>

                                    <div className="grid gap-field md:col-span-2 xl:col-span-1">
                                        <Label htmlFor="sort_order">
                                            Display Order
                                        </Label>
                                        <Input
                                            id="sort_order"
                                            name="sort_order"
                                            type="number"
                                            min={0}
                                            value={sortOrder}
                                            aria-invalid={!!errors.sort_order}
                                            aria-describedby={
                                                errors.sort_order
                                                    ? 'sort_order-error'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                setSortOrder(
                                                    Math.max(
                                                        0,
                                                        Math.trunc(
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        ),
                                                    ),
                                                )
                                            }
                                        />
                                        <InputError
                                            id="sort_order-error"
                                            message={errors.sort_order}
                                        />
                                    </div>
                                </div>
                            </TemplateSection>

                            <TemplateSection number={2} title="Print Settings">
                                <div className="grid gap-form sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="grid gap-field">
                                        <Label htmlFor="print_width_mm">
                                            Print Width (mm)
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="print_width_mm"
                                            name="print_width_mm"
                                            type="number"
                                            min={1}
                                            required
                                            value={printWidthMm}
                                            aria-invalid={
                                                !!errors.print_width_mm
                                            }
                                            aria-describedby={
                                                errors.print_width_mm
                                                    ? 'print_width_mm-error'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                setPrintWidthMm(
                                                    Math.max(
                                                        1,
                                                        Math.trunc(
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        ),
                                                    ),
                                                )
                                            }
                                        />
                                        <InputError
                                            id="print_width_mm-error"
                                            message={errors.print_width_mm}
                                        />
                                    </div>

                                    <div className="grid gap-field">
                                        <Label htmlFor="print_height_mm">
                                            Print Height (mm)
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="print_height_mm"
                                            name="print_height_mm"
                                            type="number"
                                            min={1}
                                            required
                                            value={printHeightMm}
                                            aria-invalid={
                                                !!errors.print_height_mm
                                            }
                                            aria-describedby={
                                                errors.print_height_mm
                                                    ? 'print_height_mm-error'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                setPrintHeightMm(
                                                    Math.max(
                                                        1,
                                                        Math.trunc(
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        ),
                                                    ),
                                                )
                                            }
                                        />
                                        <InputError
                                            id="print_height_mm-error"
                                            message={errors.print_height_mm}
                                        />
                                    </div>

                                    <div className="grid gap-field">
                                        <Label htmlFor="photo_slots">
                                            Photo Slots
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="photo_slots"
                                            name="photo_slots"
                                            type="number"
                                            min={1}
                                            required
                                            value={photoSlots}
                                            aria-invalid={!!errors.photo_slots}
                                            aria-describedby={
                                                errors.photo_slots
                                                    ? 'photo_slots-error'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                handlePhotoSlotCountChange(
                                                    Number(event.target.value),
                                                )
                                            }
                                        />
                                        <InputError
                                            id="photo_slots-error"
                                            message={errors.photo_slots}
                                        />
                                    </div>

                                    <div className="grid gap-field">
                                        <Label htmlFor="orientation">
                                            Orientation
                                            <span
                                                className="ml-1 text-destructive-foreground"
                                                aria-hidden="true"
                                            >
                                                *
                                            </span>
                                        </Label>
                                        <Select
                                            value={orientation}
                                            onValueChange={(value) =>
                                                setOrientation(
                                                    value as Orientation,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="orientation"
                                                className="w-full"
                                                aria-invalid={
                                                    !!errors.orientation
                                                }
                                                aria-describedby={
                                                    errors.orientation
                                                        ? 'orientation-error'
                                                        : undefined
                                                }
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="portrait">
                                                    Portrait
                                                </SelectItem>
                                                <SelectItem value="landscape">
                                                    Landscape
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            id="orientation-error"
                                            message={errors.orientation}
                                        />
                                    </div>
                                </div>
                            </TemplateSection>

                            <TemplateSection
                                number={3}
                                title="Thumbnail & Preview"
                            >
                                <div className="grid gap-form lg:grid-cols-2">
                                    <AssetUploadField
                                        id="layout"
                                        name="layout"
                                        label="Layout Asset"
                                        required={!template}
                                        previewUrl={layoutPreview.previewUrl}
                                        fileName={layoutPreview.fileName}
                                        currentUrl={template?.layoutUrl}
                                        error={errors.layout}
                                        onFileChange={layoutPreview.selectFile}
                                    />

                                    <AssetUploadField
                                        id="thumbnail"
                                        name="thumbnail"
                                        label="Template Thumbnail"
                                        required={false}
                                        previewUrl={thumbnailPreview.previewUrl}
                                        fileName={thumbnailPreview.fileName}
                                        currentUrl={template?.thumbnailUrl}
                                        error={errors.thumbnail}
                                        onFileChange={
                                            thumbnailPreview.selectFile
                                        }
                                    />
                                </div>
                            </TemplateSection>

                            <TemplateSection
                                number={4}
                                title="Layout Configuration"
                                description="Define the position and size of each photo slot in millimeters."
                            >
                                <div className="grid gap-4">
                                    <LayoutSlotEditor
                                        slots={layoutConfig.slots}
                                        printWidthMm={printWidthMm}
                                        printHeightMm={printHeightMm}
                                        onUpdate={handleSlotUpdate}
                                        onRemove={handleRemoveSlot}
                                        onAdd={handleAddSlot}
                                    />

                                    {layoutValidationMessage && (
                                        <p
                                            role="alert"
                                            className="text-sm text-destructive-foreground"
                                        >
                                            {layoutValidationMessage}
                                        </p>
                                    )}

                                    <InputError
                                        id="layout-config-error"
                                        message={errors.layout_config}
                                    />

                                    <Collapsible
                                        open={advancedOpen}
                                        onOpenChange={setAdvancedOpen}
                                        className="overflow-hidden rounded-lg border"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="h-auto w-full justify-between rounded-none px-4 py-3"
                                            >
                                                <span className="flex items-center gap-2 text-left">
                                                    Advanced JSON Configuration
                                                    <span className="text-caption font-normal text-muted-foreground">
                                                        Optional editor
                                                    </span>
                                                </span>
                                                <ChevronDown
                                                    className={`size-4 transition-transform ${
                                                        advancedOpen
                                                            ? 'rotate-180'
                                                            : ''
                                                    }`}
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent className="border-t">
                                            <div className="grid gap-5 p-4">
                                                <div className="grid gap-field">
                                                    <Label htmlFor="layout-json-draft">
                                                        Layout configuration
                                                        JSON
                                                    </Label>
                                                    <textarea
                                                        id="layout-json-draft"
                                                        rows={10}
                                                        value={layoutJsonDraft}
                                                        aria-invalid={
                                                            !!layoutJsonError
                                                        }
                                                        aria-describedby={
                                                            layoutJsonError
                                                                ? 'layout-json-draft-error'
                                                                : 'layout-json-draft-help'
                                                        }
                                                        className={
                                                            textareaClassName
                                                        }
                                                        onChange={(event) =>
                                                            setLayoutJsonDraft(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    <p
                                                        id="layout-json-draft-help"
                                                        className="text-caption text-muted-foreground"
                                                    >
                                                        This is a temporary
                                                        editor only. Apply valid
                                                        JSON to update the
                                                        canonical slot table.
                                                    </p>

                                                    {layoutJsonError && (
                                                        <p
                                                            id="layout-json-draft-error"
                                                            role="alert"
                                                            className="text-sm text-destructive-foreground"
                                                        >
                                                            {layoutJsonError}
                                                        </p>
                                                    )}

                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={
                                                                handleFormatJson
                                                            }
                                                        >
                                                            Format
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={
                                                                handleCopyJson
                                                            }
                                                        >
                                                            <Copy aria-hidden="true" />
                                                            Copy
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={
                                                                handleApplyJson
                                                            }
                                                        >
                                                            Apply JSON
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="grid gap-field">
                                                    <Label htmlFor="printer_compatibility">
                                                        Printer compatibility
                                                        JSON
                                                    </Label>
                                                    <textarea
                                                        id="printer_compatibility"
                                                        name="printer_compatibility"
                                                        rows={5}
                                                        value={
                                                            printerCompatibility
                                                        }
                                                        placeholder='{"paper_width_mm": 58, "drivers": ["local_mock"]}'
                                                        aria-invalid={
                                                            !!errors.printer_compatibility
                                                        }
                                                        aria-describedby={
                                                            errors.printer_compatibility
                                                                ? 'printer_compatibility-error'
                                                                : undefined
                                                        }
                                                        className={
                                                            textareaClassName
                                                        }
                                                        onChange={(event) =>
                                                            setPrinterCompatibility(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    <InputError
                                                        id="printer_compatibility-error"
                                                        message={
                                                            errors.printer_compatibility
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </div>
                            </TemplateSection>
                        </div>

                        <aside className="grid min-w-0 gap-4 xl:sticky xl:top-20 xl:self-start">
                            <LivePrintPreview
                                configuration={layoutConfig}
                                printWidthMm={printWidthMm}
                                printHeightMm={printHeightMm}
                                orientation={orientation}
                                layoutPreviewUrl={layoutPreview.previewUrl}
                                scale={previewScale}
                                onScaleChange={setPreviewScale}
                            />

                            <TemplateSummary
                                slug={slug}
                                orientation={orientation}
                                active={active}
                                printWidthMm={printWidthMm}
                                printHeightMm={printHeightMm}
                                photoSlots={photoSlots}
                                sortOrder={sortOrder}
                            />

                            {template ? (
                                <>
                                    <TemplateMetadata template={template} />
                                    <DangerZone template={template} />
                                </>
                            ) : (
                                <GuidelinesCard
                                    printWidthMm={printWidthMm}
                                    printHeightMm={printHeightMm}
                                />
                            )}
                        </aside>
                    </div>
                </>
            )}
        </Form>
    );
}
