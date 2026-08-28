import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    CreditCard,
    FolderGit2,
    Images,
    KeyRound,
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
import { edit as paymentSettingsEdit } from '@/routes/admin/payment-settings';
import { index as paymentsIndex } from '@/routes/admin/payments';
import { daily as reportsDaily } from '@/routes/admin/reports';
import { index as sessionsIndex } from '@/routes/admin/sessions';
import { edit as settingsEdit } from '@/routes/admin/settings';
import { index as stickersIndex } from '@/routes/admin/stickers';
import { index as templatesIndex } from '@/routes/admin/templates';
import { index as vouchersIndex } from '@/routes/admin/vouchers';
import type { NavItem } from '@/types';

/**
 * Build the authenticated admin navigation while hiding owner-only payment
 * configuration from ordinary Business members.
 */
export function buildAdminNavigationItems(
    canManagePaymentSettings: boolean,
): NavItem[] {
    return [
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
            title: 'Payments',
            href: paymentsIndex(),
            icon: CreditCard,
            matches: 'prefix',
        },
        ...(canManagePaymentSettings
            ? [
                  {
                      title: 'Payment settings',
                      href: paymentSettingsEdit(),
                      icon: KeyRound,
                      matches: 'prefix' as const,
                  },
              ]
            : []),
        {
            title: 'Reports',
            href: reportsDaily(),
            icon: BarChart3,
            matches: 'prefix',
        },
        {
            title: 'System settings',
            href: settingsEdit(),
            icon: Settings,
            matches: 'prefix',
        },
    ];
}

export const adminNavigationItems: NavItem[] = buildAdminNavigationItems(false);

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

/**
 * Render the authenticated admin navigation shell.
 */
export function AppSidebar() {
    const { auth } = usePage().props;

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
                <NavMain
                    items={buildAdminNavigationItems(
                        auth.canManagePaymentSettings,
                    )}
                />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
