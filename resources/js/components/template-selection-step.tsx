import { useEffect, useState } from 'react';
import { KioskErrorState } from '@/components/kiosk-error-state';
import type { PhotoTemplateOption } from '@/hooks/use-photobooth-session';
import { NETWORK_ERROR_MESSAGE } from '@/hooks/use-photobooth-session';

type SelectTemplateResult =
    | { ok: true }
    | { ok: false; message: string; expired: boolean };

/**
 * Lets the customer browse enabled photo templates and pick one, submitting
 * the selection to the active photobooth session before advancing.
 */
export function TemplateSelectionStep({
    fetchTemplates,
    selectTemplate,
    onSelected,
    onActivity,
    onExpired,
    onBackToStart,
}: {
    fetchTemplates: () => Promise<PhotoTemplateOption[]>;
    selectTemplate: (photoTemplateId: number) => Promise<SelectTemplateResult>;
    onSelected: (template: PhotoTemplateOption) => void;
    onActivity: () => void;
    onExpired: () => void;
    onBackToStart: () => void;
}) {
    const [templates, setTemplates] = useState<PhotoTemplateOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectingId, setSelectingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchTemplates()
            .then((result) => {
                if (!cancelled) {
                    setTemplates(result);
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
    }, [fetchTemplates]);

    const choose = async (template: PhotoTemplateOption) => {
        if (selectingId !== null) {
            return;
        }

        onActivity();
        setSelectingId(template.id);
        setError(null);
        setNetworkError(false);

        const result = await selectTemplate(template.id);

        setSelectingId(null);

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

        onSelected(template);
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
            data-testid="kiosk-select-template"
            className="flex w-full max-w-4xl flex-col items-center gap-4 text-center sm:gap-6"
        >
            <h2 className="text-2xl font-semibold sm:text-3xl">
                Choose a Template
            </h2>
            <p className="text-sm text-neutral-300 sm:text-base">
                Pick a layout for your photos. This screen will reset
                automatically if left idle.
            </p>

            {error && (
                <p
                    role="alert"
                    data-testid="kiosk-template-error"
                    className="text-sm text-red-400"
                >
                    {error}
                </p>
            )}

            {isLoading ? (
                <p className="text-sm text-neutral-400">Loading templates...</p>
            ) : (
                <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {templates.map((template) => (
                        <button
                            key={template.id}
                            type="button"
                            data-testid={`kiosk-template-${template.id}`}
                            disabled={selectingId !== null}
                            onClick={() => choose(template)}
                            className="flex flex-col items-center gap-2 rounded-xl border border-white/20 bg-white/5 p-3 text-center transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {template.thumbnailPath ? (
                                <img
                                    src={template.thumbnailPath}
                                    alt={template.name}
                                    className="aspect-square w-full rounded-lg object-cover"
                                />
                            ) : (
                                <div className="aspect-square w-full rounded-lg bg-white/10" />
                            )}
                            <span className="text-sm font-medium sm:text-base">
                                {template.name}
                            </span>
                            <span className="text-xs text-neutral-400">
                                {template.photoSlots} photo
                                {template.photoSlots === 1 ? '' : 's'}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
