import { useEffect, useRef } from 'react';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';
import { cn } from '@/lib/utils';

const CANVAS_SCALE = 4;

/**
 * Keep these ratios numerically identical to
 * App\Services\ColorCompositionService so browser previews match output.
 */
const STICKER_SIZE_RATIO = 0.22;
const STICKER_MARGIN_RATIO = 0.03;

type LayoutSlot = {
    slot: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

/**
 * Mirrors Intervention Image cover semantics by cropping the source evenly
 * after scaling it to fully cover the destination rectangle.
 */
const coverSourceRect = (
    image: HTMLImageElement,
    destWidth: number,
    destHeight: number,
): {
    sx: number;
    sy: number;
    sWidth: number;
    sHeight: number;
} => {
    const scale = Math.max(
        destWidth / image.naturalWidth,
        destHeight / image.naturalHeight,
    );

    const sWidth = destWidth / scale;
    const sHeight = destHeight / scale;

    return {
        sx: (image.naturalWidth - sWidth) / 2,
        sy: (image.naturalHeight - sHeight) / 2,
        sWidth,
        sHeight,
    };
};

/**
 * Reads validated-looking template slots for browser preview rendering.
 */
const readLayoutSlots = (
    layoutConfig: Record<string, unknown> | null,
): LayoutSlot[] => {
    const slots = layoutConfig?.slots;

    if (!Array.isArray(slots)) {
        return [];
    }

    return slots
        .filter(
            (slot): slot is LayoutSlot =>
                typeof slot === 'object' &&
                slot !== null &&
                typeof (slot as LayoutSlot).x === 'number' &&
                typeof (slot as LayoutSlot).y === 'number' &&
                typeof (slot as LayoutSlot).width === 'number' &&
                typeof (slot as LayoutSlot).height === 'number',
        )
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
};

/**
 * Loads a browser image with anonymous CORS enabled so public-disk assets can
 * be safely used by Canvas when storage CORS is configured.
 */
const loadImage = (source: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();

        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load ${source}`));
        image.src = source;
    });

/**
 * Draw the same canonical composition ordering as ColorCompositionService:
 * white base, captured photos, transparent template frame, then sticker.
 */
export function PhotoCompositionPreview({
    capturedPhotos,
    template,
    sticker,
    className,
    testId = 'kiosk-composition-preview',
}: {
    capturedPhotos: string[];
    template: PhotoTemplateOption;
    sticker: StickerDesignOption | null;
    className?: string;
    testId?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context) {
            return;
        }

        let cancelled = false;

        canvas.width = template.printWidthMm * CANVAS_SCALE;
        canvas.height = template.printHeightMm * CANVAS_SCALE;

        /**
         * Compose the current customer preview without persisting any state.
         */
        const compose = async () => {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);

            const slots = readLayoutSlots(template.layoutConfig);

            for (let index = 0; index < template.photoSlots; index += 1) {
                const photo = capturedPhotos[index];
                const slot = slots[index];

                if (!photo || !slot) {
                    continue;
                }

                const image = await loadImage(photo);

                if (cancelled) {
                    return;
                }

                const destWidth = slot.width * CANVAS_SCALE;
                const destHeight = slot.height * CANVAS_SCALE;

                const source = coverSourceRect(image, destWidth, destHeight);

                context.drawImage(
                    image,
                    source.sx,
                    source.sy,
                    source.sWidth,
                    source.sHeight,
                    slot.x * CANVAS_SCALE,
                    slot.y * CANVAS_SCALE,
                    destWidth,
                    destHeight,
                );
            }

            if (template.layoutUrl) {
                const templateImage = await loadImage(template.layoutUrl);

                if (cancelled) {
                    return;
                }

                context.drawImage(
                    templateImage,
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                );
            }

            if (!sticker) {
                return;
            }

            const stickerImage = await loadImage(sticker.assetPath);

            if (cancelled) {
                return;
            }

            const stickerSize = canvas.width * STICKER_SIZE_RATIO;

            const margin = canvas.width * STICKER_MARGIN_RATIO;

            const stickerSource = coverSourceRect(
                stickerImage,
                stickerSize,
                stickerSize,
            );

            context.drawImage(
                stickerImage,
                stickerSource.sx,
                stickerSource.sy,
                stickerSource.sWidth,
                stickerSource.sHeight,
                canvas.width - stickerSize - margin,
                canvas.height - stickerSize - margin,
                stickerSize,
                stickerSize,
            );
        };

        void compose();

        return () => {
            cancelled = true;
        };
    }, [capturedPhotos, template, sticker]);

    return (
        <canvas
            ref={canvasRef}
            data-testid={testId}
            role="img"
            aria-label="Live photo composition preview"
            className={cn(
                'max-h-[34rem] max-w-full rounded-xl bg-white object-contain shadow-2xl shadow-black/40',
                className,
            )}
        />
    );
}
