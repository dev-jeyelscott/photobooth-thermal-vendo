import { useEffect, useState } from 'react';
import { KioskErrorState } from '@/components/kiosk-error-state';
import { Button } from '@/components/ui/button';
import type { PhotoTemplateOption } from '@/hooks/use-photobooth-session';
import { NETWORK_ERROR_MESSAGE } from '@/hooks/use-photobooth-session';

type SelectTemplateResult =
    { ok: true } | { ok: false; message: string; expired: boolean };

/**
 * Lets the customer browse enabled photo templates, preview a local selection,
 * and persist that selection only when the customer explicitly continues.
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
    const [selectedTemplate, setSelectedTemplate] =
        useState<PhotoTemplateOption | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchTemplates()
            .then((result) => {
                if (!cancelled) {
                    setTemplates(result);
                    setSelectedTemplate(result[0] ?? null);
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
    }, [fetchTemplates]);

    /**
     * Persists the currently highlighted template through the existing backend
     * transition and advances only after the authoritative selection succeeds.
     */
    const useSelectedTemplate = async () => {
        if (!selectedTemplate || isSaving) {
            return;
        }

        onActivity();
        setIsSaving(true);
        setError(null);
        setNetworkError(false);

        const result = await selectTemplate(selectedTemplate.id);

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

        onSelected(selectedTemplate);
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
            className="flex w-full flex-col items-center text-center"
        >
            <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                Step 2 of the session
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-neutral-50 sm:text-4xl lg:text-[2.6rem]">
                Choose a template
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
                Only enabled templates are shown. Each choice makes the required
                photo count clear before capture.
            </p>

            {error && (
                <p
                    role="alert"
                    data-testid="kiosk-template-error"
                    className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300"
                >
                    {error}
                </p>
            )}

            {isLoading ? (
                <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div
                            key={index}
                            className="h-72 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/60"
                        />
                    ))}
                </div>
            ) : templates.length === 0 ? (
                <p className="mt-8 rounded-xl border border-neutral-800 px-5 py-6 text-sm text-neutral-400">
                    No templates are currently available.
                </p>
            ) : (
                <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {templates.map((template) => {
                        const isSelected = selectedTemplate?.id === template.id;

                        return (
                            <button
                                key={template.id}
                                type="button"
                                data-testid={`kiosk-template-${template.id}`}
                                aria-pressed={isSelected}
                                disabled={isSaving}
                                onClick={() => {
                                    onActivity();
                                    setError(null);
                                    setSelectedTemplate(template);
                                }}
                                className={`rounded-xl border bg-neutral-950 p-3 text-left transition focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                                    isSelected
                                        ? 'border-blue-400 ring-1 ring-blue-400'
                                        : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50'
                                }`}
                            >
                                {template.thumbnailPath ? (
                                    <img
                                        src={template.thumbnailPath}
                                        alt={`${template.name} template preview`}
                                        className="aspect-[4/3] w-full rounded-lg bg-neutral-900 object-cover"
                                    />
                                ) : (
                                    <div className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-neutral-900 p-3">
                                        <div className="grid h-full w-full gap-2 rounded-md border-[10px] border-neutral-800 bg-neutral-800">
                                            {Array.from(
                                                {
                                                    length: Math.min(
                                                        template.photoSlots,
                                                        6,
                                                    ),
                                                },
                                                (_, index) => (
                                                    <span
                                                        key={index}
                                                        className="rounded bg-gradient-to-br from-neutral-600 to-neutral-800"
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </div>
                                )}
                                <span className="mt-3 block text-sm font-semibold text-neutral-100 sm:text-base">
                                    {template.name}
                                </span>
                                <span className="mt-0.5 block text-xs text-neutral-500">
                                    {template.photoSlots} photo
                                    {template.photoSlots === 1 ? '' : 's'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <Button
                type="button"
                size="lg"
                disabled={!selectedTemplate || isSaving}
                onClick={() => void useSelectedTemplate()}
                className="mt-7 min-h-12 bg-neutral-100 px-8 text-neutral-950 hover:bg-white"
            >
                {isSaving ? 'Saving…' : 'Use selected template'}
            </Button>
        </div>
    );
}
