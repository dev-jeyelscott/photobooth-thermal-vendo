import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import type { ComponentProps, Ref } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = Omit<ComponentProps<'input'>, 'type'> & {
    ref?: Ref<HTMLInputElement>;
    leadingIcon?: LucideIcon;
};

/**
 * Renders a password input with an optional decorative leading icon and a
 * keyboard-accessible control for showing or hiding the password value.
 */
export default function PasswordInput({
    className,
    ref,
    leadingIcon: LeadingIcon,
    id,
    disabled,
    ...props
}: Props) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="relative">
            {LeadingIcon && (
                <LeadingIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                />
            )}

            <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                disabled={disabled}
                className={cn('pr-11', LeadingIcon && 'pl-10', className)}
                ref={ref}
                {...props}
            />

            <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                disabled={disabled}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls={id}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
                {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                    <Eye aria-hidden="true" className="size-4" />
                )}
            </button>
        </div>
    );
}
