import { cn } from '@/lib/utils';
import ThermaSnapBrand, {
    ThermaSnapMark,
} from '@/components/auth/thermasnap-brand';

const PHOTO_ASSET = '/images/welcome/photostrip-photo.png';

type AuthMarketingPanelProps = {
    eyebrow: string;
    title: string;
    description: string;
    className?: string;
};

type PhotoStripProps = {
    className?: string;
};

type ThermaSnapPrinterProps = {
    className?: string;
};

/**
 * Renders a decorative three-frame photostrip from the approved local
 * ThermaSnap customer-photo asset.
 */
function PhotoStrip({ className }: PhotoStripProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-1.5 rounded-md bg-white p-1.5 shadow-lg',
                className,
            )}
        >
            {[0, 1, 2].map((frame) => (
                <div
                    key={frame}
                    className="aspect-[1.05] overflow-hidden rounded-[2px] bg-muted"
                >
                    <img
                        src={PHOTO_ASSET}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                    />
                </div>
            ))}

            <div className="pt-0.5 text-center text-[7px] font-bold text-primary">
                ThermaSnap
            </div>
        </div>
    );
}

/**
 * Renders the non-interactive ThermaSnap thermal-printer illustration shared by
 * the desktop authentication marketing panels.
 */
function ThermaSnapPrinter({ className }: ThermaSnapPrinterProps) {
    return (
        <div aria-hidden="true" className={cn('relative h-56 w-72', className)}>
            <div className="absolute inset-x-0 top-0 bottom-8 rounded-t-[2.25rem] rounded-b-xl border border-primary/15 bg-primary/10 shadow-xl">
                <div className="absolute top-10 left-1/2 -translate-x-1/2">
                    <ThermaSnapMark className="size-11" />
                </div>

                <div className="absolute bottom-12 left-1/2 h-4 w-36 -translate-x-1/2 rounded-md bg-foreground/80 shadow-inner" />
            </div>

            <div className="absolute top-[78%] left-1/2 w-32 -translate-x-1/2 rounded-b-md bg-white p-2 shadow-md">
                <img
                    src={PHOTO_ASSET}
                    alt=""
                    draggable={false}
                    className="aspect-[1.45] w-full object-cover"
                />

                <div className="mt-1.5 text-center text-[7px] font-bold text-primary">
                    ThermaSnap
                </div>
            </div>
        </div>
    );
}

/**
 * Renders the reusable ThermaSnap desktop authentication marketing panel using
 * the established brand lockup and photobooth artwork.
 */
export default function AuthMarketingPanel({
    eyebrow,
    title,
    description,
    className,
}: AuthMarketingPanelProps) {
    return (
        <section
            className={cn(
                'hidden min-h-[720px] flex-col justify-between py-6 lg:flex',
                className,
            )}
        >
            <div>
                <ThermaSnapBrand />

                <div className="mt-20 max-w-xl">
                    <p className="text-sm font-semibold text-primary">
                        {eyebrow}
                    </p>

                    <h2 className="mt-5 text-5xl leading-[1.08] font-semibold tracking-[-0.04em] text-balance xl:text-[3.4rem]">
                        {title}
                    </h2>

                    <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>

            <div
                aria-hidden="true"
                className="relative h-[310px] w-full max-w-[620px]"
            >
                <div className="absolute -bottom-14 -left-12 size-80 rounded-full bg-primary/5" />

                <PhotoStrip className="absolute bottom-3 left-1 z-20 w-[7.5rem] -rotate-6" />
                <PhotoStrip className="absolute bottom-7 left-24 z-10 w-[7.5rem] rotate-3" />

                <ThermaSnapPrinter className="absolute right-5 bottom-0 z-10" />

                <div
                    className="absolute right-4 bottom-36 h-28 w-36 text-primary/10"
                    style={{
                        backgroundImage:
                            'radial-gradient(currentColor 1.3px, transparent 1.3px)',
                        backgroundSize: '13px 13px',
                    }}
                />
            </div>
        </section>
    );
}
