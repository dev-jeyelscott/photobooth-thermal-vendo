import { describe, expect, it } from 'vitest';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import { create, index, reorder } from '@/routes/admin/templates';

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

describe('template management Wayfinder contract', () => {
    it('maps navigation and CRUD forms to the admin template routes', () => {
        expect(index()).toMatchObject({
            url: '/admin/templates',
            method: 'get',
        });
        expect(create()).toMatchObject({
            url: '/admin/templates/create',
            method: 'get',
        });
        expect(TemplateController.edit(42)).toMatchObject({
            url: '/admin/templates/42/edit',
            method: 'get',
        });
        expect(reorder()).toMatchObject({
            url: '/admin/templates/reorder',
            method: 'patch',
        });

        expect(TemplateController.store.form()).toEqual({
            action: '/admin/templates',
            method: 'post',
        });

        expectSpoofedForm(
            TemplateController.update.form(42),
            '/admin/templates/42',
            ['put', 'patch'],
        );
        expectSpoofedForm(
            TemplateController.destroy.form(42),
            '/admin/templates/42',
            ['delete'],
        );
        expectSpoofedForm(
            TemplateController.toggle.form(42),
            '/admin/templates/42/toggle',
            ['patch'],
        );
    });
});
