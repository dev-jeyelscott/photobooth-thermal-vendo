<?php

namespace App\Console\Commands;

use App\Models\CapturedMedia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneExpiredMedia extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'media:prune-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete expired captured media files from storage and clear their records';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $expiredMedia = CapturedMedia::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->get();

        foreach ($expiredMedia as $capturedMedia) {
            foreach ([$capturedMedia->color_path, $capturedMedia->bw_path, $capturedMedia->gif_path] as $path) {
                if ($path !== null) {
                    Storage::disk('public')->delete($path);
                }
            }

            $capturedMedia->delete();
        }

        $this->info("Pruned {$expiredMedia->count()} expired media record(s).");

        return self::SUCCESS;
    }
}
