import {
    fireEvent,
    render as testingLibraryRender,
    screen,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import TemplateForm, {
    detectBoundedTransparentRegion,
    normalizedRectangleFromPoints,
    normalizedRectangleToMillimeters,
    type TransparencyImageData,
} from './template-form';

const formErrors = vi.hoisted(() => ({
    current: {} as Record<string, string>,
}));

/**
 * Render the template form with the same application-level providers used in production.
 */
function render(ui: ReactElement) {
    return testingLibraryRender(
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
}

/**
 * Resolve an Inertia or Wayfinder href into the URL expected by the test anchor.
 */
function resolveHref(href: unknown): string {
    if (typeof href === 'string') {
        return href;
    }

    if (
        typeof href === 'object' &&
        href !== null &&
        'url' in href &&
        typeof href.url === 'string'
    ) {
        return href.url;
    }

    return '#';
}

/**
 * Build deterministic RGBA image data with selected transparent pixels.
 */
function makeTransparencyImage(
    width: number,
    height: number,
    transparentCoordinates: Array<[number, number]>,
): TransparencyImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    data.fill(255);

    for (const [x, y] of transparentCoordinates) {
        data[(y * width + x) * 4 + 3] = 0;
    }

    return {
        data,
        width,
        height,
    };
}

/**
 * Mark the interactive layout image as browser-loaded with stable natural dimensions.
 */
function loadInteractiveLayoutImage(): HTMLElement {
    const image = screen.getByAltText('Interactive layout editor');

    Object.defineProperty(image, 'naturalWidth', {
        configurable: true,
        value: 1000,
    });
    Object.defineProperty(image, 'naturalHeight', {
        configurable: true,
        value: 1500,
    });

    fireEvent.load(image);

    return image;
}

/**
 * Give the pointer selection surface deterministic rendered browser bounds.
 */
function prepareSelectionSurface(): HTMLElement {
    const surface = screen.getByTestId('layout-slot-selection-surface');

    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 200,
        bottom: 300,
        width: 200,
        height: 300,
        toJSON: () => ({}),
    });

    return surface;
}

/**
 * Decode the canonical layout_config hidden form value.
 */
function readLayoutConfig(container: HTMLElement): {
    slots: Array<{
        slot: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
} {
    const input = container.querySelector('input[name="layout_config"]');

    expect(input).not.toBeNull();

    return JSON.parse(input?.getAttribute('value') ?? '{}') as {
        slots: Array<{
            slot: number;
            x: number;
            y: number;
            width: number;
            height: number;
        }>;
    };
}

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        className,
        children,
    }: {
        action: string;
        method: string;
        className?: string;
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form action={action} method={method} className={className}>
            {children({
                processing: false,
                errors: formErrors.current,
            })}
        </form>
    ),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: unknown;
        children: ReactNode;
    }) => (
        <a href={resolveHref(href)} {...props}>
            {children}
        </a>
    ),
}));

const existingTemplate = {
    id: 42,
    name: 'Classic',
    slug: 'classic',
    orientation: 'portrait' as const,
    layoutPath: 'templates/classic.png',
    layoutUrl: '/storage/templates/classic.png',
    thumbnailPath: 'templates/thumbnails/classic.png',
    thumbnailUrl: '/storage/templates/thumbnails/classic.png',
    photoSlots: 3,
    layoutConfig: {
        slots: [
            {
                slot: 1,
                x: 0,
                y: 0,
                width: 100,
                height: 50,
            },
            {
                slot: 2,
                x: 0,
                y: 50,
                width: 100,
                height: 50,
            },
            {
                slot: 3,
                x: 0,
                y: 100,
                width: 100,
                height: 50,
            },
        ],
    },
    printWidthMm: 100,
    printHeightMm: 150,
    active: false,
    sortOrder: 2,
    printerCompatibility: null,
    createdAt: '2026-08-18T08:00:00+00:00',
    updatedAt: '2026-08-24T08:00:00+00:00',
};

