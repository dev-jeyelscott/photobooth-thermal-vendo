import { useEffect, useState } from 'react';
import { KioskErrorState } from '@/components/kiosk-error-state';
import { PhotoCompositionPreview } from '@/components/photo-composition-preview';
import { Button } from '@/components/ui/button';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';
import { NETWORK_ERROR_MESSAGE } from '@/hooks/use-photobooth-session';

type SelectStickerResult =
    { ok: true } | { ok: false; message: string; expired: boolean };

/**
 * Lets the customer browse compatible enabled stickers, preview the local
 * choice against captured photos, and persist only the final choice when the
 * customer continues. Deferring the write keeps Clear selection truthful.
 */
export function StickerSelectionStep({
    fetchStickers,
    selectSticker,
    capturedPhotos,
    template,
    onContinue,
    onActivity,
    onExpired,
    onBackToStart,
}: {
    fetchStickers: () => Promise<StickerDesignOption[]>;
    selectSticker: (stickerDesignId: number) => Promise<SelectStickerResult>;
    capturedPhotos: string[];
    template: PhotoTemplateOption;
    onContinue: (sticker: StickerDesignOption) => void;
    onActivity: () => void;
    onExpired: () => void;
    onBackToStart: () => void;
}) {
    const [stickers, setStickers] = useState<StickerDesignOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSticker, setSelectedSticker] =
        useState<StickerDesignOption | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchStickers()
            .then((result) => {
                if (!cancelled) {
                    setStickers(result);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setNetworkError(true);
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

    /**
     * Persists the locally previewed sticker using the existing session action
     * and advances only after the backend accepts that selection.
     */
    const continueWithSticker = async () => {
        if (!selectedSticker || isSaving) {
            return;
        }

        onActivity();
        setIsSaving(true);
        setError(null);
        setNetworkError(false);

        const result = await selectSticker(selectedSticker.id);

        setIsSaving(false);

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

        onContinue(selectedSticker);
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
            data-testid="kiosk-select-sticker"
            className="grid w-full items-center gap-8 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.35fr)] lg:gap-14"
        >
            <div className="flex flex-col items-center lg:items-start">
                <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                    Live composition preview
                </p>
                <PhotoCompositionPreview
                    capturedPhotos={capturedPhotos}
                    template={template}
                    sticker={selectedSticker}
                    testId="kiosk-sticker-preview"
                    className="w-auto max-w-full"
                />
            </div>

            <div className="mx-auto w-full max-w-2xl lg:mx-0">
                <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                    Customize
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-neutral-50 sm:text-4xl lg:text-[2.6rem]">
                    Choose a sticker
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base">
                    Pick one enabled preset overlay. You can change the
                    selection before continuing to the final preview.
                </p>

                {error && (
                    <p
                        role="alert"
                        data-testid="kiosk-sticker-error"
                        className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300"
                    >
                        {error}
                    </p>
                )}

                {isLoading ? (
                    <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Array.from({ length: 6 }, (_, index) => (
                            <div
                                key={index}
                                className="h-28 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/60"
                            />
                        ))}
                    </div>
                ) : stickers.length === 0 ? (
                    <p className="mt-7 rounded-xl border border-neutral-800 px-4 py-5 text-sm text-neutral-400">
                        No compatible stickers are currently available.
                    </p>
                ) : (
                    <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {stickers.map((sticker) => {
                            const isSelected =
                                selectedSticker?.id === sticker.id;

                            return (
                                <button
                                    key={sticker.id}
                                    type="button"
                                    data-testid={`kiosk-sticker-${sticker.id}`}
                                    aria-pressed={isSelected}
                                    disabled={isSaving}
                                    onClick={() => {
                                        onActivity();
                                        setError(null);
                                        setSelectedSticker(sticker);
                                    }}
                                    className={`flex min-h-28 items-center justify-center overflow-hidden rounded-xl border bg-neutral-950 p-4 transition focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                                        isSelected
                                            ? 'border-blue-400 ring-1 ring-blue-400'
                                            : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50'
                                    }`}
                                >
                                    {sticker.thumbnailPath ? (
                                        <img
                                            src={sticker.thumbnailPath}
                                            alt={sticker.name}
                                            className="max-h-20 max-w-full object-contain"
                                        />
                                    ) : (
                                        <img
                                            src={sticker.assetPath}
                                            alt={sticker.name}
                                            className="max-h-20 max-w-full object-contain"
                                        />
                                    )}
                                    <span className="sr-only">
                                        {sticker.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                        type="button"
                        size="lg"
                        disabled={!selectedSticker || isSaving}
                        onClick={() => void continueWithSticker()}
                        className="min-h-12 bg-neutral-100 px-7 text-neutral-950 hover:bg-white"
                    >
                        {isSaving ? 'Saving…' : 'Continue'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={!selectedSticker || isSaving}
                        onClick={() => {
                            onActivity();
                            setSelectedSticker(null);
                            setError(null);
                        }}
                        className="min-h-12 border-neutral-800 bg-neutral-950 px-7 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                    >
                        Clear selection
                    </Button>
                </div>
            </div>
        </div>
    );
}
