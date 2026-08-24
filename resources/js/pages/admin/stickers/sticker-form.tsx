import { Form, Link } from '@inertiajs/react';
import {
    ExternalLink,
    FileImage,
    FileText,
    Lightbulb,
    Save,
    Trash2,
    TriangleAlert,
    Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
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
import { index as stickersIndex } from '@/routes/admin/stickers';
import type { RouteFormDefinition } from '@/wayfinder';

export type TemplateOption = {
    id: number;
    name: string;
};

export type Sticker = {
    id: number;
    name: string;
    assetPath: string;
    assetUrl: string;
    thumbnailPath: string | null;
    thumbnailUrl: string | null;
    active: boolean;
    sortOrder: number;
    placement: Record<string, unknown> | null;
    templateIds: number[];
};

type ImageDimensions = {
    width: number;
    height: number;
};

const textareaClassName =
    'flex min-h-28 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';

const transparentPreviewClassName =
    'bg-background [background-image:linear-gradient(45deg,var(--muted)_25%,transparent_25%),linear-gradient(-45deg,var(--muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--muted)_75%),linear-gradient(-45deg,transparent_75%,var(--muted)_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0px] [background-size:16px_16px]';

/**
 * Format browser file sizes into concise operator-readable values.
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kilobytes = bytes / 1024;

    if (kilobytes < 1024) {
        return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
    }

    return `${(kilobytes / 1024).toFixed(1)} MB`;
}

/**
 * Manage one local file preview while revoking every temporary object URL.
 */
function useFilePreview(initialUrl: string | null | undefined) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(
        initialUrl ?? null,
    );
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);

    const objectUrlRef = useRef<string | null>(null);
    const selectionVersionRef = useRef(0);

    useEffect(() => {
        return () => {
            selectionVersionRef.current += 1;

            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
        };
    }, []);

    /**
     * Replace the selected browser file and discard stale preview resources.
     */
    function selectFile(file: File | null): void {
        selectionVersionRef.current += 1;
        const selectionVersion = selectionVersionRef.current;

        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }

        setSelectedFile(file);
        setDimensions(null);

        if (!file) {
            setPreviewUrl(initialUrl ?? null);

            return;
        }

        const objectUrl = URL.createObjectURL(file);

        objectUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);

        const image = new Image();

        image.onload = () => {
            if (selectionVersionRef.current !== selectionVersion) {
                return;
            }

            setDimensions({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        };

        image.onerror = () => {
            if (selectionVersionRef.current === selectionVersion) {
                setDimensions(null);
            }
        };

        image.src = objectUrl;
    }

    return {
        previewUrl,
        selectedFile,
        dimensions,
        selectFile,
    };
}

/**
 * Render one numbered form section using the canonical admin Card surface.
 */
