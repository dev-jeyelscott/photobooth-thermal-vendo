import { Head } from '@inertiajs/react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes/admin';

type SessionStats = {
    count: number;
    salesTotal: string;
};

type Summary = {
    today: SessionStats;
    thisMonth: SessionStats;
    failedPayments: number;
    failedPrintJobs: number;
    pendingPayments: number;
};

type ActivityEntry = {
    type: string;
    label: string;
    occurredAt: string | null;
};

export default function Dashboard({
    summary,
    recentActivity,
}: {
    summary: Summary;
    recentActivity: ActivityEntry[];
}) {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Sessions completed today
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.today.count}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                ₱{summary.today.salesTotal} in sales
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Sessions completed this month
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.thisMonth.count}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                ₱{summary.thisMonth.salesTotal} in sales
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Failed payments</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.failedPayments}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Failed print jobs</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.failedPrintJobs}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Pending payments</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.pendingPayments}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Recent activity</CardTitle>
                        <CardDescription>
                            Latest sessions, payments, voucher redemptions, and
                            print failures
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentActivity.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No recent activity.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {recentActivity.map((entry, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center justify-between border-b pb-2 text-sm last:border-b-0 last:pb-0"
                                    >
                                        <span>{entry.label}</span>
                                        {entry.occurredAt && (
                                            <span className="text-muted-foreground">
                                                {new Date(
                                                    entry.occurredAt,
                                                ).toLocaleString()}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
