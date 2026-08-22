import { Form, Head, setLayoutProps } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { range as rangeReport } from '@/routes/admin/reports';

type RangeReport = {
    revenue: string;
    successfulPayments: number;
    failedPayments: number;
    completedSessions: number;
    voucherSessions: number;
    failedPrintJobs: number;
};

export default function RangeReport({
    start,
    end,
    report,
}: {
    start: string;
    end: string;
    report: RangeReport;
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Date range report', href: rangeReport() }],
    });

    return (
        <>
            <Head title="Date range report" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Date range report"
                    description="Sales and session totals for a selected date range"
                />

                <Form
                    action={rangeReport.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                    className="flex flex-wrap items-end gap-3"
                >
                    {() => (
                        <>
                            <label className="flex flex-col gap-1 text-sm">
                                Start date
                                <Input
                                    type="date"
                                    name="start"
                                    defaultValue={start}
                                />
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                                End date
                                <Input
                                    type="date"
                                    name="end"
                                    defaultValue={end}
                                />
                            </label>

                            <Button type="submit">View</Button>
                        </>
                    )}
                </Form>

                <div className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardDescription>Revenue</CardDescription>
                            <CardTitle className="text-3xl">
                                ₱{report.revenue}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Successful payments
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {report.successfulPayments}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Failed payments</CardDescription>
                            <CardTitle className="text-3xl">
                                {report.failedPayments}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Completed sessions
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {report.completedSessions}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Voucher sessions</CardDescription>
                            <CardTitle className="text-3xl">
                                {report.voucherSessions}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Failed print jobs</CardDescription>
                            <CardTitle className="text-3xl">
                                {report.failedPrintJobs}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        </>
    );
}
