import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Appearance from '@/pages/settings/appearance';

const updatePreferencesMock = vi.hoisted(() => vi.fn());
const setOpenMock = vi.hoisted(() => vi.fn());
const setLayoutPropsMock = vi.hoisted(() => vi.fn());

const appearanceState = vi.hoisted(() => ({
    appearance: 'system' as 'light' | 'dark' | 'system',
    density: 'balanced' as 'comfortable' | 'balanced' | 'compact',
    reduceMotion: false,
}));

const sidebarState = vi.hoisted(() => ({
    state: 'expanded' as 'expanded' | 'collapsed',
}));

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    setLayoutProps: setLayoutPropsMock,
}));

vi.mock('@/hooks/use-appearance', () => ({
    DEFAULT_APPEARANCE_PREFERENCES: {
        appearance: 'system',
        density: 'balanced',
        reduceMotion: false,
    },

    resolveAppearance: (appearance: 'light' | 'dark' | 'system') =>
        appearance === 'dark' ? 'dark' : 'light',

    useAppearance: () => ({
        appearance: appearanceState.appearance,
        density: appearanceState.density,
        reduceMotion: appearanceState.reduceMotion,
        updatePreferences: updatePreferencesMock,
        updateAppearance: vi.fn(),
        resolvedAppearance:
            appearanceState.appearance === 'dark' ? 'dark' : 'light',
    }),
}));

vi.mock('@/components/ui/sidebar', () => ({
    useSidebar: () => ({
        state: sidebarState.state,
        setOpen: setOpenMock,
    }),
}));

beforeEach(() => {
    appearanceState.appearance = 'system';
    appearanceState.density = 'balanced';
    appearanceState.reduceMotion = false;
    sidebarState.state = 'expanded';

    updatePreferencesMock.mockReset();
    setOpenMock.mockReset();
    setLayoutPropsMock.mockReset();
});

describe('ThermaSnap appearance settings redesign', () => {
    it('keeps selections in draft state until save', async () => {
        const user = userEvent.setup();

        render(<Appearance />);

        await user.click(
            screen.getByRole('radio', {
                name: 'Dark theme',
            }),
        );
        await user.click(
            screen.getByRole('radio', {
                name: 'Comfortable density',
            }),
        );
        await user.click(screen.getByLabelText('Reduce Motion'));
        await user.click(screen.getByLabelText('Compact Navigation'));

        expect(updatePreferencesMock).not.toHaveBeenCalled();
        expect(setOpenMock).not.toHaveBeenCalled();

        await user.click(
            screen.getByRole('button', {
                name: 'Save changes',
            }),
        );

        expect(updatePreferencesMock).toHaveBeenCalledWith({
            appearance: 'dark',
            density: 'comfortable',
            reduceMotion: true,
        });
        expect(setOpenMock).toHaveBeenCalledWith(false);
    });

    it('cancel restores persisted selections without writing preferences', async () => {
        const user = userEvent.setup();

        render(<Appearance />);

        await user.click(
            screen.getByRole('radio', {
                name: 'Dark theme',
            }),
        );

        expect(
            screen.getByRole('radio', {
                name: 'Dark theme',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        await user.click(
            screen.getByRole('button', {
                name: 'Cancel',
            }),
        );

        expect(
            screen.getByRole('radio', {
                name: 'System theme',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        expect(updatePreferencesMock).not.toHaveBeenCalled();
    });

    it('reset creates the deterministic default draft', async () => {
        appearanceState.appearance = 'dark';
        appearanceState.density = 'compact';
        appearanceState.reduceMotion = true;
        sidebarState.state = 'collapsed';

        const user = userEvent.setup();

        render(<Appearance />);

        await user.click(
            screen.getByRole('button', {
                name: 'Reset to Defaults',
            }),
        );

        expect(
            screen.getByRole('radio', {
                name: 'System theme',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        expect(
            screen.getByRole('radio', {
                name: 'Balanced density',
            }),
        ).toHaveAttribute('aria-checked', 'true');

        expect(screen.getByLabelText('Reduce Motion')).not.toBeChecked();
        expect(screen.getByLabelText('Compact Navigation')).not.toBeChecked();

        await user.click(
            screen.getByRole('button', {
                name: 'Save changes',
            }),
        );

        expect(updatePreferencesMock).toHaveBeenCalledWith({
            appearance: 'system',
            density: 'balanced',
            reduceMotion: false,
        });
        expect(setOpenMock).toHaveBeenCalledWith(true);
    });

    it('labels live preview content as sample data', () => {
        render(<Appearance />);

        expect(screen.getByText(/sample content only/i)).toBeInTheDocument();

        expect(screen.getByText('Sample Dashboard')).toBeInTheDocument();
    });
});
