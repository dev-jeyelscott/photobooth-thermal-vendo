import { Form, Head, setLayoutProps } from '@inertiajs/react';
import { Banknote, CircleCheck, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { daily as dailyReport } from '@/routes/admin/reports';
import {
    buildReportExportHref,
    buildReportNavigationLinks,
    formatReportCurrency,
    formatReportDate,
    HealthSummaryCard,
    PaymentMixCard,
    ReportFilterPanel,
    ReportMetricCard,
    ReportShell,
} from './report-ui';

type DailyReportData = {
    grossSales: string;
    successfulSessions: number;
    paidSessions: number;
    voucherSessions: number;
    failedPayments: number;
    averageTransactionValue: string;
};

/**
 * Renders the operationally focused daily sales report.
 */
export default function DailyReport({
    date,
    report,
}: {
    date: string;
    report: DailyReportData;
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Reports', href: dailyReport() }],
    });

    const [year, month] = date.split('-').map(Number);

    const links = buildReportNavigationLinks({
        dailyDate: date,
        monthlyYear: year,
        monthlyMonth: month,
        rangeStart: date,
        rangeEnd: date,
    });

    const exportHref = buildReportExportHref(date, date);

    const healthMessage =
        report.failedPayments > 0
            ? `${report.failedPayments} failed payment${report.failedPayments === 1 ? '' : 's'} need review.`
            : 'No failed payments were recorded for this day.';

    return (
        <>
            <Head title="Daily report" />

            <ReportShell
                active="daily"
                links={links}
                periodLabel={`Reporting period: ${formatReportDate(date)}`}
                exportHref={exportHref}
            >
                <ReportFilterPanel>
                    <Form
                        action={dailyReport.url()}
                        method="get"
                        options={{
                            preserveState: true,
                            replace: true,
                        }}
                        className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    >
                        {() => (
                            <>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="daily-report-date">
                                        Date
                                    </Label>
                                    <Input
                                        id="daily-report-date"
                                        type="date"
                                        name="date"
                                        defaultValue={date}
                                        className="sm:w-56"
                                    />
                                </div>

                                <Button type="submit">View report</Button>
                            </>
                        )}
                    </Form>
                </ReportFilterPanel>

                <section
                    aria-labelledby="daily-summary-heading"
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                    <h2 id="daily-summary-heading" className="sr-only">
                        Daily report summary
                    </h2>

                    <ReportMetricCard
                        label="Gross sales"
                        value={formatReportCurrency(report.grossSales)}
                        icon={Banknote}
                        tone="success"
                    />

                    <ReportMetricCard
                        label="Successful sessions"
                        value={String(report.successfulSessions)}
                        icon={CircleCheck}
                        tone="info"
                    />

                    <ReportMetricCard
                        label="Average transaction value"
                        value={formatReportCurrency(
                            report.averageTransactionValue,
                        )}
                        icon={ReceiptText}
                        tone="warning"
                    />
                </section>

                <section
                    aria-label="Daily payment and transaction insights"
                    className="grid gap-4 xl:grid-cols-2"
                >
                    <PaymentMixCard
                        mayaSessions={report.paidSessions}
                        voucherSessions={report.voucherSessions}
                    />

                    <HealthSummaryCard
                        title="Transaction health"
                        description="Successful sessions and recorded payment failures"
                        healthyLabel="Successful sessions"
                        healthyValue={report.successfulSessions}
                        issueLabel="Failed payments"
                        issueValue={report.failedPayments}
                        message={healthMessage}
                    />
                </section>
            </ReportShell>
        </>
    );
}
