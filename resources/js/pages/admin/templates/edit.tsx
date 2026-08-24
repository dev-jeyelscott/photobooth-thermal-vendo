import { Head, setLayoutProps } from '@inertiajs/react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import { index } from '@/routes/admin/templates';
import TemplateForm from './template-form';
import type { Template } from './template-form';

/**
 * Render the template editing page inside the resolver-owned admin layout.
 */
export default function TemplatesEdit({ template }: { template: Template }) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Templates', href: index() },
            {
                title: 'Edit',
                href: TemplateController.edit(template.id).url,
            },
        ],
    });

    return (
        <>
            <Head title={`Edit ${template.name}`} />
            <TemplateForm
                form={TemplateController.update.form(template.id)}
                template={template}
            />
        </>
    );
}
