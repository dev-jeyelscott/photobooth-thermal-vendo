import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StickersIndex from './index';

const { routerPatch } = vi.hoisted(() => ({
    routerPatch: vi.fn(),
}));

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
    Head: () => null,
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
    router: {
        patch: routerPatch,
    },
    setLayoutProps: vi.fn(),
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DialogDescription: ({ children }: { children: ReactNode }) => (
        <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * Asserts that the button belongs to a POST form carrying the expected spoofed method.
 */
function expectSpoofedFormForButton(
    button: HTMLElement,
    expectedPath: string,
    expectedMethod: string,
) {
    const form = button.closest('form');

    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('method', 'post');

    const action = form?.getAttribute('action') ?? '';
    const [path, query = ''] = action.split('?');

    expect(path).toBe(expectedPath);
    expect(new URLSearchParams(query).get('_method')?.toLowerCase()).toBe(
        expectedMethod,
    );
}

describe('stickers index browser contract', () => {
    beforeEach(() => {
        routerPatch.mockClear();
    });

    it('uses backend asset URLs and dedicated CRUD routes', () => {
        render(
            <StickersIndex
                stickers={[
                    {
                        id: 7,
                        name: 'Party Hat',
                        assetUrl:
                            'https://media.example.test/stickers/party-hat.png',
                        thumbnailUrl:
                            'https://media.example.test/stickers/thumbnails/party-hat.png',
                        active: true,
                    },
                ]}
            />,
        );

        expect(screen.getByRole('img', { name: 'Party Hat' })).toHaveAttribute(
            'src',
            'https://media.example.test/stickers/thumbnails/party-hat.png',
        );

        expect(
            screen.getByRole('link', { name: 'New sticker' }),
        ).toHaveAttribute('href', '/admin/stickers/create');

        expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
            'href',
            '/admin/stickers/7/edit',
        );

        expectSpoofedFormForButton(
            screen.getByRole('button', { name: 'Disable' }),
            '/admin/stickers/7/toggle',
            'patch',
        );

        const deleteButtons = screen.getAllByRole('button', {
            name: 'Delete',
        });

        expectSpoofedFormForButton(
            deleteButtons[deleteButtons.length - 1],
            '/admin/stickers/7',
            'delete',
        );

        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
            'type',
            'button',
        );
    });

    it('falls back to the server-provided asset url without a thumbnail', () => {
        render(
            <StickersIndex
                stickers={[
                    {
                        id: 7,
                        name: 'Party Hat',
                        assetUrl:
                            'https://media.example.test/stickers/party-hat.png',
                        thumbnailUrl: null,
                        active: true,
                    },
                ]}
            />,
        );

        expect(screen.getByRole('img', { name: 'Party Hat' })).toHaveAttribute(
            'src',
            'https://media.example.test/stickers/party-hat.png',
        );
    });

    it('submits reordered sticker ids only to the reorder route', () => {
        render(
            <StickersIndex
                stickers={[
                    {
                        id: 7,
                        name: 'First',
                        assetUrl:
                            'https://media.example.test/stickers/first.png',
                        thumbnailUrl: null,
                        active: true,
                    },
                    {
                        id: 8,
                        name: 'Second',
                        assetUrl:
                            'https://media.example.test/stickers/second.png',
                        thumbnailUrl: null,
                        active: true,
                    },
                ]}
            />,
        );

        fireEvent.click(
            screen.getAllByRole('button', { name: 'Move down' })[0],
        );

        expect(routerPatch).toHaveBeenCalledWith(
            '/admin/stickers/reorder',
            {
                ordered_ids: [8, 7],
            },
            {
                preserveScroll: true,
            },
        );
    });
});
