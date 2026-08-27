import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
    value?: Appearance;
    onValueChange?: (value: Appearance) => void;
};

const options: {
    value: Appearance;
    icon: LucideIcon;
    label: string;
    description: string;
}[] = [
    {
        value: 'light',
        icon: Sun,
        label: 'Light',
        description: 'Clean and bright interface',
    },
    {
        value: 'dark',
        icon: Moon,
        label: 'Dark',
        description: 'Easy on the eyes in low light',
    },
    {
        value: 'system',
        icon: Monitor,
        label: 'System',
        description: 'Use your device preference',
    },
];

/**
 * Render accessible theme-selection cards in controlled or persisted mode.
 */
export default function AppearanceToggleTab({
    value,
    onValueChange,
    className,
    ...props
}: Props) {
    const { appearance: persistedAppearance, updateAppearance } =
        useAppearance();

    const selectedAppearance = value ?? persistedAppearance;

    /**
     * Route theme selection to controlled draft state when supplied, otherwise
     * preserve the existing immediate persistence behavior.
     */
    const selectAppearance = (appearance: Appearance): void => {
        if (onValueChange) {
            onValueChange(appearance);

            return;
        }

        updateAppearance(appearance);
    };

    return (
        <div
            role="radiogroup"
            aria-label="Theme preference"
            className={cn('grid gap-4 md:grid-cols-3', className)}
            {...props}
        >
            {options.map(
                ({ value: option, icon: Icon, label, description }) => {
                    const selected = selectedAppearance === option;

                    return (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${label} theme`}
                            onClick={() => selectAppearance(option)}
                            className={cn(
                                'flex min-h-28 items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-xs transition-[border-color,box-shadow,background-color] focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                selected
                                    ? 'border-primary ring-1 ring-primary/20'
                                    : 'hover:border-primary/35 hover:bg-muted/30',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-12 shrink-0 items-center justify-center rounded-full',
                                    selected
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted text-muted-foreground',
                                )}
                            >
                                <Icon aria-hidden="true" className="size-6" />
                            </span>

                            <span className="min-w-0">
                                <span className="block text-card-title">
                                    {label}
                                </span>
                                <span className="mt-1 block text-body text-muted-foreground">
                                    {description}
                                </span>
                            </span>
                        </button>
                    );
                },
            )}
        </div>
    );
}
