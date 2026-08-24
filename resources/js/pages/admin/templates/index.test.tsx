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

type MockLinkHref = string | { url: string };

/**
 * Normalize an Inertia or Wayfinder href into the URL rendered by the test
 * anchor so route assertions exercise the real component contract.
 */
function resolveHref(href: MockLinkHref): string {
    return typeof href === 'string' ? href : href.url;
}

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
    Link: ({ children, href }: { children: ReactNode; href: MockLinkHref }) => (
        <a href={resolveHref(href)}>{children}</a>
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

    it('filters by search, status, and photo slots and sorts without mutating display order', () => {
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
            filterAndSortTemplates(templates, '', 'all', 'priority', '2').map(
                (template) => template.id,
            ),
        ).toEqual([2, 3]);

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
    it('renders the redesigned summary, management table, and template payload', () => {
        render(<TemplatesIndex templates={templates} />);

        expect(
            screen.getByRole('heading', { name: 'Templates' }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'Create Template' }),
        ).toHaveAttribute('href', '/admin/templates/create');

        expect(
            within(screen.getByLabelText('Total Templates')).getByText('4'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Active Templates')).getByText('3'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Inactive Templates')).getByText('1'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Average Photo Slots')).getByText(
                '2.3',
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('table', { name: 'Photo templates' }),
        ).toBeInTheDocument();

        const table = screen.getByRole('table', { name: 'Photo templates' });
        expect(
            within(table).getByRole('columnheader', { name: 'Display Order' }),
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
            within(screen.getByLabelText('Active Templates')).getByText('2'),
        ).toBeInTheDocument();

        expect(
            within(screen.getByLabelText('Inactive Templates')).getByText('2'),
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

    it('exposes accessible drag, toggle, edit, move, and delete controls', () => {
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
                name: 'Edit ThermaSnap Classic Strip',
            }),
        ).toHaveAttribute('href', '/admin/templates/1/edit');

        expect(
            screen.getByRole('button', {
                name: 'Move ThermaSnap Classic Strip down',
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
            screen.getByRole('link', { name: 'Create Template' }),
        ).toHaveAttribute('href', '/admin/templates/create');
    });
});
