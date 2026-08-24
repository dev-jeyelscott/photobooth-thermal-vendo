import { Head, setLayoutProps } from '@inertiajs/react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import { create, index } from '@/routes/admin/templates';
import TemplateForm from './template-form';

/**
 * Render the template creation page inside the resolver-owned admin layout.
 */
export default function TemplatesCreate() {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Templates', href: index() },
            { title: 'Create', href: create() },
        ],
    });

    return (
        <>
            <Head title="Create Template" />
            <TemplateForm form={TemplateController.store.form()} />
        </>
    );
}
