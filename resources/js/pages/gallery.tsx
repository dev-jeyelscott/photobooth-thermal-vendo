import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type GalleryProps = {
    colorUrl: string | null;
    bwUrl: string | null;
    gifUrl: string | null;
    expired?: boolean;
    expiresAt?: string | null;
};

type GalleryAsset = {
    label: string;
    mediaType: 'JPG' | 'GIF';
    url: string;
    filename: string;
    featured: boolean;
};

/**
 * Format the backend ISO expiration timestamp for customer-facing display.
 */
function formatExpiration(expiresAt: string): string {
    const expiration = new Date(expiresAt);

    if (Number.isNaN(expiration.getTime())) {
        return expiresAt;
    }

    return expiration.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

/**
 * Render the compact ThermaSnap camera/viewfinder mark used by the public
 * customer gallery header.
 */
function ThermaSnapMark() {
    return (
        <div
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-foreground"
        >
            <div className="grid size-4 place-items-center rounded-full border border-foreground">
                <div className="size-2.5 rounded-full border border-foreground/60" />
            </div>
        </div>
    );
}

/**
 * Render the customer-facing ThermaSnap identity and public-session indicators.
 */
function GalleryHeader() {
    return (
        <header className="flex w-full flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <div className="flex items-center gap-3">
                <ThermaSnapMark />

                <div>
                    <p className="text-lg leading-none font-semibold tracking-[-0.02em]">
                        ThermaSnap
                    </p>
                    <p className="mt-1 text-[11px] leading-none tracking-[0.08em] text-muted-foreground uppercase">
                        Thermal Photobooth
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Gallery features">
                <span className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs text-muted-foreground">
                    Secure session
                </span>
                <span className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs text-muted-foreground">
                    Touch friendly
                </span>
            </div>
        </header>
    );
}

/**
 * Render one downloadable generated gallery asset using the appropriate
 * featured or compact card composition.
 */
function GalleryAssetCard({ asset }: { asset: GalleryAsset }) {
    return (
        <Card
            data-testid="gallery-asset"
            className="gap-0 overflow-hidden rounded-2xl border-border/80 bg-card py-0 shadow-none"
        >
            <div
                className={
                    asset.featured
                        ? 'aspect-[2.45/1] overflow-hidden bg-muted'
                        : 'aspect-[16/10] overflow-hidden bg-muted'
                }
            >
                <img
                    src={asset.url}
                    alt={`${asset.label} photobooth output`}
                    className="size-full object-cover"
                />
            </div>

            <div
                className={
                    asset.featured
                        ? 'flex items-center justify-between gap-4 p-4'
                        : 'flex items-center justify-between gap-3 p-4'
                }
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                        {asset.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {asset.mediaType}
                    </p>
                </div>

                <Button
                    asChild
                    size="lg"
                    variant={asset.featured ? 'default' : 'outline'}
                    className="h-11 shrink-0 rounded-xl px-5"
                >
                    <a href={asset.url} download={asset.filename}>
                        Download
                    </a>
                </Button>
            </div>
        </Card>
    );
}

/**
 * Render the shared private-by-token public gallery shell without authenticated
 * application or administration navigation.
 */
function GalleryShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="dark min-h-dvh bg-background text-foreground">
            <GalleryHeader />

            <main className="mx-auto w-full max-w-[640px] px-4 pb-8 sm:px-6">
                {children}
            </main>
        </div>
    );
}

/**
 * Render the temporary public ThermaSnap gallery while preserving the existing
 * media URLs, download filenames, expiration behavior, and privacy boundary.
 */
export default function Gallery({
    colorUrl,
    bwUrl,
    gifUrl,
    expired = false,
    expiresAt,
}: GalleryProps) {
    const assets: GalleryAsset[] = expired
        ? []
        : [
              colorUrl
                  ? {
                        label: 'Color photo',
                        mediaType: 'JPG',
                        url: colorUrl,
                        filename: 'photo-color.jpg',
                        featured: true,
                    }
                  : null,
              bwUrl
                  ? {
                        label: 'Black & white',
                        mediaType: 'JPG',
                        url: bwUrl,
                        filename: 'photo-bw.jpg',
                        featured: false,
                    }
                  : null,
              gifUrl
                  ? {
                        label: 'Animated GIF',
                        mediaType: 'GIF',
                        url: gifUrl,
                        filename: 'photo-animation.gif',
                        featured: false,
                    }
                  : null,
          ].filter((asset): asset is GalleryAsset => asset !== null);

    const featuredAsset = assets.find((asset) => asset.featured) ?? null;
    const secondaryAssets = assets.filter((asset) => !asset.featured);

    if (expired) {
        return (
            <>
                <Head title="Gallery Expired">
                    <meta name="robots" content="noindex, nofollow" />
                </Head>

                <GalleryShell>
                    <section className="pt-5 text-center sm:pt-8">
                        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Temporary customer gallery
                        </p>

                        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                            This gallery has expired
                        </h1>

                        <p
                            data-testid="gallery-expired"
                            className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base"
                        >
                            These photos are no longer available for download.
                        </p>
                    </section>

                    <Card className="mt-8 gap-0 rounded-2xl border-border/80 bg-card px-6 py-10 text-center shadow-none">
                        <p className="text-sm font-medium">
                            Gallery no longer available
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Temporary customer media is automatically removed
                            after its configured retention period.
                        </p>
                    </Card>

                    {/* <footer className="pb-2 pt-5 text-center text-xs leading-5 text-muted-foreground">
                        Public gallery access uses an unpredictable temporary
                        token and exposes no customer or admin metadata.
                    </footer> */}
                </GalleryShell>
            </>
        );
    }

    return (
        <>
            <Head title="Your Photos">
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <GalleryShell>
                <section className="pt-5 text-center sm:pt-8">
                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        Temporary customer gallery
                    </p>

                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Your photos
                    </h1>

                    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
                        Mobile-first, customer-facing, no admin navigation.
                        Download each generated output before the gallery
                        expires.
                    </p>

                    {expiresAt && (
                        <p
                            data-testid="gallery-expires-at"
                            className="mt-4 inline-flex min-h-8 items-center rounded-full border border-info/30 bg-info-subtle px-3 text-xs font-medium text-info-foreground"
                        >
                            Available until {formatExpiration(expiresAt)}
                        </p>
                    )}
                </section>

                {assets.length === 0 ? (
                    <Card className="mt-8 gap-0 rounded-2xl border-border/80 bg-card px-6 py-10 text-center shadow-none">
                        <p
                            data-testid="gallery-empty"
                            className="text-sm text-muted-foreground"
                        >
                            No photos are available for this gallery yet.
                        </p>
                    </Card>
                ) : (
                    <section
                        aria-label="Gallery downloads"
                        className="mt-8 grid gap-4"
                    >
                        {featuredAsset && (
                            <GalleryAssetCard asset={featuredAsset} />
                        )}

                        {secondaryAssets.length > 0 && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {secondaryAssets.map((asset) => (
                                    <GalleryAssetCard
                                        key={asset.url}
                                        asset={asset}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                <footer className="pt-5 pb-2 text-center text-xs leading-5 text-muted-foreground">
                    Public route /gallery/&#123;public-token&#125;.
                    Unpredictable token, expiring media, no customer or admin
                    metadata.
                </footer>
            </GalleryShell>
        </>
    );
}
