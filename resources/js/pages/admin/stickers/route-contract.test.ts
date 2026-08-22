import { describe, expect, it } from 'vitest';
import StickerController from '@/actions/App/Http/Controllers/Admin/StickerController';
import { create, index, reorder } from '@/routes/admin/stickers';

/**
 * Verifies that a generated Wayfinder form uses POST plus Laravel method spoofing.
 */
function expectSpoofedForm(
    form: { action: string; method: string },
    expectedPath: string,
    expectedMethods: string[],
) {
    expect(form.method).toBe('post');

    const [path, query = ''] = form.action.split('?');
    const spoofedMethod = new URLSearchParams(query)
        .get('_method')
        ?.toLowerCase();

    expect(path).toBe(expectedPath);
    expect(expectedMethods).toContain(spoofedMethod);
}

describe('sticker management Wayfinder contract', () => {
    it('maps navigation and CRUD forms to the admin sticker routes', () => {
        expect(index()).toMatchObject({
            url: '/admin/stickers',
            method: 'get',
        });

        expect(create()).toMatchObject({
            url: '/admin/stickers/create',
            method: 'get',
        });

        expect(StickerController.edit(42)).toMatchObject({
            url: '/admin/stickers/42/edit',
            method: 'get',
        });

        expect(reorder()).toMatchObject({
            url: '/admin/stickers/reorder',
            method: 'patch',
        });

        expect(StickerController.store.form()).toEqual({
            action: '/admin/stickers',
            method: 'post',
        });

        expectSpoofedForm(
            StickerController.update.form(42),
            '/admin/stickers/42',
            ['put', 'patch'],
        );

        expectSpoofedForm(
            StickerController.destroy.form(42),
            '/admin/stickers/42',
            ['delete'],
        );

        expectSpoofedForm(
            StickerController.toggle.form(42),
            '/admin/stickers/42/toggle',
            ['patch'],
        );
    });
});
