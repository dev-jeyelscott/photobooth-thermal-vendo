import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoCompositionPreview } from '@/components/photo-composition-preview';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';

const drawImage = vi.fn();
const fillRect = vi.fn();

class MockImage {
    crossOrigin = '';
    naturalWidth = 100;
    naturalHeight = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    private currentSource = '';

    /**
     * Expose the image source for render-order assertions.
     */
    get src(): string {
        return this.currentSource;
    }

    /**
     * Simulate a successfully loaded browser image asynchronously.
     */
    set src(value: string) {
        this.currentSource = value;

        queueMicrotask(() => {
            this.onload?.();
        });
    }
}

const template: PhotoTemplateOption = {
    id: 1,
    name: 'Transparent Frame',
    layoutUrl: '/storage/templates/frame.png',
    thumbnailPath: null,
    photoSlots: 1,
    layoutConfig: {
        slots: [
            {
                slot: 1,
                x: 0,
                y: 0,
                width: 50,
                height: 100,
            },
        ],
    },
    printWidthMm: 50,
    printHeightMm: 100,
};

const sticker: StickerDesignOption = {
    id: 1,
    name: 'Sticker',
    assetPath: '/storage/stickers/sticker.png',
    thumbnailPath: null,
};

describe('PhotoCompositionPreview frame composition', () => {
    beforeEach(() => {
        drawImage.mockClear();
        fillRect.mockClear();

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);

        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: vi.fn(() => ({
                fillStyle: '#ffffff',
                fillRect,
                drawImage,
            })),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('draws captured photo then full-canvas template frame then sticker', async () => {
        const { getByTestId } = render(
            <PhotoCompositionPreview
                capturedPhotos={['data:image/png;base64,photo']}
                template={template}
                sticker={sticker}
                testId="composition"
            />,
        );

        const canvas = getByTestId('composition') as HTMLCanvasElement;

        await waitFor(() => {
            expect(drawImage).toHaveBeenCalledTimes(3);
        });

        const sources = drawImage.mock.calls.map(
            (call) => (call[0] as unknown as MockImage).src,
        );

        expect(sources).toEqual([
            'data:image/png;base64,photo',
            '/storage/templates/frame.png',
            '/storage/stickers/sticker.png',
        ]);

        expect(drawImage.mock.calls[1].slice(1)).toEqual([
            0,
            0,
            canvas.width,
            canvas.height,
        ]);
    });

    it('still draws the transparent template frame when no sticker is selected', async () => {
        render(
            <PhotoCompositionPreview
                capturedPhotos={['data:image/png;base64,photo']}
                template={template}
                sticker={null}
            />,
        );

        await waitFor(() => {
            expect(drawImage).toHaveBeenCalledTimes(2);
        });

        const sources = drawImage.mock.calls.map(
            (call) => (call[0] as unknown as MockImage).src,
        );

        expect(sources).toEqual([
            'data:image/png;base64,photo',
            '/storage/templates/frame.png',
        ]);
    });
});
