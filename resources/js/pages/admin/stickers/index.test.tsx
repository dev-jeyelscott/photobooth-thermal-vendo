import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StickersIndex, {
    filterAndSortStickers,
    getStickerCompatibilityLabel,
    getStickerSummary,
} from './index';
import type { Sticker } from './index';

const { patchMock, dragEndRef } = vi.hoisted(() => ({
    patchMock: vi.fn(),
    dragEndRef: {
        current: undefined as
            | undefined
            | ((event: {
                  active: { id: number };
                  over: { id: number } | null;
              }) => void),
    },
}));

type MockFormState = {
    processing: boolean;
    errors: Record<string, string>;
    submit: () => void;
};

vi.mock('@dnd-kit/core', () => ({
    closestCenter: vi.fn(),
    DndContext: ({
        children,
        onDragEnd,
    }: {
        children: ReactNode;
        onDragEnd: (event: {
            active: { id: number };
            over: { id: number } | null;
        }) => void;
    }) => {
        dragEndRef.current = onDragEnd;

        return <div>{children}</div>;
    },
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    useSensor: vi.fn(() => ({})),
    useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));

vi.mock('@dnd-kit/sortable', () => ({
    arrayMove: <T,>(items: T[], oldIndex: number, newIndex: number): T[] => {
        const nextItems = [...items];
        const [movedItem] = nextItems.splice(oldIndex, 1);

        if (movedItem !== undefined) {
            nextItems.splice(newIndex, 0, movedItem);
        }

        return nextItems;
    },
    SortableContext: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    sortableKeyboardCoordinates: vi.fn(),
    useSortable: vi.fn(() => ({
        attributes: {},
        listeners: {},
        setActivatorNodeRef: vi.fn(),
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false,
    })),
    verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
    CSS: {
        Transform: {
            toString: vi.fn(() => undefined),
        },
    },
}));

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action?: string;
        method?: string;
        children?: ReactNode | ((state: MockFormState) => ReactNode);
    }) => (
        <form action={action} method={method}>
            {typeof children === 'function'
                ? children({
                      processing: false,
                      errors: {},
                      submit: vi.fn(),
                  })
                : children}
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
        patch: patchMock,
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
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
        <>{children}</>
    ),
    DropdownMenuItem: ({
        children,
        onSelect,
        disabled,
    }: {
        children: ReactNode;
        onSelect?: () => void;
        disabled?: boolean;
    }) => (
        <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
            {children}
        </button>
    ),
    DropdownMenuSeparator: () => <hr />,
}));

const stickers: Sticker[] = [
    {
        id: 1,
        name: 'Confetti Corner',
        assetUrl: '/storage/stickers/confetti.png',
        thumbnailUrl: '/storage/stickers/thumbnails/confetti.png',
        active: true,
        sortOrder: 0,
        templateIds: [],
    },
    {
        id: 2,
        name: 'Flash Badge',
        assetUrl: '/storage/stickers/flash.png',
        thumbnailUrl: null,
        active: true,
        sortOrder: 1,
        templateIds: [],
    },
    {
        id: 3,
        name: 'ThermaSnap Mark',
        assetUrl: '/storage/stickers/mark.png',
        thumbnailUrl: null,
        active: true,
        sortOrder: 2,
        templateIds: [],
    },
    {
        id: 4,
        name: 'Archived Star',
        assetUrl: '/storage/stickers/star.png',
        thumbnailUrl: null,
        active: false,
        sortOrder: 3,
        templateIds: [10, 11],
    },
];

/**
 * Assert that the supplied control belongs to a Wayfinder POST form carrying
 * Laravel's expected HTTP method spoofing value.
 */
function expectSpoofedFormForControl(
    control: HTMLElement,
    expectedPath: string,
    expectedMethod: string,
): void {
    const form = control.closest('form');

    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('method', 'post');

    const action = form?.getAttribute('action') ?? '';
    const [path, query = ''] = action.split('?');

    expect(path).toBe(expectedPath);
    expect(new URLSearchParams(query).get('_method')?.toLowerCase()).toBe(
        expectedMethod,
    );
}

beforeEach(() => {
    patchMock.mockReset();
    dragEndRef.current = undefined;
});

describe('sticker management calculations', () => {
    it('calculates repository-backed summary values', () => {
        expect(getStickerSummary(stickers)).toEqual({
            total: 4,
            active: 3,
            inactive: 1,
            allTemplates: 3,
        });
    });

    it('converts template restrictions into operator-friendly labels', () => {
        expect(getStickerCompatibilityLabel(stickers[0])).toBe('All templates');

        expect(getStickerCompatibilityLabel(stickers[3])).toBe(
            'Limited to 2 templates',
        );

        expect(
            getStickerCompatibilityLabel({
                ...stickers[3],
                templateIds: [10],
            }),
        ).toBe('Limited to 1 template');
    });

    it('filters and sorts without mutating canonical priority order', () => {
        expect(
            filterAndSortStickers(stickers, 'archived', 'all', 'priority').map(
                (sticker) => sticker.id,
            ),
        ).toEqual([4]);

        expect(
            filterAndSortStickers(stickers, '', 'inactive', 'priority').map(
                (sticker) => sticker.id,
            ),
        ).toEqual([4]);

        expect(
            filterAndSortStickers(stickers, '', 'all', 'name').map(
                (sticker) => sticker.name,
            ),
        ).toEqual([
            'Archived Star',
            'Confetti Corner',
            'Flash Badge',
            'ThermaSnap Mark',
        ]);

        expect(
            filterAndSortStickers(stickers, '', 'all', 'priority').map(
                (sticker) => sticker.id,
            ),
        ).toEqual([1, 2, 3, 4]);
    });
});