beforeEach(() => {
    formErrors.current = {};

    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn((file: File) => `blob:${encodeURIComponent(file.name)}`),
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: vi.fn(),
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: vi.fn(() => null),
    });
});

describe('visual slot geometry helpers', () => {
    it('builds normalized geometry regardless of drag direction', () => {
        expect(
            normalizedRectangleFromPoints(
                { x: 0.75, y: 0.8 },
                { x: 0.25, y: 0.2 },
            ),
        ).toEqual({
            x: 0.25,
            y: 0.2,
            width: 0.5,
            height: 0.6000000000000001,
        });
    });

    it('converts normalized image geometry into whole millimeter values', () => {
        expect(
            normalizedRectangleToMillimeters(
                {
                    x: 0.1,
                    y: 0.2,
                    width: 0.5,
                    height: 0.4,
                },
                100,
                150,
            ),
        ).toEqual({
            x: 10,
            y: 30,
            width: 50,
            height: 60,
        });
    });

    it('clamps converted geometry inside the print area', () => {
        expect(
            normalizedRectangleToMillimeters(
                {
                    x: 0.95,
                    y: 0.95,
                    width: 0.2,
                    height: 0.2,
                },
                100,
                150,
            ),
        ).toEqual({
            x: 95,
            y: 143,
            width: 5,
            height: 7,
        });
    });

    it('detects a bounded connected transparent cutout', () => {
        const transparentPixels: Array<[number, number]> = [];

        for (let y = 3; y <= 6; y += 1) {
            for (let x = 2; x <= 5; x += 1) {
                transparentPixels.push([x, y]);
            }
        }

        const imageData = makeTransparencyImage(10, 10, transparentPixels);

        expect(detectBoundedTransparentRegion(imageData, 3, 4)).toEqual({
            x: 0.2,
            y: 0.3,
            width: 0.4,
            height: 0.4,
        });
    });

    it('rejects transparent regions connected to an image edge', () => {
        const imageData = makeTransparencyImage(6, 6, [
            [0, 2],
            [1, 2],
            [2, 2],
            [2, 3],
        ]);

        expect(detectBoundedTransparentRegion(imageData, 2, 2)).toBeNull();
    });

    it('rejects clicks on opaque image pixels', () => {
        const imageData = makeTransparencyImage(6, 6, [[3, 3]]);

        expect(detectBoundedTransparentRegion(imageData, 1, 1)).toBeNull();
    });
});

describe('template form browser payload contract', () => {
    it('submits one explicit Laravel boolean value for active', () => {
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        expect(
            container.querySelector('input[type="hidden"][name="active"]'),
        ).toHaveAttribute('value', '1');
    });

    it('preserves an inactive template state on edit', () => {
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(
            container.querySelector('input[type="hidden"][name="active"]'),
        ).toHaveAttribute('value', '0');
    });

    it('requires the layout asset only when creating a template', () => {
        const { unmount } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        expect(screen.getByLabelText(/^Layout Asset/)).toBeRequired();

        unmount();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(screen.getByLabelText(/^Layout Asset/)).not.toBeRequired();
    });

    it('renders usable links for current stored assets', () => {
        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(
            screen.getByRole('link', {
                name: /View current layout asset/i,
            }),
        ).toHaveAttribute('href', existingTemplate.layoutUrl);

        expect(
            screen.getByRole('link', {
                name: /View current template thumbnail/i,
            }),
        ).toHaveAttribute('href', existingTemplate.thumbnailUrl);
    });

    it('keeps photo_slots derived from the canonical layout state', () => {
        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveValue(3);

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveAttribute(
            'readonly',
        );
    });

    it('applies valid advanced JSON back into canonical visual slot state', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: /Advanced JSON Configuration/i,
            }),
        );

        const json = JSON.stringify({
            slots: [
                {
                    slot: 1,
                    x: 0,
                    y: 0,
                    width: 50,
                    height: 75,
                },
                {
                    slot: 2,
                    x: 50,
                    y: 75,
                    width: 50,
                    height: 75,
                },
            ],
        });

        fireEvent.change(screen.getByLabelText('Layout configuration JSON'), {
            target: { value: json },
        });

        await user.click(
            screen.getByRole('button', {
                name: 'Apply JSON',
            }),
        );

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveValue(2);

        const layout = readLayoutConfig(container);

        expect(layout.slots).toHaveLength(2);
    });

    it('does not replace canonical layout state when advanced JSON is malformed', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: /Advanced JSON Configuration/i,
            }),
        );

        fireEvent.change(screen.getByLabelText('Layout configuration JSON'), {
            target: {
                value: '{invalid-json}',
            },
        });

        await user.click(
            screen.getByRole('button', {
                name: 'Apply JSON',
            }),
        );

        expect(
            screen.getByText('Layout JSON must be valid JSON.'),
        ).toHaveAttribute('role', 'alert');

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveValue(1);
    });
});

