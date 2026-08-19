import { useEffect, useRef, useState } from 'react';
import { KioskErrorState } from '@/components/kiosk-error-state';
import { Button } from '@/components/ui/button';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';
import { NETWORK_ERROR_MESSAGE } from '@/hooks/use-photobooth-session';

type ConfirmPreviewResult =
    | { ok: true }
    | { ok: false; message: string; expired: boolean };

const CANVAS_SCALE = 4;
const STICKER_SIZE_RATIO = 0.22;
const STICKER_MARGIN_RATIO = 0.03;

type LayoutSlot = {
    slot: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

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

const loadImage = (source: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load ${source}`));
        image.src = source;
    });

/**
 * Composes the customer's captured photos onto the selected template's
 * layout_config slot coordinates, overlays the selected sticker, and lets
 * the customer confirm the composition or go back to retake shots or
 * reselect a sticker before the session advances toward processing.
 */
export function PreviewStep({
    capturedPhotos,
    template,
    sticker,
    confirmPreview,
    onConfirmed,
    onRetakePhotos,
    onChangeSticker,
    onActivity,
    onExpired,
    onBackToStart,
}: {
    capturedPhotos: string[];
    template: PhotoTemplateOption;
    sticker: StickerDesignOption | null;
    confirmPreview: () => Promise<ConfirmPreviewResult>;
    onConfirmed: () => void;
    onRetakePhotos: () => void;
    onChangeSticker: () => void;
    onActivity: () => void;
    onExpired: () => void;
    onBackToStart: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context) {
            return;
        }

        let cancelled = false;

        canvas.width = template.printWidthMm * CANVAS_SCALE;
        canvas.height = template.printHeightMm * CANVAS_SCALE;

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

                context.drawImage(
                    image,
                    slot.x * CANVAS_SCALE,
                    slot.y * CANVAS_SCALE,
                    slot.width * CANVAS_SCALE,
                    slot.height * CANVAS_SCALE,
                );
            }

            if (sticker) {
                const stickerImage = await loadImage(sticker.assetPath);

                if (cancelled) {
                    return;
                }

                const stickerSize = canvas.width * STICKER_SIZE_RATIO;
                const margin = canvas.width * STICKER_MARGIN_RATIO;

                context.drawImage(
                    stickerImage,
                    canvas.width - stickerSize - margin,
                    canvas.height - stickerSize - margin,
                    stickerSize,
                    stickerSize,
                );
            }
        };

        void compose();

        return () => {
            cancelled = true;
        };
    }, [capturedPhotos, template, sticker]);

    const confirm = async () => {
        if (isConfirming) {
            return;
        }

        onActivity();
        setIsConfirming(true);
        setError(null);
        setNetworkError(false);

        const result = await confirmPreview();

        setIsConfirming(false);

        if (!result.ok) {
            if (result.expired) {
                onExpired();

                return;
            }

            if (result.message === NETWORK_ERROR_MESSAGE) {
                setNetworkError(true);

                return;
            }

            setError(result.message);

            return;
        }

        onConfirmed();
    };

    if (networkError) {
        return (
            <KioskErrorState
                kind="network-interruption"
                onRetry={() => setNetworkError(false)}
                onBackToStart={onBackToStart}
            />
        );
    }

    return (
        <div
            data-testid="kiosk-preview"
            className="flex w-full max-w-2xl flex-col items-center gap-4 text-center sm:gap-6"
        >
            <h2 className="text-2xl font-semibold sm:text-3xl">
                Review Your Photos
            </h2>
            <p className="text-sm text-neutral-300 sm:text-base">
                This is a preview of your final print. Confirm to continue,
                or go back to make changes.
            </p>

            {error && (
                <p
                    role="alert"
                    data-testid="kiosk-preview-error"
                    className="text-sm text-red-400"
                >
                    {error}
                </p>
            )}

            <canvas
                ref={canvasRef}
                data-testid="kiosk-preview-canvas"
                className="w-full max-w-md rounded-xl border border-white/20 bg-white shadow-lg"
            />

            <div className="flex flex-wrap justify-center gap-3">
                <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={isConfirming}
                    onClick={() => {
                        onActivity();
                        onRetakePhotos();
                    }}
                >
                    Retake Photos
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={isConfirming}
                    onClick={() => {
                        onActivity();
                        onChangeSticker();
                    }}
                >
                    Change Sticker
                </Button>
                <Button
                    type="button"
                    size="lg"
                    disabled={isConfirming}
                    onClick={confirm}
                >
                    Confirm
                </Button>
            </div>
        </div>
    );
}
