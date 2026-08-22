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
import { monthly as monthlyReport } from '@/routes/admin/reports';

type DailyBreakdownRow = {
    date: string;
    grossSales: string;
    successfulSessions: number;
};

type MonthlyReport = {
    grossSales: string;
    successfulSessions: number;
    paidSessions: number;
    voucherSessions: number;
    voucherRedemptions: number;
    printedJobs: number;
    failedPrintJobs: number;
    dailyBreakdown: DailyBreakdownRow[];
};

export default function MonthlyReport({
    year,
    month,
    report,
}: {
    year: number;
    month: number;
    report: MonthlyReport;
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Monthly sales report', href: monthlyReport() }],
    });

    const monthValue = `${year}-${String(month).padStart(2, '0')}`;

    return (
        <>
            <Head title="Monthly sales report" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Monthly sales report"
                    description="Sales and session totals for a selected month"
                />

                <Form
                    action={monthlyReport.url()}
                    method="get"
                    options={{ preserveState: true, replace: true }}
                    transform={(data) => {
                        const [selectedYear, selectedMonth] = String(
                            data.month,
                        ).split('-');

                        return {
                            year: selectedYear,
                            month: selectedMonth,
                        };
                    }}
                    className="flex flex-wrap items-end gap-3"
                >
                    {() => (
                        <>
                            <label className="flex flex-col gap-1 text-sm">
                                Month
                                <Input
                                    type="month"
                                    name="month"
                                    defaultValue={monthValue}
                                />
                            </label>

                            <Button type="submit">View</Button>
                        </>
                    )}
                </Form>

                <div className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                            <CardDescription>Maya sessions</CardDescription>
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
                            <CardDescription>
                                Voucher redemptions
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {report.voucherRedemptions}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Printed jobs</CardDescription>
                            <CardTitle className="text-3xl">
                                {report.printedJobs}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Failed print jobs
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {report.failedPrintJobs}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                            <tr>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">
                                    Successful sessions
                                </th>
                                <th className="p-3 font-medium">
                                    Gross sales
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.dailyBreakdown.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="p-3 text-center text-muted-foreground"
                                    >
                                        No activity for this month.
                                    </td>
                                </tr>
                            )}

                            {report.dailyBreakdown.map((row) => (
                                <tr
                                    key={row.date}
                                    className="border-t border-sidebar-border/70 dark:border-sidebar-border"
                                >
                                    <td className="p-3">{row.date}</td>
                                    <td className="p-3">
                                        {row.successfulSessions}
                                    </td>
                                    <td className="p-3">
                                        ₱{row.grossSales}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
