import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { adminNavigationItems } from '@/components/app-sidebar';
import { NavMain } from '@/components/nav-main';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

vi.mock('@inertiajs/react', () => {
    return {
        Link: ({
            children,
            href,
            ...props
        }: {
            children: ReactNode;
            href: string;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
        usePage: () => ({ url: '/admin/templates/42/edit' }),
    };
});

describe('admin navigation', () => {
    it('registers every admin module at its canonical route', () => {
        expect(
            adminNavigationItems.map(({ title, href, matches }) => ({
                title,
                href: typeof href === 'string' ? href : href.url,
                matches,
            })),
        ).toEqual([
            { title: 'Dashboard', href: '/admin', matches: undefined },
            { title: 'Templates', href: '/admin/templates', matches: 'prefix' },
            { title: 'Stickers', href: '/admin/stickers', matches: 'prefix' },
            { title: 'Vouchers', href: '/admin/vouchers', matches: 'prefix' },
            { title: 'Sessions', href: '/admin/sessions', matches: 'prefix' },
            { title: 'Payments', href: '/admin/payments', matches: 'prefix' },
            {
                title: 'Reports',
                href: '/admin/reports/daily',
                matches: 'prefix',
            },
            {
                title: 'System settings',
                href: '/admin/settings',
                matches: 'prefix',
            },
        ]);
    });

    it('keeps a module active on its nested admin routes', () => {
        render(
            <TooltipProvider>
                <SidebarProvider>
                    <NavMain items={adminNavigationItems} />
                </SidebarProvider>
            </TooltipProvider>,
        );

        expect(
            screen
                .getByText('Templates')
                .closest('[data-slot="sidebar-menu-button"]'),
        ).toHaveAttribute('data-active', 'true');

        expect(
            screen
                .getByText('Dashboard')
                .closest('[data-slot="sidebar-menu-button"]'),
        ).toHaveAttribute('data-active', 'false');
    });
});
