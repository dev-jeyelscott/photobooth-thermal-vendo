import { Head } from '@inertiajs/react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';

type SessionStats = {
    count: number;
    salesTotal: string;
};

type Summary = {
    today: SessionStats;
    thisMonth: SessionStats;
    failedPayments: number;
    failedPrintJobs: number;
};

export default function Dashboard({ summary }: { summary: Summary }) {
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
                </div>
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
