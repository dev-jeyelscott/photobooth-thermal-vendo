import { Link } from '@inertiajs/react';
import {
    BookOpen,
    FolderGit2,
    Images,
    LayoutGrid,
    Monitor,
    Settings,
    Sticker,
    Ticket,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes/admin';
import { index as sessionsIndex } from '@/routes/admin/sessions';
import { edit as settingsEdit } from '@/routes/admin/settings';
import { index as stickersIndex } from '@/routes/admin/stickers';
import { index as templatesIndex } from '@/routes/admin/templates';
import { index as vouchersIndex } from '@/routes/admin/vouchers';
import type { NavItem } from '@/types';

export const adminNavigationItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Templates',
        href: templatesIndex(),
        icon: Images,
        matches: 'prefix',
    },
    {
        title: 'Stickers',
        href: stickersIndex(),
        icon: Sticker,
        matches: 'prefix',
    },
    {
        title: 'Vouchers',
        href: vouchersIndex(),
        icon: Ticket,
        matches: 'prefix',
    },
    {
        title: 'Sessions',
        href: sessionsIndex(),
        icon: Monitor,
        matches: 'prefix',
    },
    {
        title: 'System settings',
        href: settingsEdit(),
        icon: Settings,
        matches: 'prefix',
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: FolderGit2,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={adminNavigationItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
