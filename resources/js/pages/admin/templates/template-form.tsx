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
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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
import { index as templatesIndex } from '@/routes/admin/templates';
import type { RouteFormDefinition } from '@/wayfinder';

type Orientation = 'portrait' | 'landscape';
type LayoutCoordinate = 'x' | 'y' | 'width' | 'height';
type PreviewScale = 50 | 75 | 100;
type SelectionTarget = number | 'new' | null;

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

export type NormalizedPoint = {
    x: number;
    y: number;
};

export type NormalizedRectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type SlotGeometry = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type TransparencyImageData = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};

const DEFAULT_PHOTO_SLOTS = 1;
const DEFAULT_PRINT_WIDTH_MM = 100;
const DEFAULT_PRINT_HEIGHT_MM = 150;
const TRANSPARENT_ALPHA_THRESHOLD = 32;
const MAX_AUTO_DETECT_PIXELS = 4_000_000;
const MIN_NORMALIZED_SELECTION_SIZE = 0.003;

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
 * Clamp a normalized coordinate to the inclusive zero-to-one range.
 */
function clampNormalized(value: number): number {
    return Math.min(1, Math.max(0, value));
}

/**
 * Build a normalized rectangle from two normalized pointer positions.
 */
export function normalizedRectangleFromPoints(
    first: NormalizedPoint,
    second: NormalizedPoint,
): NormalizedRectangle {
    const left = clampNormalized(Math.min(first.x, second.x));
    const top = clampNormalized(Math.min(first.y, second.y));
    const right = clampNormalized(Math.max(first.x, second.x));
    const bottom = clampNormalized(Math.max(first.y, second.y));

    return {
        x: left,
        y: top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}

/**
 * Convert normalized image-space geometry into whole millimeter coordinates.
 */
export function normalizedRectangleToMillimeters(
    rectangle: NormalizedRectangle,
    printWidthMm: number,
    printHeightMm: number,
): SlotGeometry {
    const safePrintWidth = Math.max(1, Math.trunc(printWidthMm));
    const safePrintHeight = Math.max(1, Math.trunc(printHeightMm));

    const normalizedLeft = clampNormalized(rectangle.x);
    const normalizedTop = clampNormalized(rectangle.y);
    const normalizedRight = clampNormalized(
        rectangle.x + Math.max(0, rectangle.width),
    );
    const normalizedBottom = clampNormalized(
        rectangle.y + Math.max(0, rectangle.height),
    );

    const x = Math.min(
        safePrintWidth - 1,
        Math.max(0, Math.round(normalizedLeft * safePrintWidth)),
    );
    const y = Math.min(
        safePrintHeight - 1,
        Math.max(0, Math.round(normalizedTop * safePrintHeight)),
    );

    const requestedRight = Math.round(normalizedRight * safePrintWidth);
    const requestedBottom = Math.round(normalizedBottom * safePrintHeight);

    const right = Math.min(safePrintWidth, Math.max(x + 1, requestedRight));
    const bottom = Math.min(safePrintHeight, Math.max(y + 1, requestedBottom));

    return {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
    };
}

/**
 * Detect a bounded connected transparent region around a clicked image pixel.
 *
 * Regions connected to an outer image edge are intentionally rejected because
 * they usually represent transparent background rather than a photo cutout.
 */
export function detectBoundedTransparentRegion(
    imageData: TransparencyImageData,
    startX: number,
    startY: number,
    alphaThreshold = TRANSPARENT_ALPHA_THRESHOLD,
): NormalizedRectangle | null {
    const { data, width, height } = imageData;

    if (
        width <= 0 ||
        height <= 0 ||
        width * height > MAX_AUTO_DETECT_PIXELS ||
        startX < 0 ||
        startY < 0 ||
        startX >= width ||
        startY >= height
    ) {
        return null;
    }

    const startIndex = startY * width + startX;
    const startAlpha = data[startIndex * 4 + 3];

    if (startAlpha > alphaThreshold) {
        return null;
    }

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let queueHead = 0;
    let queueTail = 0;

    visited[startIndex] = 1;
    queue[queueTail] = startIndex;
    queueTail += 1;

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;
    let touchesImageBoundary = false;

    while (queueHead < queueTail) {
        const index = queue[queueHead];

        queueHead += 1;

        const x = index % width;
        const y = Math.floor(index / width);

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
            touchesImageBoundary = true;
        }

        if (x > 0) {
            const leftIndex = index - 1;

            if (
                visited[leftIndex] === 0 &&
                data[leftIndex * 4 + 3] <= alphaThreshold
            ) {
                visited[leftIndex] = 1;
                queue[queueTail] = leftIndex;
                queueTail += 1;
            }
        }

        if (x < width - 1) {
            const rightIndex = index + 1;

            if (
                visited[rightIndex] === 0 &&
                data[rightIndex * 4 + 3] <= alphaThreshold
            ) {
                visited[rightIndex] = 1;
                queue[queueTail] = rightIndex;
                queueTail += 1;
            }
        }

        if (y > 0) {
            const topIndex = index - width;

            if (
                visited[topIndex] === 0 &&
                data[topIndex * 4 + 3] <= alphaThreshold
            ) {
                visited[topIndex] = 1;
                queue[queueTail] = topIndex;
                queueTail += 1;
            }
        }

        if (y < height - 1) {
            const bottomIndex = index + width;

            if (
                visited[bottomIndex] === 0 &&
                data[bottomIndex * 4 + 3] <= alphaThreshold
            ) {
                visited[bottomIndex] = 1;
                queue[queueTail] = bottomIndex;
                queueTail += 1;
            }
        }
    }

    if (touchesImageBoundary) {
        return null;
    }

    const detectedWidth = maxX - minX + 1;
    const detectedHeight = maxY - minY + 1;

    if (detectedWidth <= 1 || detectedHeight <= 1) {
        return null;
    }

    return {
        x: minX / width,
        y: minY / height,
        width: detectedWidth / width,
        height: detectedHeight / height,
    };
}