describe('stickers index page', () => {
    it('renders the approved operator-focused summary and controls', () => {
        render(<StickersIndex stickers={stickers} />);

        expect(
            screen.getByRole('heading', { name: 'Stickers' }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'New sticker' }),
        ).toHaveAttribute('href', '/admin/stickers/create');

        expect(
            within(screen.getByLabelText('Total stickers')).getByText('4'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Active')).getByText('3'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Inactive')).getByText('1'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Compatibility')).getByText('3'),
        ).toBeInTheDocument();
    });

    it('uses thumbnail fallback and plain-language compatibility labels', () => {
        render(<StickersIndex stickers={stickers} />);

        expect(
            screen.getByRole('img', { name: 'Confetti Corner' }),
        ).toHaveAttribute('src', '/storage/stickers/thumbnails/confetti.png');

        expect(
            screen.getByRole('img', { name: 'Flash Badge' }),
        ).toHaveAttribute('src', '/storage/stickers/flash.png');

        expect(screen.getAllByText('All templates')).toHaveLength(3);

        expect(screen.getByText('Limited to 2 templates')).toBeInTheDocument();
    });

    it('filters visible rows from the search field and disables ordering', async () => {
        const user = userEvent.setup();

        render(<StickersIndex stickers={stickers} />);

        await user.type(
            screen.getByRole('searchbox', {
                name: 'Search stickers',
            }),
            'archived',
        );

        expect(screen.getByText('Archived Star')).toBeInTheDocument();
        expect(screen.queryByText('Confetti Corner')).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Drag Archived Star to reorder',
            }),
        ).toBeDisabled();

        expect(screen.getByText('Showing 1 of 4 stickers')).toBeInTheDocument();
    });

    it('filters by active state using the segmented status controls', async () => {
        const user = userEvent.setup();

        render(<StickersIndex stickers={stickers} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Inactive',
            }),
        );

        expect(screen.getByText('Archived Star')).toBeInTheDocument();
        expect(screen.queryByText('Confetti Corner')).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Drag Archived Star to reorder',
            }),
        ).toBeDisabled();
    });

    it('persists drag reordering and rolls optimistic state back on failure', () => {
        render(<StickersIndex stickers={stickers} />);

        expect(dragEndRef.current).toBeTypeOf('function');

        act(() => {
            dragEndRef.current?.({
                active: { id: 1 },
                over: { id: 2 },
            });
        });

        expect(patchMock).toHaveBeenCalledWith(
            '/admin/stickers/reorder',
            {
                ordered_ids: [2, 1, 3, 4],
            },
            expect.objectContaining({
                preserveScroll: true,
                onError: expect.any(Function),
                onFinish: expect.any(Function),
            }),
        );

        expect(
            screen
                .getAllByRole('img')
                .map((image) => image.getAttribute('alt')),
        ).toEqual([
            'Flash Badge',
            'Confetti Corner',
            'ThermaSnap Mark',
            'Archived Star',
        ]);

        const options = patchMock.mock.calls[0]?.[2] as {
            onError?: () => void;
            onFinish?: () => void;
        };

        act(() => {
            options.onError?.();
            options.onFinish?.();
        });

        expect(
            screen
                .getAllByRole('img')
                .map((image) => image.getAttribute('alt')),
        ).toEqual([
            'Confetti Corner',
            'Flash Badge',
            'ThermaSnap Mark',
            'Archived Star',
        ]);
    });

    it('keeps existing edit toggle and delete Wayfinder contracts', () => {
        render(<StickersIndex stickers={stickers} />);

        expect(
            screen.getAllByRole('link', { name: 'Edit' })[0],
        ).toHaveAttribute('href', '/admin/stickers/1/edit');

        expectSpoofedFormForControl(
            screen.getByRole('switch', {
                name: 'Disable Confetti Corner',
            }),
            '/admin/stickers/1/toggle',
            'patch',
        );

        expectSpoofedFormForControl(
            screen.getAllByRole('button', {
                name: 'Delete sticker',
            })[0],
            '/admin/stickers/1',
            'delete',
        );
    });

    it('renders useful empty and no-result states', async () => {
        const { rerender } = render(<StickersIndex stickers={[]} />);

        expect(screen.getByText('No stickers yet.')).toBeInTheDocument();

        rerender(<StickersIndex stickers={stickers} />);

        const user = userEvent.setup();

        await user.type(
            screen.getByRole('searchbox', {
                name: 'Search stickers',
            }),
            'does-not-exist',
        );

        expect(
            screen.getByText(
                'No stickers match your current search or filters.',
            ),
        ).toBeInTheDocument();
    });
});
