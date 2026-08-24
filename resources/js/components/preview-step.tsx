import { useState } from 'react';
import { KioskErrorState } from '@/components/kiosk-error-state';
import { PhotoCompositionPreview } from '@/components/photo-composition-preview';
import { Button } from '@/components/ui/button';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';
import { NETWORK_ERROR_MESSAGE } from '@/hooks/use-photobooth-session';

type ConfirmPreviewResult =
    { ok: true } | { ok: false; message: string; expired: boolean };

/**
 * Presents the repository-consistent final composition, lets the customer
 * retake or reselect a sticker, and only advances after the backend confirms
 * the existing preview transition.
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
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState(false);

    /**
     * Confirms the preview through the existing session endpoint and preserves
     * the repository's expired-session and network-recovery behavior.
     */
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
            className="grid w-full items-center gap-8 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.25fr)] lg:gap-14"
        >
            <div className="flex justify-center lg:justify-start">
                <PhotoCompositionPreview
                    capturedPhotos={capturedPhotos}
                    template={template}
                    sticker={sticker}
                    testId="kiosk-preview-canvas"
                    className="w-auto max-w-full"
                />
            </div>

            <div className="mx-auto w-full max-w-2xl lg:mx-0">
                <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                    Final preview
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-neutral-50 sm:text-4xl lg:text-[2.6rem]">
                    Review your photos
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base">
                    The preview uses the same template slot, crop, and sticker
                    composition rules as the final generated output.
                </p>

                {error && (
                    <p
                        role="alert"
                        data-testid="kiosk-preview-error"
                        className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300"
                    >
                        {error}
                    </p>
                )}

                <div className="mt-7 rounded-xl border border-neutral-800 p-5">
                    <p className="text-xs text-neutral-500">Selected</p>
                    <p className="mt-1 text-base font-semibold text-neutral-100 sm:text-lg">
                        {template.name} · {template.photoSlots} photo
                        {template.photoSlots === 1 ? '' : 's'} ·{' '}
                        {sticker ? `${sticker.name} sticker` : 'No sticker'}
                    </p>
                    <p className="mt-2 text-sm text-neutral-400">
                        Confirm only when the composition looks right.
                    </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={isConfirming}
                        onClick={() => {
                            onActivity();
                            onRetakePhotos();
                        }}
                        className="min-h-12 border-neutral-800 bg-neutral-950 px-6 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                    >
                        Retake photos
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={isConfirming}
                        onClick={() => {
                            onActivity();
                            onChangeSticker();
                        }}
                        className="min-h-12 border-neutral-800 bg-neutral-950 px-6 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                    >
                        Change sticker
                    </Button>
                    <Button
                        type="button"
                        size="lg"
                        disabled={isConfirming}
                        onClick={confirm}
                        className="min-h-12 bg-neutral-100 px-7 text-neutral-950 hover:bg-white"
                    >
                        {isConfirming ? 'Confirming…' : 'Confirm preview'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