describe('visual template slot workflow', () => {
    it('keeps visual selection disabled until the layout image is available', () => {
        render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Add Photo Slot',
            }),
        ).toBeDisabled();

        expect(
            screen.getByText('Upload a layout asset first'),
        ).toBeInTheDocument();
    });

    it('enables visual selection for a newly uploaded layout without changing its form field contract', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        const file = new File(['layout'], 'new-layout.png', {
            type: 'image/png',
        });

        await user.upload(screen.getByLabelText(/^Layout Asset/), file);

        expect(screen.getByAltText('Layout Asset preview')).toHaveAttribute(
            'src',
            'blob:new-layout.png',
        );

        expect(
            screen.getByAltText('Interactive layout editor'),
        ).toHaveAttribute('src', 'blob:new-layout.png');

        expect(screen.getByLabelText(/^Layout Asset/)).toHaveAttribute(
            'name',
            'layout',
        );

        loadInteractiveLayoutImage();

        expect(
            screen.getByRole('button', {
                name: 'Add Photo Slot',
            }),
        ).toBeEnabled();
    });

    it('adds a new slot from pointer-drawn normalized geometry and synchronizes photo_slots', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        loadInteractiveLayoutImage();

        await user.click(
            screen.getByRole('button', {
                name: 'Add Photo Slot',
            }),
        );

        const surface = prepareSelectionSurface();

        fireEvent.pointerDown(surface, {
            clientX: 20,
            clientY: 30,
            pointerId: 1,
        });

        fireEvent.pointerMove(surface, {
            clientX: 120,
            clientY: 150,
            pointerId: 1,
        });

        fireEvent.pointerUp(surface, {
            clientX: 120,
            clientY: 150,
            pointerId: 1,
        });

        const layout = readLayoutConfig(container);

        expect(layout.slots).toHaveLength(4);
        expect(layout.slots[3]).toEqual({
            slot: 4,
            x: 10,
            y: 15,
            width: 50,
            height: 60,
        });

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveValue(4);

        expect(screen.getByTestId('visual-slot-overlay-4')).toBeInTheDocument();

        expect(screen.getByTestId('live-preview-slot-4')).toBeInTheDocument();
    });

    it('replaces an existing slot without changing the slot count', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        loadInteractiveLayoutImage();

        await user.click(
            screen.getByRole('button', {
                name: 'Slot 2',
            }),
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Reselect Slot 2',
            }),
        );

        const surface = prepareSelectionSurface();

        fireEvent.pointerDown(surface, {
            clientX: 20,
            clientY: 60,
            pointerId: 2,
        });

        fireEvent.pointerMove(surface, {
            clientX: 120,
            clientY: 180,
            pointerId: 2,
        });

        fireEvent.pointerUp(surface, {
            clientX: 120,
            clientY: 180,
            pointerId: 2,
        });

        const layout = readLayoutConfig(container);

        expect(layout.slots).toHaveLength(3);
        expect(layout.slots[1]).toEqual({
            slot: 2,
            x: 10,
            y: 30,
            width: 50,
            height: 60,
        });

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveValue(3);
    });

    it('does not replace canonical geometry when a pointer selection is too small', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        const before = readLayoutConfig(container);

        loadInteractiveLayoutImage();

        await user.click(
            screen.getByRole('button', {
                name: 'Reselect Slot 1',
            }),
        );

        const surface = prepareSelectionSurface();

        fireEvent.pointerDown(surface, {
            clientX: 50,
            clientY: 50,
            pointerId: 3,
        });

        fireEvent.pointerUp(surface, {
            clientX: 50,
            clientY: 50,
            pointerId: 3,
        });

        expect(readLayoutConfig(container)).toEqual(before);

        expect(
            screen.getByText(
                'Drag a larger rectangle to define the photo slot.',
            ),
        ).toBeInTheDocument();
    });

    it('updates canonical state and live preview immediately from manual slot details without submitting', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: /Slot details/i,
            }),
        );

        fireEvent.change(screen.getByLabelText('Slot 1 width in millimeters'), {
            target: { value: '80' },
        });

        const layout = readLayoutConfig(container);

        expect(layout.slots[0].width).toBe(80);

        expect(screen.getByTestId('live-preview-slot-1')).toHaveStyle({
            width: '80%',
        });
    });

    it('removes the selected slot while preserving sequential canonical numbering', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Slot 2',
            }),
        );

        await user.click(
            screen.getByRole('button', {
                name: /Slot details/i,
            }),
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Remove Slot 2',
            }),
        );

        const layout = readLayoutConfig(container);

        expect(layout.slots).toHaveLength(2);
        expect(layout.slots.map((slot) => slot.slot)).toEqual([1, 2]);

        expect(screen.getByLabelText(/^Photo Slots/)).toHaveValue(2);
    });
});

