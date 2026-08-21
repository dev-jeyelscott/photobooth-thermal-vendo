<?php

namespace App\Console\Commands;

use App\Models\CapturedMedia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

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
    protected $description = 'Delete expired captured media files from storage while preserving their records';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $expiredMedia = CapturedMedia::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->get();

        $prunedCount = 0;

        foreach ($expiredMedia as $capturedMedia) {
            try {
                foreach (['color_path', 'bw_path', 'gif_path'] as $attribute) {
                    if ($capturedMedia->{$attribute} !== null) {
                        Storage::disk('public')->delete($capturedMedia->{$attribute});
                    }
                }

                $capturedMedia->forceFill([
                    'color_path' => null,
                    'bw_path' => null,
                    'gif_path' => null,
                ])->save();

                $prunedCount++;
            } catch (Throwable $exception) {
                Log::error('Failed to prune expired captured media.', [
                    'captured_media_id' => $capturedMedia->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        $this->info("Pruned {$prunedCount} expired media record(s).");

        return self::SUCCESS;
    }
}
