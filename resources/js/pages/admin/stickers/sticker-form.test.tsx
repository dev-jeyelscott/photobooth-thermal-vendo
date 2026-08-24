import { fireEvent, render, screen } from '@testing-library/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StickerForm from './sticker-form';

const formErrors = vi.hoisted(() => ({
    current: {} as Record<string, string>,
}));

const createObjectUrlMock = vi.fn(() => 'blob:sticker-preview');
const revokeObjectUrlMock = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrlMock,
});

Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrlMock,
});

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
            {children({ processing: false, errors: formErrors.current })}
        </form>
    ),
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: ({
        onCheckedChange,
        ...props
    }: InputHTMLAttributes<HTMLInputElement> & {
        onCheckedChange?: (checked: boolean) => void;
    }) => (
        <input
            type="checkbox"
            {...props}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
    ),
}));

const templates = [
    { id: 7, name: 'Classic' },
    { id: 8, name: 'Party' },
];

const existingSticker = {
    id: 42,
    name: 'Party Hat',
    assetPath: 'stickers/party-hat.png',
    assetUrl: '/storage/stickers/party-hat.png',
    thumbnailPath: 'stickers/thumbnails/party-hat.png',
    thumbnailUrl: '/storage/stickers/thumbnails/party-hat.png',
    active: false,
    sortOrder: 3,
    placement: {
        size_ratio: 0.2,
        margin_ratio: 0.05,
    },
    templateIds: [7],
};

beforeEach(() => {
    formErrors.current = {};
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
});

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

        const activeCheckbox = screen.getByRole('checkbox', {
            name: 'Active',
        });

        expect(activeCheckbox).toBeChecked();
        expect(activeCheckbox).toHaveAttribute('name', 'active');
        expect(activeCheckbox).toHaveAttribute('value', '1');
    });

    it('preserves an inactive sticker state when editing', () => {
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

    it('uses the request field names expected by sticker validation', () => {
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

        expect(screen.getByLabelText('Name')).toHaveAttribute('name', 'name');

        expect(screen.getByLabelText('Sticker asset')).toHaveAttribute(
            'name',
            'asset',
        );

        expect(screen.getByLabelText('Thumbnail (optional)')).toHaveAttribute(
            'name',
            'thumbnail',
        );

        expect(screen.getByLabelText('Sort order')).toHaveAttribute(
            'name',
            'sort_order',
        );

        expect(
            screen.getByLabelText('Placement (JSON, optional)'),
        ).toHaveAttribute('name', 'placement');

        expect(
            screen.getByRole('checkbox', { name: 'Classic' }),
        ).toHaveAttribute('name', 'template_ids[]');
    });

    it('requires the sticker asset on create but not on update', () => {
        const { rerender } = render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        const createAsset = screen.getByLabelText('Sticker asset');

        expect(createAsset).toHaveAttribute('type', 'file');
        expect(createAsset).toBeRequired();

        expect(screen.getByLabelText('Thumbnail (optional)')).toHaveAttribute(
            'type',
            'file',
        );

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

    it('submits compatible template ids using the expected array field', () => {
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

        const classic = screen.getByRole('checkbox', { name: 'Classic' });
        const party = screen.getByRole('checkbox', { name: 'Party' });

        expect(classic).toHaveAttribute('name', 'template_ids[]');
        expect(classic).toHaveAttribute('value', '7');
        expect(classic).toBeChecked();

        expect(party).toHaveAttribute('name', 'template_ids[]');
        expect(party).toHaveAttribute('value', '8');
        expect(party).not.toBeChecked();
    });

    it('uses the server-provided URLs for existing stored assets', () => {
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
            screen.getByRole('img', { name: 'Current sticker asset' }),
        ).toHaveAttribute('src', existingSticker.assetUrl);

        expect(
            screen.getByRole('img', { name: 'Current sticker thumbnail' }),
        ).toHaveAttribute('src', existingSticker.thumbnailUrl);

        expect(
            screen.getByRole('link', {
                name: 'View current sticker asset',
            }),
        ).toHaveAttribute('href', existingSticker.assetUrl);

        expect(
            screen.getByRole('link', { name: 'View current thumbnail' }),
        ).toHaveAttribute('href', existingSticker.thumbnailUrl);
    });

    it('previews a selected sticker asset without changing its form field contract', () => {
        render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        const file = new File(['sticker'], 'sparkle.png', {
            type: 'image/png',
        });

        const input = screen.getByLabelText('Sticker asset');

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        expect(createObjectUrlMock).toHaveBeenCalledWith(file);

        expect(
            screen.getByRole('img', { name: 'Sticker asset preview' }),
        ).toHaveAttribute('src', 'blob:sticker-preview');

        expect(input).toHaveAttribute('name', 'asset');
        expect(input).toBeRequired();
        expect(screen.getByText('sparkle.png')).toBeInTheDocument();
        expect(screen.getByText(/image\/png/)).toBeInTheDocument();
    });

    it('revokes temporary object URLs when the form unmounts', () => {
        const { unmount } = render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        const file = new File(['sticker'], 'sparkle.png', {
            type: 'image/png',
        });

        fireEvent.change(screen.getByLabelText('Sticker asset'), {
            target: {
                files: [file],
            },
        });

        unmount();

        expect(revokeObjectUrlMock).toHaveBeenCalledWith(
            'blob:sticker-preview',
        );
    });
});

describe('sticker form accessibility', () => {
    it('associates a validation error with its field via aria-describedby', () => {
        formErrors.current = { name: 'The name field is required.' };

        render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        const nameInput = screen.getByLabelText('Name');

        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');

        const message = screen.getByText('The name field is required.');

        expect(message).toHaveAttribute('id', 'name-error');
        expect(message).toHaveAttribute('role', 'alert');
    });

    it('groups compatible template checkboxes under a labelled fieldset', () => {
        render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        expect(
            screen.getByRole('group', {
                name: 'Compatible templates (none selected means all templates)',
            }),
        ).toBeInTheDocument();
    });

    it('associates a template_ids validation error with the group and each checkbox', () => {
        formErrors.current = {
            template_ids: 'The selected template ids are invalid.',
        };

        render(
            <StickerForm
                form={{ action: '/admin/stickers', method: 'post' }}
                templates={templates}
            />,
        );

        const group = screen.getByRole('group', {
            name: 'Compatible templates (none selected means all templates)',
        });

        expect(group).toHaveAttribute('aria-invalid', 'true');
        expect(group).toHaveAttribute('aria-describedby', 'template_ids-error');

        const classic = screen.getByLabelText('Classic');
        const party = screen.getByLabelText('Party');

        expect(classic).toHaveAttribute(
            'aria-describedby',
            'template_ids-error',
        );
        expect(classic).toHaveAttribute('aria-invalid', 'true');

        expect(party).toHaveAttribute('aria-describedby', 'template_ids-error');
        expect(party).toHaveAttribute('aria-invalid', 'true');

        const message = screen.getByText(
            'The selected template ids are invalid.',
        );

        expect(message).toHaveAttribute('id', 'template_ids-error');
    });
});