/**
 * Convert one browser pointer position into normalized coordinates for an element.
 */
function pointerToNormalizedPoint(
    clientX: number,
    clientY: number,
    bounds: DOMRect,
): NormalizedPoint | null {
    if (bounds.width <= 0 || bounds.height <= 0) {
        return null;
    }

    return {
        x: clampNormalized((clientX - bounds.left) / bounds.width),
        y: clampNormalized((clientY - bounds.top) / bounds.height),
    };
}

/**
 * Determine whether a pointer-drawn normalized rectangle is large enough to use.
 */
function isMeaningfulNormalizedRectangle(
    rectangle: NormalizedRectangle,
): boolean {
    return (
        rectangle.width >= MIN_NORMALIZED_SELECTION_SIZE &&
        rectangle.height >= MIN_NORMALIZED_SELECTION_SIZE
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
 * Render the operator-facing visual photo-slot selector.
 */
function VisualLayoutEditor({
    slots,
    selectedSlotIndex,
    printWidthMm,
    printHeightMm,
    layoutPreviewUrl,
    onSelectSlot,
    onCommitSelection,
}: {
    slots: LayoutSlot[];
    selectedSlotIndex: number;
    printWidthMm: number;
    printHeightMm: number;
    layoutPreviewUrl: string | null;
    onSelectSlot: (index: number) => void;
    onCommitSelection: (
        targetIndex: number | null,
        geometry: SlotGeometry,
    ) => void;
}) {
    const [selectionTarget, setSelectionTarget] =
        useState<SelectionTarget>(null);
    const [dragStart, setDragStart] = useState<NormalizedPoint | null>(null);
    const [draftRectangle, setDraftRectangle] =
        useState<NormalizedRectangle | null>(null);
    const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
    const [analysisReadyUrl, setAnalysisReadyUrl] = useState<string | null>(
        null,
    );
    const [statusMessage, setStatusMessage] = useState(
        'Upload or load the layout image to start selecting photo areas.',
    );

    const imageAnalysisRef = useRef<{
        url: string;
        imageData: TransparencyImageData;
    } | null>(null);

    const imageReady =
        layoutPreviewUrl !== null && loadedImageUrl === layoutPreviewUrl;
    const autoDetectAvailable =
        layoutPreviewUrl !== null && analysisReadyUrl === layoutPreviewUrl;
    const selectionMode = selectionTarget !== null;

    /**
     * Build same-origin canvas image data when the asset is suitable for automatic transparent-region detection.
     */
    function handleImageLoad(
        event: React.SyntheticEvent<HTMLImageElement>,
    ): void {
        if (!layoutPreviewUrl) {
            return;
        }

        const image = event.currentTarget;
        const naturalWidth = image.naturalWidth;
        const naturalHeight = image.naturalHeight;

        setLoadedImageUrl(layoutPreviewUrl);
        setAnalysisReadyUrl(null);
        imageAnalysisRef.current = null;

        if (
            naturalWidth <= 0 ||
            naturalHeight <= 0 ||
            naturalWidth * naturalHeight > MAX_AUTO_DETECT_PIXELS
        ) {
            setStatusMessage(
                'Layout ready. Drag on the image to define a photo slot.',
            );

            return;
        }

        try {
            const canvas = document.createElement('canvas');

            canvas.width = naturalWidth;
            canvas.height = naturalHeight;

            const context = canvas.getContext('2d', {
                willReadFrequently: true,
            });

            if (!context) {
                setStatusMessage(
                    'Layout ready. Drag on the image to define a photo slot.',
                );

                return;
            }

            context.drawImage(image, 0, 0, naturalWidth, naturalHeight);

            const imageData = context.getImageData(
                0,
                0,
                naturalWidth,
                naturalHeight,
            );

            imageAnalysisRef.current = {
                url: layoutPreviewUrl,
                imageData,
            };

            setAnalysisReadyUrl(layoutPreviewUrl);
            setStatusMessage(
                'Layout ready. Click a bounded transparent cutout to detect it automatically, or drag to draw the slot.',
            );
        } catch {
            setStatusMessage(
                'Layout ready. Automatic cutout detection is unavailable for this asset, but you can drag to draw a slot.',
            );
        }
    }

    /**
     * Mark the current layout asset as unavailable after a browser image load failure.
     */
    function handleImageError(): void {
        setLoadedImageUrl(null);
        setAnalysisReadyUrl(null);
        imageAnalysisRef.current = null;
        setSelectionTarget(null);
        setDragStart(null);
        setDraftRectangle(null);
        setStatusMessage(
            'The layout preview could not be loaded. Choose another layout asset.',
        );
    }

    /**
     * Enter visual selection mode for a brand-new photo slot.
     */
    function handleAddSlotSelection(): void {
        if (!imageReady) {
            return;
        }

        setSelectionTarget('new');
        setDragStart(null);
        setDraftRectangle(null);
        setStatusMessage(
            `Select the area for Slot ${slots.length + 1}. Click a transparent cutout or drag a rectangle.`,
        );
    }

    /**
     * Enter visual selection mode for the currently selected existing slot.
     */
    function handleReselectSlot(): void {
        if (!imageReady || !slots[selectedSlotIndex]) {
            return;
        }

        setSelectionTarget(selectedSlotIndex);
        setDragStart(null);
        setDraftRectangle(null);
        setStatusMessage(
            `Reselect Slot ${selectedSlotIndex + 1}. Click a transparent cutout or drag a rectangle.`,
        );
    }

    /**
     * Leave visual selection mode without modifying canonical layout state.
     */
    function handleCancelSelection(): void {
        setSelectionTarget(null);
        setDragStart(null);
        setDraftRectangle(null);
        setStatusMessage(
            autoDetectAvailable
                ? 'Selection cancelled. Click a bounded transparent cutout for automatic detection, or drag to draw a slot.'
                : 'Selection cancelled. Drag on the layout to draw a slot.',
        );
    }

    /**
     * Start either automatic transparent-region detection or manual pointer drawing.
     */
    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
        if (!selectionMode || !imageReady || !layoutPreviewUrl) {
            return;
        }

        event.preventDefault();

        const bounds = event.currentTarget.getBoundingClientRect();
        const point = pointerToNormalizedPoint(
            event.clientX,
            event.clientY,
            bounds,
        );

        if (!point) {
            return;
        }

        const analysis = imageAnalysisRef.current;

        if (
            analysis?.url === layoutPreviewUrl &&
            analysis.imageData.width > 0 &&
            analysis.imageData.height > 0
        ) {
            const pixelX = Math.min(
                analysis.imageData.width - 1,
                Math.max(0, Math.floor(point.x * analysis.imageData.width)),
            );
            const pixelY = Math.min(
                analysis.imageData.height - 1,
                Math.max(0, Math.floor(point.y * analysis.imageData.height)),
            );

            const detectedRectangle = detectBoundedTransparentRegion(
                analysis.imageData,
                pixelX,
                pixelY,
            );

            if (detectedRectangle) {
                const geometry = normalizedRectangleToMillimeters(
                    detectedRectangle,
                    printWidthMm,
                    printHeightMm,
                );

                const targetIndex =
                    selectionTarget === 'new' ? null : selectionTarget;
                const slotNumber =
                    targetIndex === null ? slots.length + 1 : targetIndex + 1;

                onCommitSelection(targetIndex, geometry);

                setSelectionTarget(null);
                setDragStart(null);
                setDraftRectangle(null);
                setStatusMessage(
                    `Slot ${slotNumber} detected automatically from the transparent cutout.`,
                );

                return;
            }
        }

        setDragStart(point);
        setDraftRectangle({
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
        });

        event.currentTarget.setPointerCapture?.(event.pointerId);

        setStatusMessage(
            'Automatic detection was not available at that point. Keep dragging to draw the photo slot.',
        );
    }

    /**
     * Update the temporary visual rectangle during pointer dragging.
     */
    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
        if (!selectionMode || !dragStart) {
            return;
        }

        event.preventDefault();

        const point = pointerToNormalizedPoint(
            event.clientX,
            event.clientY,
            event.currentTarget.getBoundingClientRect(),
        );

        if (!point) {
            return;
        }

        setDraftRectangle(normalizedRectangleFromPoints(dragStart, point));
    }

    /**
     * Commit a sufficiently large pointer-drawn rectangle into canonical millimeter geometry.
     */
    function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        if (!selectionMode || !dragStart) {
            return;
        }

        event.preventDefault();

        const point = pointerToNormalizedPoint(
            event.clientX,
            event.clientY,
            event.currentTarget.getBoundingClientRect(),
        );

        event.currentTarget.releasePointerCapture?.(event.pointerId);

        if (!point) {
            setDragStart(null);
            setDraftRectangle(null);

            return;
        }

        const rectangle = normalizedRectangleFromPoints(dragStart, point);

        setDragStart(null);

        if (!isMeaningfulNormalizedRectangle(rectangle)) {
            setDraftRectangle(null);
            setStatusMessage(
                'Drag a larger rectangle to define the photo slot.',
            );

            return;
        }

        const geometry = normalizedRectangleToMillimeters(
            rectangle,
            printWidthMm,
            printHeightMm,
        );

        const targetIndex = selectionTarget === 'new' ? null : selectionTarget;
        const slotNumber =
            targetIndex === null ? slots.length + 1 : targetIndex + 1;

        onCommitSelection(targetIndex, geometry);

        setSelectionTarget(null);
        setDraftRectangle(null);
        setStatusMessage(`Slot ${slotNumber} updated from the selected area.`);
    }

    /**
     * Cancel an interrupted pointer drag while keeping visual selection mode available.
     */
    function handlePointerCancel(
        event: ReactPointerEvent<HTMLDivElement>,
    ): void {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setDragStart(null);
        setDraftRectangle(null);
        setStatusMessage(
            'Drawing cancelled. Try selecting the photo area again.',
        );
    }

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                    <p className="text-sm font-semibold">
                        Select photo areas visually
                    </p>
                    <p className="text-caption text-muted-foreground">
                        No coordinates required. Select the area on the layout
                        and ThermaSnap calculates the millimeter geometry.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={!imageReady || selectionMode}
                        onClick={handleAddSlotSelection}
                    >
                        <Plus aria-hidden="true" />
                        Add Photo Slot
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            !imageReady ||
                            selectionMode ||
                            !slots[selectedSlotIndex]
                        }
                        onClick={handleReselectSlot}
                    >
                        Reselect Slot {selectedSlotIndex + 1}
                    </Button>

                    {selectionMode && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCancelSelection}
                        >
                            Cancel Selection
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="grid min-w-0 gap-3">
                    <div className="flex min-h-80 items-center justify-center overflow-auto rounded-lg border bg-muted/20 p-4">
                        {!layoutPreviewUrl ? (
                            <div className="grid max-w-sm justify-items-center gap-2 text-center">
                                <FileImage
                                    className="size-8 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <p className="text-sm font-medium">
                                    Upload a layout asset first
                                </p>
                                <p className="text-caption text-muted-foreground">
                                    Choose the layout image in Section 3, then
                                    come back here to select the photo areas.
                                </p>
                            </div>
                        ) : (
                            <div className="relative inline-block max-w-full">
                                <img
                                    src={layoutPreviewUrl}
                                    alt="Interactive layout editor"
                                    draggable={false}
                                    className="block max-h-[32rem] max-w-full object-contain select-none"
                                    onLoad={handleImageLoad}
                                    onError={handleImageError}
                                />

                                <div
                                    className="pointer-events-none absolute inset-0"
                                    aria-hidden="true"
                                >
                                    {slots.map((slot, index) => {
                                        const valid = isSlotWithinPrintArea(
                                            slot,
                                            printWidthMm,
                                            printHeightMm,
                                        );
                                        const selected =
                                            index === selectedSlotIndex;

                                        return (
                                            <div
                                                key={slot.slot}
                                                data-testid={`visual-slot-overlay-${slot.slot}`}
                                                className={`absolute flex items-center justify-center border-2 ${
                                                    selected
                                                        ? 'border-primary bg-primary/10'
                                                        : valid
                                                          ? 'border-foreground/60 bg-background/10'
                                                          : 'border-destructive bg-destructive/10'
                                                }`}
                                                style={{
                                                    left: `${(slot.x / Math.max(1, printWidthMm)) * 100}%`,
                                                    top: `${(slot.y / Math.max(1, printHeightMm)) * 100}%`,
                                                    width: `${(slot.width / Math.max(1, printWidthMm)) * 100}%`,
                                                    height: `${(slot.height / Math.max(1, printHeightMm)) * 100}%`,
                                                }}
                                            >
                                                <span className="rounded-sm bg-background/90 px-1.5 py-0.5 text-caption font-semibold text-foreground shadow-xs">
                                                    {slot.slot}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {draftRectangle && (
                                        <div
                                            data-testid="draft-slot-selection"
                                            className="absolute border-2 border-dashed border-primary bg-primary/10"
                                            style={{
                                                left: `${draftRectangle.x * 100}%`,
                                                top: `${draftRectangle.y * 100}%`,
                                                width: `${draftRectangle.width * 100}%`,
                                                height: `${draftRectangle.height * 100}%`,
                                            }}
                                        />
                                    )}
                                </div>

                                {!selectionMode &&
                                    slots.map((slot, index) => (
                                        <button
                                            key={`selector-${slot.slot}`}
                                            type="button"
                                            aria-label={`Select slot ${slot.slot}`}
                                            className="absolute z-10 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                            style={{
                                                left: `${(slot.x / Math.max(1, printWidthMm)) * 100}%`,
                                                top: `${(slot.y / Math.max(1, printHeightMm)) * 100}%`,
                                                width: `${(slot.width / Math.max(1, printWidthMm)) * 100}%`,
                                                height: `${(slot.height / Math.max(1, printHeightMm)) * 100}%`,
                                            }}
                                            onClick={() => onSelectSlot(index)}
                                        >
                                            <span className="sr-only">
                                                Select photo slot {slot.slot}
                                            </span>
                                        </button>
                                    ))}

                                {selectionMode && imageReady && (
                                    <div
                                        data-testid="layout-slot-selection-surface"
                                        className="absolute inset-0 z-30 cursor-crosshair touch-none"
                                        role="presentation"
                                        onPointerDown={handlePointerDown}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerCancel={handlePointerCancel}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <p
                        role="status"
                        aria-live="polite"
                        className="text-caption text-muted-foreground"
                    >
                        {statusMessage}
                    </p>
                </div>

                <div className="grid content-start gap-3 rounded-lg border p-3">
                    <div>
                        <p className="text-sm font-semibold">Photo Slots</p>
                        <p className="mt-0.5 text-caption text-muted-foreground">
                            Select a slot to inspect or redraw it.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {slots.map((slot, index) => (
                            <Button
                                key={slot.slot}
                                type="button"
                                variant={
                                    index === selectedSlotIndex
                                        ? 'secondary'
                                        : 'outline'
                                }
                                size="sm"
                                onClick={() => onSelectSlot(index)}
                            >
                                Slot {slot.slot}
                            </Button>
                        ))}
                    </div>

                    <div className="rounded-md bg-muted/50 p-3">
                        <p className="text-caption text-muted-foreground">
                            {autoDetectAvailable
                                ? 'Transparent cutout detection is available for this layout. Click inside a bounded transparent photo opening for automatic sizing.'
                                : 'If automatic detection is unavailable, drag directly over the photo opening. The saved result is still millimeter geometry, never screen pixels.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Render secondary numeric controls for the currently selected slot.
 */
function SlotDetailsEditor({
    slots,
    selectedSlotIndex,
    printWidthMm,
    printHeightMm,
    onUpdate,
    onRemove,
}: {
    slots: LayoutSlot[];
    selectedSlotIndex: number;
    printWidthMm: number;
    printHeightMm: number;
    onUpdate: (
        index: number,
        coordinate: LayoutCoordinate,
        value: number,
    ) => void;
    onRemove: (index: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const slot = slots[selectedSlotIndex];

    if (!slot) {
        return null;
    }

    const valid = isSlotWithinPrintArea(slot, printWidthMm, printHeightMm);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="overflow-hidden rounded-lg border"
        >
            <CollapsibleTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between rounded-none px-4 py-3"
                >
                    <span className="flex flex-col items-start gap-0.5 text-left">
                        <span>Slot details</span>
                        <span className="text-caption font-normal text-muted-foreground">
                            Optional manual precision controls for Slot{' '}
                            {slot.slot}
                        </span>
                    </span>

                    <ChevronDown
                        className={`size-4 transition-transform ${
                            open ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                    />
                </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="border-t">
                <div className="grid gap-4 p-4">
                    <div className="grid gap-form sm:grid-cols-2 xl:grid-cols-4">
                        {(
                            ['x', 'y', 'width', 'height'] as LayoutCoordinate[]
                        ).map((coordinate) => (
                            <div key={coordinate} className="grid gap-field">
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
                                        coordinate === 'x' || coordinate === 'y'
                                            ? 0
                                            : 1
                                    }
                                    value={slot[coordinate]}
                                    aria-label={`Slot ${slot.slot} ${coordinate} in millimeters`}
                                    aria-invalid={!valid}
                                    onChange={(event) =>
                                        onUpdate(
                                            selectedSlotIndex,
                                            coordinate,
                                            Number(event.target.value),
                                        )
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-caption text-muted-foreground">
                            Changes here update the visual and live print
                            previews immediately.
                        </p>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={slots.length <= 1}
                            onClick={() => onRemove(selectedSlotIndex)}
                        >
                            <Trash2 aria-hidden="true" />
                            Remove Slot {slot.slot}
                        </Button>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * Render the form-driven print preview using the same millimeter geometry as the server renderer.
 */
function LivePrintPreview({
    configuration,
    selectedSlotIndex,
    printWidthMm,
    printHeightMm,
    orientation,
    layoutPreviewUrl,
    scale,
    onScaleChange,
}: {
    configuration: LayoutConfig;
    selectedSlotIndex: number;
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

                                {configuration.slots.map((slot, index) => {
                                    const valid = isSlotWithinPrintArea(
                                        slot,
                                        safeWidth,
                                        safeHeight,
                                    );
                                    const selected =
                                        index === selectedSlotIndex;

                                    return (
                                        <div
                                            key={slot.slot}
                                            data-testid={`live-preview-slot-${slot.slot}`}
                                            className={`absolute flex items-center justify-center border text-[10px] font-semibold ${
                                                !valid
                                                    ? 'border-destructive bg-destructive/10 text-destructive-foreground'
                                                    : selected
                                                      ? 'border-primary bg-primary/10 text-primary'
                                                      : 'border-foreground/60 bg-background/20 text-foreground'
                                            }`}
                                            style={{
                                                left: `${(slot.x / safeWidth) * 100}%`,
                                                top: `${(slot.y / safeHeight) * 100}%`,
                                                width: `${(slot.width / safeWidth) * 100}%`,
                                                height: `${(slot.height / safeHeight) * 100}%`,
                                            }}
                                        >
                                            <span className="rounded-sm bg-background/85 px-1 text-[10px] text-foreground">
                                                {slot.slot}
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
                    Unsaved slot changes appear here immediately using the same
                    millimeter geometry stored for final rendering.
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
                    Select photo openings directly on the layout whenever
                    possible.
                </li>
                <li>
                    Keep every slot inside the {printWidthMm} mm ×{' '}
                    {printHeightMm} mm print area.
                </li>
                <li>
                    Transparent bounded cutouts can be detected automatically.
                </li>
                <li>
                    Use drag selection or Slot details when automatic detection
                    is unavailable.
                </li>
                <li>Verify the live preview before publishing the template.</li>
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
    const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
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
     * Commit slot changes into the one canonical layout state and synchronize the advanced JSON draft.
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
     * Select one existing canonical slot for visual highlighting and manual editing.
     */
    function handleSelectSlot(index: number): void {
        if (!layoutConfig.slots[index]) {
            return;
        }

        setSelectedSlotIndex(index);
    }

    /**
     * Commit geometry created by the visual selector into an existing or newly appended slot.
     */
    function handleVisualSelectionCommit(
        targetIndex: number | null,
        geometry: SlotGeometry,
    ): void {
        if (targetIndex === null) {
            const nextIndex = layoutConfig.slots.length;

            commitLayoutConfiguration({
                ...layoutConfig,
                slots: [
                    ...layoutConfig.slots,
                    {
                        slot: nextIndex + 1,
                        ...geometry,
                    },
                ],
            });

            setSelectedSlotIndex(nextIndex);

            return;
        }

        const existing = layoutConfig.slots[targetIndex];

        if (!existing) {
            return;
        }

        const slots = layoutConfig.slots.map((slot, index) =>
            index === targetIndex
                ? {
                      ...slot,
                      ...geometry,
                      slot: targetIndex + 1,
                  }
                : slot,
        );

        commitLayoutConfiguration({
            ...layoutConfig,
            slots,
        });

        setSelectedSlotIndex(targetIndex);
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
     * Remove one slot and deterministically reindex the remaining slots.
     */
    function handleRemoveSlot(index: number): void {
        if (photoSlots <= 1 || !layoutConfig.slots[index]) {
            return;
        }

        const remainingSlots = layoutConfig.slots.filter(
            (_, slotIndex) => slotIndex !== index,
        );

        commitLayoutConfiguration({
            ...layoutConfig,
            slots: remainingSlots,
        });

        setSelectedSlotIndex(Math.min(index, remainingSlots.length - 1));
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

        setSelectedSlotIndex((current) =>
            Math.min(current, result.configuration!.slots.length - 1),
        );
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
                                        </Label>

                                        <Input
                                            id="photo_slots"
                                            name="photo_slots"
                                            type="number"
                                            min={1}
                                            required
                                            readOnly
                                            value={photoSlots}
                                            className="bg-muted/40"
                                            aria-invalid={!!errors.photo_slots}
                                            aria-describedby="photo_slots-help"
                                        />

                                        <p
                                            id="photo_slots-help"
                                            className="text-caption text-muted-foreground"
                                        >
                                            Managed automatically from Layout
                                            Configuration.
                                        </p>

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
                                description="Select photo areas directly on the layout. ThermaSnap calculates and stores the exact millimeter geometry automatically."
                            >
                                <div className="grid gap-4">
                                    <VisualLayoutEditor
                                        slots={layoutConfig.slots}
                                        selectedSlotIndex={selectedSlotIndex}
                                        printWidthMm={printWidthMm}
                                        printHeightMm={printHeightMm}
                                        layoutPreviewUrl={
                                            layoutPreview.previewUrl
                                        }
                                        onSelectSlot={handleSelectSlot}
                                        onCommitSelection={
                                            handleVisualSelectionCommit
                                        }
                                    />

                                    <SlotDetailsEditor
                                        slots={layoutConfig.slots}
                                        selectedSlotIndex={selectedSlotIndex}
                                        printWidthMm={printWidthMm}
                                        printHeightMm={printHeightMm}
                                        onUpdate={handleSlotUpdate}
                                        onRemove={handleRemoveSlot}
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
                                                        Optional expert editor
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
                                                        This remains an expert
                                                        escape hatch. Apply
                                                        valid JSON to update the
                                                        same canonical visual
                                                        slot state.
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
                                selectedSlotIndex={selectedSlotIndex}
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
