import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { StickerDesignOption } from '@/hooks/use-photobooth-session';

const PREVIEW_SIZE = 480;

/**
 * Lets the customer browse enabled sticker designs and preview one overlaid on
 * the selected template's thumbnail, submitting the choice to the active
 * photobooth session. The selection can be changed at any time before
 * continuing, since it only updates the session's sticker_design_id.
 */
export function StickerSelectionStep({
    fetchStickers,
    selectSticker,
    templatePreviewPath,
    onContinue,
    onActivity,
}: {
    fetchStickers: () => Promise<StickerDesignOption[]>;
    selectSticker: (
        stickerDesignId: number,
    ) => Promise<{ ok: true } | { ok: false; message: string }>;
    templatePreviewPath: string | null;
    onContinue: (sticker: StickerDesignOption) => void;
    onActivity: () => void;
}) {
    const [stickers, setStickers] = useState<StickerDesignOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSticker, setSelectedSticker] =
        useState<StickerDesignOption | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetchStickers()
            .then((result) => {
                if (!cancelled) {
                    setStickers(result);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [fetchStickers]);

    // Redraws the overlay preview onto the canvas whenever the template
    // background or the selected sticker changes.
    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        canvas.width = PREVIEW_SIZE;
        canvas.height = PREVIEW_SIZE;
        context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

        let cancelled = false;

        const drawOverlay = () => {
            if (!selectedSticker) {
                return;
            }

            const stickerImage = new Image();
            stickerImage.crossOrigin = 'anonymous';
            stickerImage.onload = () => {
                if (cancelled) {
                    return;
                }

                context.drawImage(
                    stickerImage,
                    0,
                    0,
                    PREVIEW_SIZE,
                    PREVIEW_SIZE,
                );
            };
            stickerImage.src = selectedSticker.assetPath;
        };

        if (templatePreviewPath) {
            const templateImage = new Image();
            templateImage.crossOrigin = 'anonymous';
            templateImage.onload = () => {
                if (cancelled) {
                    return;
                }

                context.drawImage(
                    templateImage,
                    0,
                    0,
                    PREVIEW_SIZE,
                    PREVIEW_SIZE,
                );
                drawOverlay();
            };
            templateImage.src = templatePreviewPath;
        } else {
            context.fillStyle = 'rgba(255, 255, 255, 0.1)';
            context.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
            drawOverlay();
        }

        return () => {
            cancelled = true;
        };
    }, [templatePreviewPath, selectedSticker]);

    const choose = async (sticker: StickerDesignOption) => {
        if (isSaving) {
            return;
        }

        onActivity();
        setIsSaving(true);
        setError(null);

        const result = await selectSticker(sticker.id);

        setIsSaving(false);

        if (!result.ok) {
            setError(result.message);

            return;
        }

        setSelectedSticker(sticker);
    };

    return (
        <div
            data-testid="kiosk-select-sticker"
            className="flex w-full max-w-4xl flex-col items-center gap-4 text-center sm:gap-6"
        >
            <h2 className="text-2xl font-semibold sm:text-3xl">
                Choose a Sticker
            </h2>
            <p className="text-sm text-neutral-300 sm:text-base">
                Add a sticker to your photos. You can change your pick before
                continuing.
            </p>

            {error && (
                <p
                    role="alert"
                    data-testid="kiosk-sticker-error"
                    className="text-sm text-red-400"
                >
                    {error}
                </p>
            )}

            <canvas
                ref={canvasRef}
                data-testid="kiosk-sticker-preview"
                className="aspect-square w-full max-w-xs rounded-xl border border-white/20 bg-white/5"
            />

            {isLoading ? (
                <p className="text-sm text-neutral-400">Loading stickers...</p>
            ) : (
                <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {stickers.map((sticker) => (
                        <button
                            key={sticker.id}
                            type="button"
                            data-testid={`kiosk-sticker-${sticker.id}`}
                            disabled={isSaving}
                            onClick={() => choose(sticker)}
                            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50 ${
                                selectedSticker?.id === sticker.id
                                    ? 'border-white bg-white/10'
                                    : 'border-white/20 bg-white/5'
                            }`}
                        >
                            {sticker.thumbnailPath ? (
                                <img
                                    src={sticker.thumbnailPath}
                                    alt={sticker.name}
                                    className="aspect-square w-full rounded-lg object-cover"
                                />
                            ) : (
                                <div className="aspect-square w-full rounded-lg bg-white/10" />
                            )}
                            <span className="text-sm font-medium sm:text-base">
                                {sticker.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <Button
                type="button"
                size="lg"
                disabled={!selectedSticker || isSaving}
                onClick={() => {
                    if (!selectedSticker) {
                        return;
                    }

                    onActivity();
                    onContinue(selectedSticker);
                }}
            >
                Continue
            </Button>
        </div>
    );
}