function StickerSection({
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
 * Render one native image upload field with stored-asset and selected-file previews.
 */
function AssetUploadField({
    id,
    name,
    label,
    required,
    previewUrl,
    selectedFile,
    dimensions,
    currentUrl,
    currentPath,
    currentAlt,
    error,
    onFileChange,
}: {
    id: string;
    name: string;
    label: string;
    required: boolean;
    previewUrl: string | null;
    selectedFile: File | null;
    dimensions: ImageDimensions | null;
    currentUrl?: string | null;
    currentPath?: string | null;
    currentAlt: string;
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
                <div
                    className={`flex h-28 items-center justify-center overflow-hidden rounded-md border ${transparentPreviewClassName}`}
                >
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt={selectedFile ? `${label} preview` : currentAlt}
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

                        {selectedFile?.name ??
                            currentPath ??
                            'Choose an image file'}
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
                        Transparent PNG or WebP is recommended.
                        Laravel-supported images up to 5 MB are accepted by the
                        existing server validation.
                    </p>

                    {selectedFile && (
                        <p className="text-caption text-muted-foreground">
                            {selectedFile.type || 'Image'} ·{' '}
                            {formatFileSize(selectedFile.size)}
                            {dimensions
                                ? ` · ${dimensions.width} × ${dimensions.height} px`
                                : ''}
                        </p>
                    )}

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
 * Render the current sticker asset against a transparency-friendly preview surface.
 */
function StickerPreviewCard({ previewUrl }: { previewUrl: string | null }) {
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <FileImage
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
                <h2 className="text-card-title">Sticker Preview</h2>
            </div>

            <div className="p-4">
                <div
                    className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border ${transparentPreviewClassName}`}
                >
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Sticker preview"
                            className="size-full object-contain p-6"
                        />
                    ) : (
                        <FileImage
                            className="size-10 text-muted-foreground"
                            aria-hidden="true"
                        />
                    )}
                </div>

                <p className="mt-3 text-caption text-muted-foreground">
                    Transparency is shown against a neutral checkerboard
                    surface. Final placement remains controlled by the existing
                    sticker composition rules.
                </p>
            </div>
        </Card>
    );
}

/**
 * Render only current form state and browser-derived file information.
 */
function StickerSummary({
    name,
    active,
    sortOrder,
    templateIds,
    assetFile,
    assetDimensions,
    existingAssetPath,
}: {
    name: string;
    active: boolean;
    sortOrder: number;
    templateIds: number[];
    assetFile: File | null;
    assetDimensions: ImageDimensions | null;
    existingAssetPath?: string;
}) {
    const compatibility =
        templateIds.length === 0
            ? 'All templates'
            : templateIds.length === 1
              ? '1 selected template'
              : `${templateIds.length} selected templates`;

    return (
        <Card className="gap-0 py-0 shadow-none">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <FileText
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                />
                <h2 className="text-card-title">Sticker Summary</h2>
            </div>

            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 text-sm">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="truncate">{name || 'Not set'}</dd>

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

                <dt className="text-muted-foreground">Display Order</dt>
                <dd>{sortOrder}</dd>

                <dt className="text-muted-foreground">Compatibility</dt>
                <dd>{compatibility}</dd>

                <dt className="text-muted-foreground">Asset</dt>
                <dd className="truncate">
                    {assetFile
                        ? assetFile.name
                        : existingAssetPath
                          ? 'Stored asset'
                          : 'Not selected'}
                </dd>

                <dt className="text-muted-foreground">File Type</dt>
                <dd>
                    {assetFile
                        ? assetFile.type || 'Image'
                        : existingAssetPath
                          ? 'Stored image'
                          : 'Not available'}
                </dd>

                <dt className="text-muted-foreground">File Size</dt>
                <dd>
                    {assetFile
                        ? formatFileSize(assetFile.size)
                        : 'Not provided'}
                </dd>

                <dt className="text-muted-foreground">Dimensions</dt>
                <dd>
                    {assetDimensions
                        ? `${assetDimensions.width} × ${assetDimensions.height} px`
                        : 'Not provided'}
                </dd>
            </dl>
        </Card>
    );
}

/**
 * Render operational guidance without creating additional persisted sticker fields.
 */
function GuidelinesCard() {
    return (
        <Card className="gap-0 py-0 shadow-none">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Lightbulb className="size-4 text-warning" aria-hidden="true" />
                <h2 className="text-card-title">Guidelines</h2>
            </div>

            <ul className="grid list-disc gap-2 p-4 pl-8 text-sm text-muted-foreground">
                <li>Use transparent PNG or WebP assets when possible.</li>
                <li>Keep important artwork inside the visible asset bounds.</li>
                <li>Uploaded images must remain within the 5 MB limit.</li>
                <li>Selecting no compatible templates means all templates.</li>
                <li>
                    Review the preview before saving or activating a sticker.
                </li>
            </ul>
        </Card>
    );
}

/**
 * Render guarded deletion for an existing sticker using the established destroy route.
 */
function DangerZone({ sticker }: { sticker: Sticker }) {
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
                    Deleting an unused sticker is permanent. The server blocks
                    deletion when historical photobooth sessions reference it.
                </p>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            type="button"
                            variant="destructive"
                            className="shrink-0"
                        >
                            <Trash2 aria-hidden="true" />
                            Delete Sticker
                        </Button>
                    </DialogTrigger>

                    <DialogContent>
                        <Form
                            {...StickerController.destroy.form(sticker.id)}
                            options={{ preserveScroll: true }}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Delete sticker?
                                        </DialogTitle>

                                        <DialogDescription>
                                            This permanently deletes{' '}
                                            <strong>{sticker.name}</strong> and
                                            its stored sticker assets. This
                                            action cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>

                                    {errors.sticker && (
                                        <p
                                            role="alert"
                                            className="text-sm text-destructive-foreground"
                                        >
                                            {errors.sticker}
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
                                                : 'Delete sticker'}
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
 * Render the shared responsive Create/Edit Sticker administration workspace.
 */
export default function StickerForm({
    form,
    sticker,
    templates,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    sticker?: Sticker;
    templates: TemplateOption[];
}) {
    const [name, setName] = useState(sticker?.name ?? '');
    const [sortOrder, setSortOrder] = useState(sticker?.sortOrder ?? 0);
    const [placement, setPlacement] = useState(
        sticker?.placement ? JSON.stringify(sticker.placement, null, 2) : '',
    );
    const [active, setActive] = useState(sticker?.active ?? true);
    const [templateIds, setTemplateIds] = useState<number[]>(
        sticker?.templateIds ?? [],
    );

    const assetPreview = useFilePreview(sticker?.assetUrl);
    const thumbnailPreview = useFilePreview(sticker?.thumbnailUrl);

    /**
     * Update the controlled compatible-template selection while retaining the existing array field contract.
     */
    function handleTemplateChange(templateId: number, checked: boolean): void {
        setTemplateIds((current) => {
            if (checked) {
                return current.includes(templateId)
                    ? current
                    : [...current, templateId];
            }

            return current.filter((id) => id !== templateId);
        });
    }

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
                                    {sticker
                                        ? 'Edit Sticker'
                                        : 'Create Sticker'}
                                </h1>

                                <p className="mt-1 text-body text-muted-foreground">
                                    {sticker
                                        ? 'Update this sticker design and its availability.'
                                        : 'Add a new sticker overlay design for the photobooth.'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button asChild type="button" variant="outline">
                                    <Link href={stickersIndex()}>Cancel</Link>
                                </Button>

                                <Button type="submit" disabled={processing}>
                                    <Save aria-hidden="true" />
                                    {processing
                                        ? 'Saving...'
                                        : sticker
                                          ? 'Save changes'
                                          : 'Create sticker'}
                                </Button>
                            </div>
                        </div>

                        <div className="grid min-w-0 gap-section xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                            <div className="grid min-w-0 gap-4">
                                <StickerSection
                                    number={1}
                                    title="Basic Details"
                                >
                                    <div className="grid gap-form">
                                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                                            <div className="grid gap-field">
                                                <Label htmlFor="name">
                                                    Name
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
                                                    placeholder="Party Hat"
                                                    aria-invalid={!!errors.name}
                                                    aria-describedby={
                                                        errors.name
                                                            ? 'name-error'
                                                            : undefined
                                                    }
                                                    onChange={(event) =>
                                                        setName(
                                                            event.target.value,
                                                        )
                                                    }
                                                />

                                                <InputError
                                                    id="name-error"
                                                    message={errors.name}
                                                />
                                            </div>

                                            <div className="grid gap-field">
                                                <Label htmlFor="sort_order">
                                                    Sort order
                                                </Label>

                                                <Input
                                                    id="sort_order"
                                                    name="sort_order"
                                                    type="number"
                                                    min={0}
                                                    value={sortOrder}
                                                    aria-invalid={
                                                        !!errors.sort_order
                                                    }
                                                    aria-describedby={
                                                        errors.sort_order
                                                            ? 'sort_order-error'
                                                            : undefined
                                                    }
                                                    onChange={(event) =>
                                                        setSortOrder(
                                                            Math.max(
                                                                0,
                                                                Number(
                                                                    event.target
                                                                        .value,
                                                                ) || 0,
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

                                        <div className="rounded-lg border p-4">
                                            <input
                                                type="hidden"
                                                name="active"
                                                value="0"
                                            />

                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id="active"
                                                    name="active"
                                                    value="1"
                                                    checked={active}
                                                    aria-invalid={
                                                        !!errors.active
                                                    }
                                                    aria-describedby={
                                                        errors.active
                                                            ? 'active-error'
                                                            : 'active-help'
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        setActive(
                                                            checked === true,
                                                        )
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
                                                        Active stickers are
                                                        available for new
                                                        eligible kiosk sessions.
                                                    </p>
                                                </div>
                                            </div>

                                            <InputError
                                                id="active-error"
                                                message={errors.active}
                                            />
                                        </div>
                                    </div>
                                </StickerSection>

                                <StickerSection
                                    number={2}
                                    title="Asset Upload"
                                    description="Upload the primary sticker overlay. Transparent edges are recommended."
                                >
                                    <AssetUploadField
                                        id="asset"
                                        name="asset"
                                        label="Sticker asset"
                                        required={!sticker}
                                        previewUrl={assetPreview.previewUrl}
                                        selectedFile={assetPreview.selectedFile}
                                        dimensions={assetPreview.dimensions}
                                        currentUrl={sticker?.assetUrl}
                                        currentPath={sticker?.assetPath}
                                        currentAlt="Current sticker asset"
                                        error={errors.asset}
                                        onFileChange={assetPreview.selectFile}
                                    />
                                </StickerSection>

                                <StickerSection
                                    number={3}
                                    title="Thumbnail Preview"
                                    description="Optionally provide a smaller management and selection thumbnail."
                                >
                                    <AssetUploadField
                                        id="thumbnail"
                                        name="thumbnail"
                                        label="Thumbnail (optional)"
                                        required={false}
                                        previewUrl={thumbnailPreview.previewUrl}
                                        selectedFile={
                                            thumbnailPreview.selectedFile
                                        }
                                        dimensions={thumbnailPreview.dimensions}
                                        currentUrl={sticker?.thumbnailUrl}
                                        currentPath={sticker?.thumbnailPath}
                                        currentAlt="Current sticker thumbnail"
                                        error={errors.thumbnail}
                                        onFileChange={
                                            thumbnailPreview.selectFile
                                        }
                                    />
                                </StickerSection>

                                <StickerSection
                                    number={4}
                                    title="Compatibility & Placement"
                                    description="Control template restrictions and optional renderer placement metadata."
                                >
                                    <div className="grid gap-form">
                                        <fieldset
                                            className="grid gap-field"
                                            aria-invalid={!!errors.template_ids}
                                            aria-describedby={
                                                errors.template_ids
                                                    ? 'template_ids-error'
                                                    : 'template_ids-help'
                                            }
                                        >
                                            <legend className="text-sm leading-none font-medium">
                                                Compatible templates (none
                                                selected means all templates)
                                            </legend>

                                            <p
                                                id="template_ids-help"
                                                className="text-caption text-muted-foreground"
                                            >
                                                Leave every template unchecked
                                                to make this sticker available
                                                to all templates.
                                            </p>

                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {templates.map((template) => (
                                                    <div
                                                        key={template.id}
                                                        className="flex items-center gap-3 rounded-md border p-3"
                                                    >
                                                        <Checkbox
                                                            id={`template_${template.id}`}
                                                            name="template_ids[]"
                                                            value={String(
                                                                template.id,
                                                            )}
                                                            checked={templateIds.includes(
                                                                template.id,
                                                            )}
                                                            aria-invalid={
                                                                !!errors.template_ids
                                                            }
                                                            aria-describedby={
                                                                errors.template_ids
                                                                    ? 'template_ids-error'
                                                                    : 'template_ids-help'
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                handleTemplateChange(
                                                                    template.id,
                                                                    checked ===
                                                                        true,
                                                                )
                                                            }
                                                        />

                                                        <Label
                                                            htmlFor={`template_${template.id}`}
                                                        >
                                                            {template.name}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>

                                            <InputError
                                                id="template_ids-error"
                                                message={errors.template_ids}
                                            />
                                        </fieldset>

                                        <div className="grid gap-field">
                                            <Label htmlFor="placement">
                                                Placement (JSON, optional)
                                            </Label>

                                            <textarea
                                                id="placement"
                                                name="placement"
                                                rows={5}
                                                value={placement}
                                                placeholder='{"size_ratio": 0.22, "margin_ratio": 0.03}'
                                                aria-invalid={
                                                    !!errors.placement
                                                }
                                                aria-describedby={
                                                    errors.placement
                                                        ? 'placement-error'
                                                        : 'placement-help'
                                                }
                                                className={textareaClassName}
                                                onChange={(event) =>
                                                    setPlacement(
                                                        event.target.value,
                                                    )
                                                }
                                            />

                                            <p
                                                id="placement-help"
                                                className="text-caption text-muted-foreground"
                                            >
                                                Optional expert metadata. The
                                                existing server validation
                                                accepts size_ratio and
                                                margin_ratio values between 0
                                                and 1.
                                            </p>

                                            <InputError
                                                id="placement-error"
                                                message={errors.placement}
                                            />
                                        </div>
                                    </div>
                                </StickerSection>
                            </div>

                            <aside className="grid min-w-0 gap-4 xl:sticky xl:top-20 xl:self-start">
                                <StickerPreviewCard
                                    previewUrl={assetPreview.previewUrl}
                                />

                                <StickerSummary
                                    name={name}
                                    active={active}
                                    sortOrder={sortOrder}
                                    templateIds={templateIds}
                                    assetFile={assetPreview.selectedFile}
                                    assetDimensions={assetPreview.dimensions}
                                    existingAssetPath={sticker?.assetPath}
                                />

                                <GuidelinesCard />
                            </aside>
                        </div>
                    </>
                )}
            </Form>

            {sticker && (
                <div className="px-page pb-page md:px-page-desktop md:pb-page-desktop">
                    <DangerZone sticker={sticker} />
                </div>
            )}
        </>
    );
}
