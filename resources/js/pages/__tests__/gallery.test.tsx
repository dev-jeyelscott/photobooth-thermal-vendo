import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Gallery from '@/pages/gallery';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
}));

describe('customer gallery page', () => {
    it('renders all generated outputs with their existing download contracts', () => {
        render(
            <Gallery
                colorUrl="/storage/gallery/color.jpg"
                bwUrl="/storage/gallery/bw.jpg"
                gifUrl="/storage/gallery/animation.gif"
                expiresAt="2026-08-27T13:49:00+08:00"
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Your photos',
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('Color photo')).toBeInTheDocument();
        expect(screen.getByText('Black & white')).toBeInTheDocument();
        expect(screen.getByText('Animated GIF')).toBeInTheDocument();

        expect(screen.getAllByTestId('gallery-asset')).toHaveLength(3);

        const downloads = screen.getAllByRole('link', {
            name: 'Download',
        });

        expect(downloads).toHaveLength(3);

        expect(downloads[0]).toHaveAttribute(
            'href',
            '/storage/gallery/color.jpg',
        );
        expect(downloads[0]).toHaveAttribute('download', 'photo-color.jpg');

        expect(downloads[1]).toHaveAttribute('href', '/storage/gallery/bw.jpg');
        expect(downloads[1]).toHaveAttribute('download', 'photo-bw.jpg');

        expect(downloads[2]).toHaveAttribute(
            'href',
            '/storage/gallery/animation.gif',
        );
        expect(downloads[2]).toHaveAttribute('download', 'photo-animation.gif');

        expect(screen.getByTestId('gallery-expires-at')).toHaveTextContent(
            'Available until',
        );
    });

    it('renders only media that actually exists', () => {
        render(
            <Gallery
                colorUrl="/storage/gallery/color.jpg"
                bwUrl={null}
                gifUrl={null}
            />,
        );

        expect(screen.getAllByTestId('gallery-asset')).toHaveLength(1);
        expect(screen.getByText('Color photo')).toBeInTheDocument();
        expect(screen.queryByText('Black & white')).not.toBeInTheDocument();
        expect(screen.queryByText('Animated GIF')).not.toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: 'Download',
            }),
        ).toHaveAttribute('download', 'photo-color.jpg');
    });

    it('renders the empty gallery state when no media is available yet', () => {
        render(<Gallery colorUrl={null} bwUrl={null} gifUrl={null} />);

        expect(screen.getByTestId('gallery-empty')).toHaveTextContent(
            'No photos are available for this gallery yet.',
        );

        expect(
            screen.queryByRole('link', {
                name: 'Download',
            }),
        ).not.toBeInTheDocument();
    });

    it('never renders stale media URLs when the gallery is expired', () => {
        render(
            <Gallery
                colorUrl="/storage/gallery/stale-color.jpg"
                bwUrl="/storage/gallery/stale-bw.jpg"
                gifUrl="/storage/gallery/stale-animation.gif"
                expired
                expiresAt="2026-08-23T13:49:00+08:00"
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'This gallery has expired',
            }),
        ).toBeInTheDocument();

        expect(screen.getByTestId('gallery-expired')).toBeInTheDocument();
        expect(screen.queryAllByTestId('gallery-asset')).toHaveLength(0);

        expect(
            screen.queryByRole('link', {
                name: 'Download',
            }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText('/storage/gallery/stale-color.jpg'),
        ).not.toBeInTheDocument();
    });

    it('remains free of authenticated administration navigation', () => {
        render(
            <Gallery
                colorUrl="/storage/gallery/color.jpg"
                bwUrl={null}
                gifUrl={null}
            />,
        );

        expect(
            screen.queryByRole('link', {
                name: /dashboard/i,
            }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole('navigation', {
                name: /admin/i,
            }),
        ).not.toBeInTheDocument();
    });
});
