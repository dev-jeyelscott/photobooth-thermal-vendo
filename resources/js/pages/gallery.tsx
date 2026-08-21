import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

type GalleryAsset = {
    label: string;
    url: string;
    filename: string;
};

export default function Gallery({
    colorUrl,
    bwUrl,
    gifUrl,
    expired,
    expiresAt,
}: {
    colorUrl: string | null;
    bwUrl: string | null;
    gifUrl: string | null;
    expired?: boolean;
    expiresAt?: string | null;
}) {
    if (expired) {
        return (
            <>
                <Head title="Gallery Expired" />
                <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4 py-8 text-white">
                    <div className="mx-auto max-w-md text-center">
                        <h1 className="text-2xl font-semibold">
                            This gallery has expired
                        </h1>
                        <p
                            data-testid="gallery-expired"
                            className="mt-2 text-sm text-neutral-400"
                        >
                            These photos are no longer available for download.
                        </p>
                    </div>
                </div>
            </>
        );
    }

    const assets: GalleryAsset[] = [
        colorUrl
            ? {
                  label: 'Color Photo',
                  url: colorUrl,
                  filename: 'photo-color.jpg',
              }
            : null,
        bwUrl
            ? {
                  label: 'Black & White Photo',
                  url: bwUrl,
                  filename: 'photo-bw.jpg',
              }
            : null,
        gifUrl
            ? {
                  label: 'Animated GIF',
                  url: gifUrl,
                  filename: 'photo-animation.gif',
              }
            : null,
    ].filter((asset): asset is GalleryAsset => asset !== null);

    return (
        <>
            <Head title="Your Photos" />
            <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-white">
                <div className="mx-auto flex max-w-md flex-col gap-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold">Your Photos</h1>
                        <p className="mt-1 text-sm text-neutral-400">
                            Tap an image to download it.
                        </p>
                        {expiresAt && (
                            <p
                                data-testid="gallery-expires-at"
                                className="mt-2 text-xs text-neutral-500"
                            >
                                Available until{' '}
                                {new Date(expiresAt).toLocaleString(
                                    undefined,
                                    {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                    },
                                )}
                            </p>
                        )}
                    </div>

                    {assets.length === 0 ? (
                        <p
                            data-testid="gallery-empty"
                            className="text-center text-sm text-neutral-400"
                        >
                            No photos are available for this gallery yet.
                        </p>
                    ) : (
                        assets.map((asset) => (
                            <div
                                key={asset.url}
                                data-testid="gallery-asset"
                                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                            >
                                <span className="text-sm font-medium text-neutral-300">
                                    {asset.label}
                                </span>
                                <img
                                    src={asset.url}
                                    alt={asset.label}
                                    className="w-full rounded-lg"
                                />
                                <Button asChild size="lg">
                                    <a
                                        href={asset.url}
                                        download={asset.filename}
                                    >
                                        Download
                                    </a>
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
