import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TemplatesIndex, {
    filterAndSortTemplates,
    getTemplateSummary,
} from './index';
import type { Template } from './index';

const { patchMock } = vi.hoisted(() => ({
    patchMock: vi.fn(),
}));

type MockFormState = {
    processing: boolean;
    errors: Record<string, string>;
    submit: () => void;
};

vi.mock('@inertiajs/react', () => ({
    Form: ({
        children,
    }: {
        children?: ReactNode | ((state: MockFormState) => ReactNode);
    }) => (
        <form>
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
    Link: ({ children }: { children: ReactNode }) => (
        <a href="/admin/templates/create">{children}</a>
    ),
    router: {
        patch: patchMock,
    },
    setLayoutProps: vi.fn(),
}));

const templates: Template[] = [
    {
        id: 1,
        name: 'ThermaSnap Classic Strip',
        slug: 'thermasnap-classic-strip',
        orientation: 'portrait',
        layoutPath: 'templates/classic.png',
        layoutUrl: '/storage/templates/classic.png',
        thumbnailPath: 'templates/thumbnails/classic.png',
        thumbnailUrl: '/storage/templates/thumbnails/classic.png',
        photoSlots: 4,
        printWidthMm: 58,
        printHeightMm: 160,
        active: true,
        sortOrder: 0,
        printerCompatibility: null,
    },
    {
        id: 2,
        name: 'Double Portrait',
        slug: 'double-portrait',
        orientation: 'portrait',
        layoutPath: 'templates/double.png',
        layoutUrl: '/storage/templates/double.png',
        thumbnailPath: null,
        thumbnailUrl: null,
        photoSlots: 2,
        printWidthMm: 58,
        printHeightMm: 125,
        active: true,
        sortOrder: 1,
        printerCompatibility: null,
    },
    {
        id: 3,
        name: 'Wide Memory Pair',
        slug: 'wide-memory-pair',
        orientation: 'landscape',
        layoutPath: 'templates/wide.png',
        layoutUrl: '/storage/templates/wide.png',
        thumbnailPath: 'templates/thumbnails/wide.png',
        thumbnailUrl: '/storage/templates/thumbnails/wide.png',
        photoSlots: 2,
        printWidthMm: 80,
        printHeightMm: 58,
        active: true,
        sortOrder: 2,
        printerCompatibility: null,
    },
    {
        id: 4,
        name: 'Legacy Single Portrait',
        slug: 'legacy-single-portrait',
        orientation: 'portrait',
        layoutPath: 'templates/legacy.png',
        layoutUrl: '/storage/templates/legacy.png',
        thumbnailPath: null,
        thumbnailUrl: null,
        photoSlots: 1,
        printWidthMm: 58,
        printHeightMm: 100,
        active: false,
        sortOrder: 3,
        printerCompatibility: null,
    },
];

beforeEach(() => {
    patchMock.mockClear();
});

describe('template management calculations', () => {
    it('calculates the summary from the loaded templates', () => {
        expect(getTemplateSummary(templates)).toEqual({
            total: 4,
            active: 3,
            inactive: 1,
            averagePhotoSlots: '2.3',
        });
    });

    it('filters by search and status and sorts without mutating priority order', () => {
        expect(
            filterAndSortTemplates(templates, 'legacy', 'all', 'priority').map(
                (template) => template.id,
            ),
        ).toEqual([4]);

        expect(
            filterAndSortTemplates(templates, '', 'inactive', 'priority').map(
                (template) => template.id,
            ),
        ).toEqual([4]);

        expect(
            filterAndSortTemplates(templates, '', 'all', 'name').map(
                (template) => template.name,
            ),
        ).toEqual([
            'Double Portrait',
            'Legacy Single Portrait',
            'ThermaSnap Classic Strip',
            'Wide Memory Pair',
        ]);
    });
});

describe('templates index page', () => {
    it('renders the operator-focused summary and template payload', () => {
        render(<TemplatesIndex templates={templates} />);

        expect(
            screen.getByRole('heading', { name: 'Templates' }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'New Template' }),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Total Templates')).getByText('4'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Active')).getByText('3'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Inactive')).getByText('1'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Avg Photo Slots')).getByText('2.3'),
        ).toBeInTheDocument();
    });

    it('uses refreshed server props directly without effect synchronization', () => {
        const { rerender } = render(<TemplatesIndex templates={templates} />);

        const refreshedTemplates = templates.map((template) =>
            template.id === 1
                ? {
                      ...template,
                      active: false,
                  }
                : template,
        );

        rerender(<TemplatesIndex templates={refreshedTemplates} />);

        expect(
            within(screen.getByLabelText('Active')).getByText('2'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Inactive')).getByText('2'),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('switch', {
                name: 'Enable ThermaSnap Classic Strip',
            }),
        ).toBeInTheDocument();
    });

    it('filters the visible template rows from the search box', async () => {
        const user = userEvent.setup();

        render(<TemplatesIndex templates={templates} />);

        await user.type(
            screen.getByRole('searchbox', {
                name: 'Search templates',
            }),
            'legacy',
        );

        expect(screen.getByText('Legacy Single Portrait')).toBeInTheDocument();

        expect(
            screen.queryByText('ThermaSnap Classic Strip'),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Move Legacy Single Portrait up',
            }),
        ).toBeDisabled();
    });

    it('shows the stored thumbnail and a meaningful fallback', () => {
        render(<TemplatesIndex templates={templates} />);

        expect(
            screen.getByRole('img', {
                name: 'ThermaSnap Classic Strip preview',
            }),
        ).toHaveAttribute('src', '/storage/templates/thumbnails/classic.png');

        expect(
            screen.getByText('Preview unavailable for Double Portrait'),
        ).toBeInTheDocument();
    });

    it('persists arrow reordering through the existing route', async () => {
        const user = userEvent.setup();

        render(<TemplatesIndex templates={templates} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Move ThermaSnap Classic Strip down',
            }),
        );

        expect(patchMock).toHaveBeenCalledWith(
            '/admin/templates/reorder',
            {
                ordered_ids: [2, 1, 3, 4],
            },
            expect.objectContaining({
                preserveScroll: true,
                onSuccess: expect.any(Function),
                onError: expect.any(Function),
                onFinish: expect.any(Function),
            }),
        );
    });

    it('exposes accessible drag, toggle, edit, and delete controls', () => {
        render(<TemplatesIndex templates={templates} />);

        expect(
            screen.getByRole('button', {
                name: 'Drag ThermaSnap Classic Strip to reorder',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('switch', {
                name: 'Disable ThermaSnap Classic Strip',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: 'Edit',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Delete ThermaSnap Classic Strip',
            }),
        ).toBeInTheDocument();
    });

    it('renders the empty state without requiring additional props', () => {
        render(<TemplatesIndex templates={[]} />);

        expect(screen.getByText('No templates yet.')).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'New Template' }),
        ).toBeInTheDocument();
    });
});
