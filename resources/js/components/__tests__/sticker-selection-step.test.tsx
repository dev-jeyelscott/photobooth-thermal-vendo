import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StickerSelectionStep } from '@/components/sticker-selection-step';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';

const template: PhotoTemplateOption = {
    id: 1,
    name: 'Classic Strip',
    thumbnailPath: null,
    photoSlots: 3,
    layoutConfig: null,
    printWidthMm: 50,
    printHeightMm: 150,
};

const sticker: StickerDesignOption = {
    id: 1,
    name: 'Confetti',
    assetPath: '/stickers/confetti.png',
    thumbnailPath: null,
};

describe('StickerSelectionStep', () => {
    it('previews locally and persists the chosen sticker only when continuing', async () => {
        const user = userEvent.setup();
        const selectSticker = vi.fn().mockResolvedValue({ ok: true });
        const onContinue = vi.fn();

        render(
            <StickerSelectionStep
                fetchStickers={vi.fn().mockResolvedValue([sticker])}
                selectSticker={selectSticker}
                capturedPhotos={[]}
                template={template}
                onContinue={onContinue}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

        await user.click(await screen.findByTestId('kiosk-sticker-1'));

        expect(selectSticker).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => {
            expect(selectSticker).toHaveBeenCalledWith(1);
            expect(onContinue).toHaveBeenCalledWith(sticker);
        });
    });

    it('clears the local choice without writing an unsupported null selection to the backend', async () => {
        const user = userEvent.setup();
        const selectSticker = vi.fn().mockResolvedValue({ ok: true });

        render(
            <StickerSelectionStep
                fetchStickers={vi.fn().mockResolvedValue([sticker])}
                selectSticker={selectSticker}
                capturedPhotos={[]}
                template={template}
                onContinue={vi.fn()}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        await user.click(await screen.findByTestId('kiosk-sticker-1'));
        await user.click(
            screen.getByRole('button', { name: 'Clear selection' }),
        );

        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        expect(selectSticker).not.toHaveBeenCalled();
    });

    it('shows an inline error when the final selection is rejected', async () => {
        const user = userEvent.setup();

        render(
            <StickerSelectionStep
                fetchStickers={vi.fn().mockResolvedValue([sticker])}
                selectSticker={vi.fn().mockResolvedValue({
                    ok: false,
                    message: 'This sticker could not be selected.',
                    expired: false,
                })}
                capturedPhotos={[]}
                template={template}
                onContinue={vi.fn()}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        await user.click(await screen.findByTestId('kiosk-sticker-1'));
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(
            await screen.findByTestId('kiosk-sticker-error'),
        ).toHaveTextContent('This sticker could not be selected.');
    });
});
