import { Form, Head, setLayoutProps } from '@inertiajs/react';
import { Banknote, CircleCheck, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { range as rangeReport } from '@/routes/admin/reports';
import {
    buildReportExportHref,
    buildReportNavigationLinks,
    formatReportCurrency,
    formatReportDate,
    IssueSummaryCard,
    ReportFilterPanel,
    ReportMetricCard,
    ReportShell,
} from './report-ui';

type RangeReportData = {
    revenue: string;
    successfulPayments: number;
    failedPayments: number;
    completedSessions: number;
    voucherSessions: number;
    failedPrintJobs: number;
};

/**
 * Renders the sales and operations report for an arbitrary date range.
 */
export default function RangeReport({
    start,
    end,
    report,
}: {
    start: string;
    end: string;
    report: RangeReportData;
}) {
    setLayoutProps({
        breadcrumbs: [{ title: 'Reports', href: rangeReport() }],
    });

    const [year, month] = start.split('-').map(Number);

    const links = buildReportNavigationLinks({
        dailyDate: start,
        monthlyYear: year,
        monthlyMonth: month,
        rangeStart: start,
        rangeEnd: end,
    });

    const exportHref = buildReportExportHref(start, end);

    return (
        <>
            <Head title="Date range report" />

            <ReportShell
                active="range"
                links={links}
                periodLabel={`Reporting period: ${formatReportDate(start)} to ${formatReportDate(end)}`}
                exportHref={exportHref}
            >
                <ReportFilterPanel>
                    <Form
                        action={rangeReport.url()}
                        method="get"
                        options={{
                            preserveState: true,
                            replace: true,
                        }}
                        className="flex flex-col gap-3 lg:flex-row lg:items-end"
                    >
                        {() => (
                            <>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="range-report-start">
                                        Start date
                                    </Label>
                                    <Input
                                        id="range-report-start"
                                        type="date"
                                        name="start"
                                        defaultValue={start}
                                        className="sm:w-56"
                                    />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="range-report-end">
                                        End date
                                    </Label>
                                    <Input
                                        id="range-report-end"
                                        type="date"
                                        name="end"
                                        defaultValue={end}
                                        className="sm:w-56"
                                    />
                                </div>

                                <Button type="submit">View report</Button>
                            </>
                        )}
                    </Form>
                </ReportFilterPanel>

                <section
                    aria-labelledby="range-summary-heading"
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                    <h2 id="range-summary-heading" className="sr-only">
                        Date range report summary
                    </h2>

                    <ReportMetricCard
                        label="Revenue"
                        value={formatReportCurrency(report.revenue)}
                        icon={Banknote}
                        tone="success"
                    />

                    <ReportMetricCard
                        label="Completed sessions"
                        value={String(report.completedSessions)}
                        icon={CircleCheck}
                        tone="info"
                    />

                    <ReportMetricCard
                        label="Successful payments"
                        value={String(report.successfulPayments)}
                        icon={CircleCheck}
                        tone="success"
                    />
                </section>

                <section
                    aria-label="Date range operational insights"
                    className="grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"
                >
                    <ReportMetricCard
                        label="Voucher sessions"
                        value={String(report.voucherSessions)}
                        icon={Ticket}
                        tone="warning"
                    />

                    <IssueSummaryCard
                        firstLabel="Failed payments"
                        firstValue={report.failedPayments}
                        secondLabel="Failed print jobs"
                        secondValue={report.failedPrintJobs}
                    />
                </section>
            </ReportShell>
        </>
    );
}
