import { Head, setLayoutProps } from '@inertiajs/react';
import TemplateController from '@/actions/App/Http/Controllers/Admin/TemplateController';
import Heading from '@/components/heading';
import { create, index } from '@/routes/admin/templates';
import TemplateForm from './template-form';

export default function TemplatesCreate() {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Templates', href: index() },
            { title: 'New template', href: create() },
        ],
    });

    return (
        <>
            <Head title="New template" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="New template"
                    description="Add a photo template for the kiosk"
                />

                <TemplateForm form={TemplateController.store.form()} />
            </div>
        </>
    );
}
