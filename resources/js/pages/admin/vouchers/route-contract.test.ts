import { describe, expect, it } from 'vitest';
import VoucherController from '@/actions/App/Http/Controllers/Admin/VoucherController';
import { create, index } from '@/routes/admin/vouchers';

/**
 * Assert that a Wayfinder form uses browser-compatible POST method spoofing.
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

describe('voucher management Wayfinder contract', () => {
    it('maps navigation and CRUD forms to the admin voucher routes', () => {
        expect(index()).toMatchObject({
            url: '/admin/vouchers',
            method: 'get',
        });

        expect(create()).toMatchObject({
            url: '/admin/vouchers/create',
            method: 'get',
        });

        expect(VoucherController.edit(42)).toMatchObject({
            url: '/admin/vouchers/42/edit',
            method: 'get',
        });

        expect(VoucherController.store.form()).toEqual({
            action: '/admin/vouchers',
            method: 'post',
        });

        expectSpoofedForm(
            VoucherController.update.form(42),
            '/admin/vouchers/42',
            ['put', 'patch'],
        );

        expectSpoofedForm(
            VoucherController.destroy.form(42),
            '/admin/vouchers/42',
            ['delete'],
        );

        expectSpoofedForm(
            VoucherController.toggle.form(42),
            '/admin/vouchers/42/toggle',
            ['patch'],
        );
    });
});
