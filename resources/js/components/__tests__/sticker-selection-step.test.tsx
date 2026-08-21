import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StickerSelectionStep } from '@/components/sticker-selection-step';
import type { StickerDesignOption } from '@/hooks/use-photobooth-session';

const sticker: StickerDesignOption = {
    id: 1,
    name: 'Confetti',
    assetPath: '/stickers/confetti.png',
    thumbnailPath: null,
};

describe('StickerSelectionStep', () => {
    it('disables Continue until a sticker is selected, then continues with the choice', async () => {
        const user = userEvent.setup();
        const onContinue = vi.fn();

        render(
            <StickerSelectionStep
                fetchStickers={vi.fn().mockResolvedValue([sticker])}
                selectSticker={vi.fn().mockResolvedValue({ ok: true })}
                templatePreviewPath={null}
                onContinue={onContinue}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

        await user.click(await screen.findByTestId('kiosk-sticker-1'));

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Continue' }),
            ).toBeEnabled();
        });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(onContinue).toHaveBeenCalledWith(sticker);
    });

    it('shows an inline error when selection is rejected', async () => {
        const user = userEvent.setup();

        render(
            <StickerSelectionStep
                fetchStickers={vi.fn().mockResolvedValue([sticker])}
                selectSticker={vi.fn().mockResolvedValue({
                    ok: false,
                    message: 'This sticker could not be selected.',
                    expired: false,
                })}
                templatePreviewPath={null}
                onContinue={vi.fn()}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        await user.click(await screen.findByTestId('kiosk-sticker-1'));

        expect(
            await screen.findByTestId('kiosk-sticker-error'),
        ).toHaveTextContent('This sticker could not be selected.');
    });
});
