<?php

namespace App\Console\Commands;

use App\Enums\PrintJobStatus;
use App\Jobs\ProcessPrintJob;
use App\Models\PrintJob;
use Illuminate\Console\Command;

class RetryPrintJob extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'print-jobs:retry {printJob : The ID of the failed PrintJob to retry}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Re-queue a failed print job for another print attempt';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $printJob = PrintJob::find($this->argument('printJob'));

        if ($printJob === null) {
            $this->error('Print job not found.');

            return self::FAILURE;
        }

        if ($printJob->status !== PrintJobStatus::Failed) {
            $this->error("Print job #{$printJob->id} is not in a failed state.");

            return self::FAILURE;
        }

        ProcessPrintJob::dispatch($printJob);

        $this->info("Re-queued print job #{$printJob->id} for retry.");

        return self::SUCCESS;
    }
}
