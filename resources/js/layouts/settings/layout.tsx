import { Link } from '@inertiajs/react';
import { Palette, ShieldCheck, UserRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';

const settingsNavigation = [
    {
        title: 'Profile',
        href: editProfile(),
        icon: UserRound,
    },
    {
        title: 'Security',
        href: editSecurity(),
        icon: ShieldCheck,
    },
    {
        title: 'Appearance',
        href: editAppearance(),
        icon: Palette,
    },
];

/**
 * Render the shared account-settings navigation without constraining settings
 * pages to the starter kit's previous narrow content width.
 */
export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <div className="min-w-0">
            <div className="px-4 pt-4 lg:px-6">
                <nav
                    className="mx-auto flex w-full max-w-content gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-xs"
                    aria-label="Account settings"
                >
                    {settingsNavigation.map((item) => {
                        const active = isCurrentOrParentUrl(item.href);
                        const Icon = item.icon;

                        return (
                            <Button
                                key={item.title}
                                size="sm"
                                variant={active ? 'secondary' : 'ghost'}
                                asChild
                                className="shrink-0"
                            >
                                <Link
                                    href={item.href}
                                    aria-current={active ? 'page' : undefined}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                    {item.title}
                                </Link>
                            </Button>
                        );
                    })}
                </nav>
            </div>

            {children}
        </div>
    );
}
