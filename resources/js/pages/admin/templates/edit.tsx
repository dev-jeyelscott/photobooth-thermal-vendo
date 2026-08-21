import { Head, setLayoutProps } from '@inertiajs/react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import Heading from '@/components/heading';
import { index } from '@/routes/admin/templates';
import TemplateForm from './template-form';

type Template = {
    id: number;
    name: string;
    layoutPath: string;
    thumbnailPath: string | null;
    photoSlots: number;
    printWidthMm: number;
    printHeightMm: number;
    active: boolean;
};

export default function TemplatesEdit({ template }: { template: Template }) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Templates', href: index() },
            {
                title: template.name,
                href: TemplateController.edit(template.id).url,
            },
        ],
    });

    return (
        <>
            <Head title={`Edit ${template.name}`} />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Edit template"
                    description="Update the template's details and assets"
                />

                <TemplateForm
                    form={TemplateController.update.form(template.id)}
                    template={template}
                />
            </div>
        </>
    );
}
