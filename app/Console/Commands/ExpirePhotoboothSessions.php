<?php

namespace App\Console\Commands;

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use Illuminate\Console\Command;

class ExpirePhotoboothSessions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'photobooth:expire-sessions';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mark past-due photobooth sessions as expired';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $expired = PhotoboothSession::query()
            ->whereNotIn('status', [
                PhotoboothSessionStatus::Completed,
                PhotoboothSessionStatus::Expired,
                PhotoboothSessionStatus::Abandoned,
            ])
            ->where('expires_at', '<', now())
            ->update(['status' => PhotoboothSessionStatus::Expired]);

        $this->info("Expired {$expired} photobooth session(s).");

        return self::SUCCESS;
    }
}
