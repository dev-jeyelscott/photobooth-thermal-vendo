import { render, screen } from '@testing-library/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import StickerForm from './sticker-form';

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action: string;
        method: string;
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form action={action} method={method}>
            {children({ processing: false, errors: {} })}
        </form>
    ),
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: (props: InputHTMLAttributes<HTMLInputElement>) => (
        <input type="checkbox" {...props} />
    ),
}));

const existingSticker = {
    id: 42,
    name: 'Party Hat',
    assetPath: 'stickers/party-hat.png',
    assetUrl: '/storage/stickers/party-hat.png',
    thumbnailPath: 'stickers/thumbnails/party-hat.png',
    thumbnailUrl: '/storage/stickers/thumbnails/party-hat.png',
    active: false,
    sortOrder: 2,
    placement: { size_ratio: 0.22, margin_ratio: 0.03 },
    templateIds: [7],
};

const templates = [{ id: 7, name: 'Classic Strip' }];

describe('sticker form browser payload contract', () => {
    it('submits an explicit Laravel boolean value for active', () => {
        const { container } = render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        expect(
            container.querySelector(
                'input[type="hidden"][name="active"][value="0"]',
            ),
        ).toBeInTheDocument();
        const activeCheckbox = screen.getByRole('checkbox', { name: 'Active' });
        expect(activeCheckbox).toBeChecked();
        expect(activeCheckbox).toHaveAttribute('value', '1');
    });

    it('preserves an inactive sticker state on edit', () => {
        render(
            <StickerForm
                form={{
                    action: '/admin/stickers/42?_method=PUT',
                    method: 'post',
                }}
                sticker={existingSticker}
                templates={templates}
            />,
        );

        expect(
            screen.getByRole('checkbox', { name: 'Active' }),
        ).not.toBeChecked();
    });

    it('requires the sticker asset only when creating a sticker', () => {
        const { rerender } = render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        expect(screen.getByLabelText('Sticker asset')).toBeRequired();

        rerender(
            <StickerForm
                form={{
                    action: '/admin/stickers/42?_method=PUT',
                    method: 'post',
                }}
                sticker={existingSticker}
                templates={templates}
            />,
        );

        expect(screen.getByLabelText('Sticker asset')).not.toBeRequired();
    });

    it('renders usable previews and links for current stored assets', () => {
        render(
            <StickerForm
                form={{
                    action: '/admin/stickers/42?_method=PUT',
                    method: 'post',
                }}
                sticker={existingSticker}
                templates={templates}
            />,
        );

        expect(
            screen.getByRole('img', { name: 'Party Hat current asset' }),
        ).toHaveAttribute('src', existingSticker.assetUrl);
        expect(
            screen.getByRole('link', { name: 'View current sticker asset' }),
        ).toHaveAttribute('href', existingSticker.assetUrl);
        expect(
            screen.getByRole('img', { name: 'Party Hat current thumbnail' }),
        ).toHaveAttribute('src', existingSticker.thumbnailUrl);
        expect(
            screen.getByRole('link', { name: 'View current thumbnail' }),
        ).toHaveAttribute('href', existingSticker.thumbnailUrl);
    });

    it('uses the passed Wayfinder form definition', () => {
        const { container } = render(
            <StickerForm
                form={{
                    action: '/admin/stickers/42?_method=PUT',
                    method: 'post',
                }}
                sticker={existingSticker}
                templates={templates}
            />,
        );

        expect(container.querySelector('form')).toHaveAttribute(
            'action',
            '/admin/stickers/42?_method=PUT',
        );
        expect(container.querySelector('form')).toHaveAttribute(
            'method',
            'post',
        );
    });
});
