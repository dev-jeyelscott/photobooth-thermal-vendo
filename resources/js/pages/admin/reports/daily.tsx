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
import { daily as dailyReport } from '@/routes/admin/reports';

type DailyReport = {
    grossSales: string;
    successfulSessions: number;
    paidSessions: number;
    voucherSessions: number;
    failedPayments: number;
    averageTransactionValue: string;
};

export default function DailyReport({
    date,
    report,
}: {
    date: string;
    report: DailyReport;
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Daily sales report', href: dailyReport() }],
    });

    return (
        <>
            <Head title="Daily sales report" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Daily sales report"
                    description="Sales and session totals for a selected day"
                />

                <Form
                    action={dailyReport.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                    className="flex flex-wrap items-end gap-3"
                >
                    {() => (
                        <>
                            <label className="flex flex-col gap-1 text-sm">
                                Date
                                <Input
                                    type="date"
                                    name="date"
                                    defaultValue={date}
                                />
                            </label>

                            <Button type="submit">View</Button>
                        </>
                    )}
                </Form>

                <div className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardDescription>Gross sales</CardDescription>
                            <CardTitle className="text-3xl">
                                ₱{report.grossSales}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Successful sessions
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {report.successfulSessions}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Average transaction value
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                ₱{report.averageTransactionValue}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Paid sessions</CardDescription>
                            <CardTitle className="text-3xl">
                                {report.paidSessions}
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
                            <CardDescription>Failed payments</CardDescription>
                            <CardTitle className="text-3xl">
                                {report.failedPayments}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        </>
    );
}