describe('template form edit presentation', () => {
    it('renders the live summary and truthful persisted metadata', () => {
        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        const summaryHeading = screen.getByText('Template Summary');
        const summaryCard = summaryHeading.closest('[data-slot="card"]');

        expect(summaryCard).not.toBeNull();

        expect(
            within(summaryCard as HTMLElement).getByText('100 mm × 150 mm'),
        ).toBeInTheDocument();

        expect(
            within(summaryCard as HTMLElement).getByText('Inactive'),
        ).toBeInTheDocument();

        expect(screen.getByText('Template Metadata')).toBeInTheDocument();
    });

    it('uses the existing Wayfinder destroy form inside the confirmation dialog', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Delete Template',
            }),
        );

        expect(
            screen.getByRole('heading', {
                name: 'Delete template?',
            }),
        ).toBeInTheDocument();

        const deleteForm = document.querySelector(
            'form[action="/admin/templates/42?_method=DELETE"]',
        );

        expect(deleteForm).not.toBeNull();
        expect(deleteForm).toHaveAttribute('method', 'post');
    });
});

describe('template form accessibility', () => {
    it('associates a validation error with its field via aria-describedby', () => {
        formErrors.current = {
            name: 'The name field is required.',
        };

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates',
                    method: 'post',
                }}
            />,
        );

        const nameInput = screen.getByLabelText(/^Template Name/);

        expect(nameInput).toHaveAttribute('aria-invalid', 'true');

        expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');

        const message = screen.getByText('The name field is required.');

        expect(message).toHaveAttribute('id', 'name-error');

        expect(message).toHaveAttribute('role', 'alert');
    });

    it('retains keyboard-accessible numeric slot controls as a secondary editing path', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: /Slot details/i,
            }),
        );

        expect(
            screen.getByLabelText('Slot 1 x in millimeters'),
        ).toBeInTheDocument();

        expect(
            screen.getByLabelText('Slot 1 y in millimeters'),
        ).toBeInTheDocument();

        expect(
            screen.getByLabelText('Slot 1 width in millimeters'),
        ).toBeInTheDocument();

        expect(
            screen.getByLabelText('Slot 1 height in millimeters'),
        ).toBeInTheDocument();
    });
});
