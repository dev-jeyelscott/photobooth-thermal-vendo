import { describe, expect, it } from 'vitest';

const adminPageSources = import.meta.glob('../**/*.tsx', {
    eager: true,
    import: 'default',
    query: '?raw',
}) as Record<string, string>;

describe('admin page composition', () => {
    it('leaves the shared application shell to the global Inertia layout', () => {
        expect(Object.keys(adminPageSources)).not.toHaveLength(0);

        for (const source of Object.values(adminPageSources)) {
            expect(source).not.toContain('@/layouts/app-layout');
        }
    });
});
