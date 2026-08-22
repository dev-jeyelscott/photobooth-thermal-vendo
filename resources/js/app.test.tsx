import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    createInertiaApp: vi.fn(),
    initializeTheme: vi.fn(),
    appLayout: () => null,
    authLayout: () => null,
    kioskLayout: () => null,
    settingsLayout: () => null,
}));

vi.mock('@inertiajs/react', () => ({
    createInertiaApp: mocks.createInertiaApp,
}));

vi.mock('@/components/ui/sonner', () => ({
    Toaster: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/hooks/use-appearance', () => ({
    initializeTheme: mocks.initializeTheme,
}));

vi.mock('@/layouts/app-layout', () => ({
    default: mocks.appLayout,
}));

vi.mock('@/layouts/auth-layout', () => ({
    default: mocks.authLayout,
}));

vi.mock('@/layouts/kiosk-layout', () => ({
    default: mocks.kioskLayout,
}));

vi.mock('@/layouts/settings/layout', () => ({
    default: mocks.settingsLayout,
}));

type LayoutResolver = (name: string) => unknown;

/**
 * Returns the layout callback registered by the application's
 * createInertiaApp configuration.
 */
function getLayoutResolver(): LayoutResolver {
    const options = mocks.createInertiaApp.mock.calls[0]?.[0] as
        | {
              layout?: LayoutResolver;
          }
        | undefined;

    if (!options?.layout) {
        throw new Error(
            'Expected createInertiaApp to register a layout resolver.',
        );
    }

    return options.layout;
}

beforeAll(async () => {
    await import('@/app');
});

describe('global Inertia layout resolver', () => {
    it('uses the sidebar-free kiosk layout for customer kiosk and gallery pages', () => {
        const resolveLayout = getLayoutResolver();

        expect(resolveLayout('kiosk')).toBe(mocks.kioskLayout);
        expect(resolveLayout('gallery')).toBe(mocks.kioskLayout);
        expect(resolveLayout('gallery')).not.toBe(mocks.appLayout);
    });

    it('preserves existing application layout mappings', () => {
        const resolveLayout = getLayoutResolver();

        expect(resolveLayout('welcome')).toBeNull();
        expect(resolveLayout('auth/login')).toBe(mocks.authLayout);
        expect(resolveLayout('settings/profile')).toEqual([
            mocks.appLayout,
            mocks.settingsLayout,
        ]);
        expect(resolveLayout('admin/dashboard')).toBe(mocks.appLayout);
        expect(resolveLayout('dashboard')).toBe(mocks.appLayout);
    });
});
