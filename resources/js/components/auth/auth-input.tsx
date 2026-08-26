import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AuthInputProps = ComponentProps<typeof Input> & {
    icon: LucideIcon;
};

/**
 * Renders the existing Input primitive with one decorative leading icon while
 * preserving all native input props and accessibility relationships.
 */
export default function AuthInput({
    icon: Icon,
    className,
    ...props
}: AuthInputProps) {
    return (
        <div className="relative">
            <Icon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            />

            <Input
                className={cn('h-12 rounded-lg bg-background pl-10', className)}
                {...props}
            />
        </div>
    );
}
