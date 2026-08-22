<?php

namespace Database\Seeders;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\ApplicationSetting;
use App\Models\CapturedMedia;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use App\Models\StickerDesign;
use App\Models\User;
use App\Models\Voucher;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Encoders\GifEncoder;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\ImageManager;
use RuntimeException;

class DemoSeeder extends Seeder
{
    private const string ADMIN_EMAIL = 'demo@thermasnap.local';

    private const string ADMIN_PASSWORD = 'ThermaSnapDemo!2026';

    /** @var list<string> */
    private const array SESSION_TOKENS = [
        '11111111-1111-4111-8111-000000000001',
        '11111111-1111-4111-8111-000000000002',
        '11111111-1111-4111-8111-000000000003',
        '11111111-1111-4111-8111-000000000004',
        '11111111-1111-4111-8111-000000000005',
        '11111111-1111-4111-8111-000000000006',
        '11111111-1111-4111-8111-000000000007',
        '11111111-1111-4111-8111-000000000008',
        '11111111-1111-4111-8111-000000000009',
        '11111111-1111-4111-8111-000000000010',
        '11111111-1111-4111-8111-000000000011',
        '11111111-1111-4111-8111-000000000012',
        '11111111-1111-4111-8111-000000000013',
        '11111111-1111-4111-8111-000000000014',
        '11111111-1111-4111-8111-000000000015',
        '11111111-1111-4111-8111-000000000016',
        '11111111-1111-4111-8111-000000000017',
        '11111111-1111-4111-8111-000000000018',
        '11111111-1111-4111-8111-000000000019',
    ];

    /**
     * Seed a complete synthetic ThermaSnap demo environment.
     */
    public function run(): void
    {
        if (! in_array(app()->environment(), ['local', 'testing', 'demo'], true)) {
            /**
             * Laravel's Seeder::$command PHPDoc declares Command, but the
             * property can remain null when the seeder is invoked without
             * an Artisan seeding command.
             *
             * @var Command|null $command
             */
            $command = $this->command;

            $command?->warn('ThermaSnap demo seeding is disabled outside local, testing, and demo environments.');

            return;
        }

        $this->seedAssets();

        DB::transaction(function (): void {
            PhotoboothSession::query()->whereIn('session_token', self::SESSION_TOKENS)->delete();

            $this->seedAdministrator();
            $this->seedSettings();

            $templates = $this->seedTemplates();
            $stickers = $this->seedStickers($templates);
            $vouchers = $this->seedVouchers();

            $this->seedHistory($templates, $stickers, $vouchers);
        });
    }

    /**
     * Create or refresh the verified administrator used for local demos.
     */
    private function seedAdministrator(): void
    {
        User::query()->firstOrNew(['email' => self::ADMIN_EMAIL])
            ->forceFill([
                'name' => 'ThermaSnap Demo Admin',
                'email' => self::ADMIN_EMAIL,
                'email_verified_at' => now(),
                'password' => self::ADMIN_PASSWORD,
            ])
            ->save();
    }

    /**
     * Seed the exact keys currently managed by the admin settings screen.
     */
    private function seedSettings(): void
    {
        $settings = [
            'booth_display_name' => 'ThermaSnap Demo Booth',
            'session_price' => '50.00',
            'currency' => 'PHP',
            'countdown_seconds' => '3',
            'capture_shot_count' => '3',
            'capture_countdown_seconds' => '3',
            'retake_limit' => '2',
            'kiosk_idle_timeout_seconds' => '60',
            'session_timeout_seconds' => '900',
            'gallery_expiration_hours' => '72',
            'gif_frame_duration_ms' => '500',
            'default_printer' => 'local_mock',
            'receipt_header' => 'THERMASNAP PHOTOBOOTH',
            'receipt_footer' => 'Scan the QR code to save your photos.',
            'maintenance_mode' => 'false',
            'maintenance_message' => 'The booth is temporarily unavailable. Please try again shortly.',
        ];

        foreach ($settings as $key => $value) {
            ApplicationSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    /**
     * Seed active and inactive templates using deterministic public-disk assets.
     *
     * @return array<string, PhotoTemplate>
     */
    private function seedTemplates(): array
    {
        $definitions = [
            'classic' => ['ThermaSnap Classic Strip', 'thermasnap-classic-strip', 'portrait', 3, 58, 160, true, 0, [
                ['slot' => 1, 'x' => 4, 'y' => 10, 'width' => 50, 'height' => 42],
                ['slot' => 2, 'x' => 4, 'y' => 56, 'width' => 50, 'height' => 42],
                ['slot' => 3, 'x' => 4, 'y' => 102, 'width' => 50, 'height' => 42],
            ]],
            'double' => ['Double Portrait', 'double-portrait', 'portrait', 2, 58, 125, true, 1, [
                ['slot' => 1, 'x' => 4, 'y' => 12, 'width' => 50, 'height' => 45],
                ['slot' => 2, 'x' => 4, 'y' => 63, 'width' => 50, 'height' => 45],
            ]],
            'wide' => ['Wide Memory Pair', 'wide-memory-pair', 'landscape', 2, 80, 58, true, 2, [
                ['slot' => 1, 'x' => 4, 'y' => 8, 'width' => 34, 'height' => 42],
                ['slot' => 2, 'x' => 42, 'y' => 8, 'width' => 34, 'height' => 42],
            ]],
            'archive' => ['Legacy Single Portrait', 'legacy-single-portrait', 'portrait', 1, 58, 100, false, 3, [
                ['slot' => 1, 'x' => 4, 'y' => 10, 'width' => 50, 'height' => 72],
            ]],
        ];

        $models = [];

        foreach ($definitions as $key => [$name, $slug, $orientation, $slots, $width, $height, $active, $sortOrder, $layoutSlots]) {
            $models[$key] = PhotoTemplate::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'orientation' => $orientation,
                    'layout_path' => "demo/templates/{$slug}-layout.png",
                    'thumbnail_path' => "demo/templates/{$slug}-thumbnail.png",
                    'photo_slots' => $slots,
                    'layout_config' => ['slots' => $layoutSlots],
                    'print_width_mm' => $width,
                    'print_height_mm' => $height,
                    'active' => $active,
                    'sort_order' => $sortOrder,
                    'printer_compatibility' => [
                        'paper_width_mm' => $width,
                        'drivers' => ['local_mock', 'print_bridge'],
                    ],
                ],
            );
        }

        return $models;
    }

    /**
     * Seed restricted, universal, and inactive sticker designs.
     *
     * @param  array<string, PhotoTemplate>  $templates
     * @return array<string, StickerDesign>
     */
    private function seedStickers(array $templates): array
    {
        $definitions = [
            'confetti' => ['Confetti Corner', 'confetti-corner', true, 0, 0.20, [$templates['classic']->id, $templates['double']->id]],
            'flash' => ['Flash Badge', 'flash-badge', true, 1, 0.18, [$templates['wide']->id]],
            'universal' => ['ThermaSnap Mark', 'thermasnap-mark', true, 2, 0.16, []],
            'archive' => ['Archived Star', 'archived-star', false, 3, 0.20, [$templates['archive']->id]],
        ];

        $models = [];

        foreach ($definitions as $key => [$name, $slug, $active, $sortOrder, $sizeRatio, $templateIds]) {
            $sticker = StickerDesign::query()->updateOrCreate(
                ['name' => $name],
                [
                    'asset_path' => "demo/stickers/{$slug}.png",
                    'thumbnail_path' => "demo/stickers/thumbnails/{$slug}.png",
                    'active' => $active,
                    'sort_order' => $sortOrder,
                    'placement' => ['size_ratio' => $sizeRatio, 'margin_ratio' => 0.03],
                ],
            );

            $sticker->photoTemplates()->sync($templateIds);
            $models[$key] = $sticker;
        }

        return $models;
    }

    /**
     * Seed vouchers covering every useful management state.
     *
     * @return array<string, Voucher>
     */
    private function seedVouchers(): array
    {
        $now = now();

        $definitions = [
            'single' => ['THERMA-DEMO-1', true, $now->subDay(), $now->addMonth(), 1, 0],
            'friends' => ['THERMA-FRIENDS', true, $now->subMonth(), $now->addMonth(), 10, 2],
            'sold_out' => ['THERMA-SOLDOUT', true, $now->subMonths(2), $now->addMonth(), 1, 1],
            'expired' => ['THERMA-EXPIRED', true, $now->subMonth(), $now->subDay(), 5, 0],
            'inactive' => ['THERMA-INACTIVE', false, $now->subMonth(), $now->addMonth(), 5, 0],
            'future' => ['THERMA-NEXT', true, $now->addDays(2), $now->addMonth(), 5, 0],
        ];

        $models = [];

        foreach ($definitions as $key => [$code, $active, $validFrom, $expiresAt, $limit, $count]) {
            $models[$key] = Voucher::query()->updateOrCreate(
                ['code' => $code],
                [
                    'active' => $active,
                    'valid_from' => $validFrom,
                    'expires_at' => $expiresAt,
                    'usage_limit' => $limit,
                    'usage_count' => $count,
                ],
            );
        }

        return $models;
    }

    /**
     * Seed coherent current-day, current-month, and older operational history.
     *
     * @param  array<string, PhotoTemplate>  $templates
     * @param  array<string, StickerDesign>  $stickers
     * @param  array<string, Voucher>  $vouchers
     */
    private function seedHistory(array $templates, array $stickers, array $vouchers): void
    {
        $now = now();
        $today = $this->todayTimeline($now);
        $yesterday = $now->subDay()->setTime(14, 15);
        $twoDaysAgo = $now->subDays(2)->setTime(11, 40);
        $fiveDaysAgo = $now->subDays(5)->setTime(16, 5);
        $threeDaysAgo = $now->subDays(3)->setTime(9, 20);
        $fourDaysAgo = $now->subDays(4)->setTime(18, 10);
        $lastMonth = $now->subMonthNoOverflow()->startOfMonth()->addDays(5)->setTime(13, 25);

        /**
         * @var list<array{
         *     0: int,
         *     1: PhotoboothSessionStatus,
         *     2: string|null,
         *     3: string|null,
         *     4: string|null,
         *     5: PaymentMethod|null,
         *     6: string|null,
         *     7: CarbonInterface,
         *     8: CarbonInterface,
         *     9: PaymentStatus|null,
         *     10: int|null,
         *     11: bool,
         *     12: PrintJobStatus|null,
         *     13: int|null,
         *     14: string|null
         * }>
         */
        $scenarios = [
            [0, PhotoboothSessionStatus::Completed, 'classic', 'confetti', null, PaymentMethod::Maya, '50.00', $today[0], $today[1], PaymentStatus::Success, 1, true, PrintJobStatus::Printed, 1, null],
            [1, PhotoboothSessionStatus::Completed, 'double', 'universal', null, PaymentMethod::Maya, '50.00', $today[2], $today[3], PaymentStatus::Success, 2, true, PrintJobStatus::Printed, 1, null],
            [2, PhotoboothSessionStatus::Completed, 'classic', 'universal', 'friends', PaymentMethod::Voucher, '0.00', $today[4], $today[5], null, null, true, PrintJobStatus::Printed, 1, null],
            [3, PhotoboothSessionStatus::Completed, 'wide', 'flash', null, PaymentMethod::Maya, '50.00', $today[6], $today[7], PaymentStatus::Success, 3, true, PrintJobStatus::Printed, 1, null],
            [4, PhotoboothSessionStatus::Completed, 'double', 'universal', 'friends', PaymentMethod::Voucher, '0.00', $today[8], $today[9], null, null, true, PrintJobStatus::Printed, 1, null],
            [5, PhotoboothSessionStatus::Printing, 'classic', 'confetti', null, PaymentMethod::Maya, '50.00', $today[10], $today[11], PaymentStatus::Success, 4, true, PrintJobStatus::Failed, 3, 'Printer bridge unavailable'],
            [6, PhotoboothSessionStatus::PaymentPending, null, null, null, PaymentMethod::Maya, '50.00', $today[12], $today[12], PaymentStatus::Pending, 5, false, null, null, null],
            [7, PhotoboothSessionStatus::Abandoned, null, null, null, PaymentMethod::Maya, '50.00', $today[1], $today[2], PaymentStatus::Failed, 6, false, null, null, null],
            [8, PhotoboothSessionStatus::Abandoned, null, null, null, PaymentMethod::Maya, '50.00', $today[3], $today[4], PaymentStatus::Cancelled, 7, false, null, null, null],
            [9, PhotoboothSessionStatus::Capturing, 'classic', 'confetti', null, PaymentMethod::Maya, '50.00', $today[12], $today[13], PaymentStatus::Success, 8, false, null, null, null],
            [10, PhotoboothSessionStatus::New, null, null, null, null, null, $today[13], $today[13], null, null, false, null, null, null],
            [11, PhotoboothSessionStatus::Paid, null, null, null, PaymentMethod::Maya, '50.00', $today[11], $today[12], PaymentStatus::Success, 9, false, null, null, null],
            [12, PhotoboothSessionStatus::Printing, 'wide', 'universal', null, PaymentMethod::Maya, '50.00', $today[12], $today[13], PaymentStatus::Success, 10, true, PrintJobStatus::Pending, 0, null],
            [13, PhotoboothSessionStatus::Completed, 'classic', 'universal', null, PaymentMethod::Maya, '50.00', $yesterday, $yesterday->addMinutes(8), PaymentStatus::Success, 11, true, PrintJobStatus::Printed, 1, null],
            [14, PhotoboothSessionStatus::Completed, 'double', 'universal', 'sold_out', PaymentMethod::Voucher, '0.00', $twoDaysAgo, $twoDaysAgo->addMinutes(7), null, null, true, PrintJobStatus::Printed, 1, null],
            [15, PhotoboothSessionStatus::Completed, 'wide', 'flash', null, PaymentMethod::Maya, '50.00', $fiveDaysAgo, $fiveDaysAgo->addMinutes(9), PaymentStatus::Success, 12, false, PrintJobStatus::Printed, 1, null],
            [16, PhotoboothSessionStatus::Expired, null, null, null, null, null, $threeDaysAgo, $threeDaysAgo->addMinutes(16), null, null, false, null, null, null],
            [17, PhotoboothSessionStatus::Abandoned, null, null, null, null, null, $fourDaysAgo, $fourDaysAgo->addMinutes(5), null, null, false, null, null, null],
            [18, PhotoboothSessionStatus::Completed, 'classic', 'universal', null, PaymentMethod::Maya, '50.00', $lastMonth, $lastMonth->addMinutes(8), PaymentStatus::Success, 13, false, PrintJobStatus::Printed, 1, null],
        ];

        foreach ($scenarios as $scenario) {
            [$tokenIndex, $status, $templateKey, $stickerKey, $voucherKey, $method, $price, $startedAt, $updatedAt, $paymentStatus, $paymentSequence, $withMedia, $printStatus, $printAttempts, $printError] = $scenario;

            $template = $templateKey === null ? null : $templates[$templateKey];
            $sticker = $stickerKey === null ? null : $stickers[$stickerKey];
            $voucher = $voucherKey === null ? null : $vouchers[$voucherKey];
            $expiresAt = $status->isTerminal() ? $startedAt->addMinutes(15) : $now->addMinutes(15);

            $session = $this->createSession(
                self::SESSION_TOKENS[$tokenIndex],
                $status,
                $template,
                $sticker,
                $voucher,
                $method,
                $price,
                $startedAt,
                $updatedAt,
                $expiresAt,
            );

            if ($paymentStatus !== null && $paymentSequence !== null) {
                $this->createMayaPayment($session, $paymentStatus, $paymentSequence, $startedAt->addMinute(), $updatedAt);
            }

            if ($withMedia) {
                $this->createMedia($session, $updatedAt);
            }

            if ($printStatus !== null && $printAttempts !== null) {
                $this->createPrintJob($session, $printStatus, $printAttempts, $printError, $updatedAt);
            }
        }
    }

    /**
     * Create one durable session row with rendering snapshots matching its catalog records.
     */
    private function createSession(
        string $token,
        PhotoboothSessionStatus $status,
        ?PhotoTemplate $template,
        ?StickerDesign $sticker,
        ?Voucher $voucher,
        ?PaymentMethod $method,
        ?string $price,
        CarbonInterface $startedAt,
        CarbonInterface $updatedAt,
        CarbonInterface $expiresAt,
    ): PhotoboothSession {
        return PhotoboothSession::factory()->create([
            'session_token' => $token,
            'status' => $status,
            'photo_template_id' => $template?->id,
            'sticker_design_id' => $sticker?->id,
            'voucher_id' => $voucher?->id,
            'price' => $price,
            'currency' => $method === null ? null : 'PHP',
            'payment_method' => $method,
            'required_capture_count' => $method === null ? null : 3,
            'template_snapshot' => $template === null ? null : [
                'name' => $template->name,
                'layout_config' => $template->layout_config,
                'photo_slots' => $template->photo_slots,
                'print_width_mm' => $template->print_width_mm,
                'print_height_mm' => $template->print_height_mm,
            ],
            'sticker_snapshot' => $sticker === null ? null : [
                'asset_path' => $sticker->asset_path,
                'placement' => $sticker->placement,
            ],
            'started_at' => $startedAt,
            'expires_at' => $expiresAt,
            'created_at' => $startedAt,
            'updated_at' => $updatedAt,
        ]);
    }

    /**
     * Create a deterministic synthetic Maya payment without contacting Maya.
     */
    private function createMayaPayment(
        PhotoboothSession $session,
        PaymentStatus $status,
        int $sequence,
        CarbonInterface $createdAt,
        CarbonInterface $updatedAt,
    ): void {
        Payment::factory()->for($session, 'photoboothSession')->create([
            'method' => PaymentMethod::Maya,
            'status' => $status,
            'maya_checkout_id' => sprintf('10000000-0000-4000-8000-%012d', $sequence),
            'maya_payment_id' => $status === PaymentStatus::Pending
                ? null
                : sprintf('20000000-0000-4000-8000-%012d', $sequence),
            'amount' => '50.00',
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ]);
    }

    /**
     * Create working color, black-and-white, and GIF files for a recent session.
     */
    private function createMedia(PhotoboothSession $session, CarbonInterface $createdAt): void
    {
        $disk = Storage::disk('public');
        $prefix = 'captures/demo/'.$session->session_token;

        $paths = [
            'color_path' => $prefix.'-color.jpg',
            'bw_path' => $prefix.'-bw.jpg',
            'gif_path' => $prefix.'-animation.gif',
        ];

        $this->put($paths['color_path'], $disk->get('demo/media/sample-color.jpg'));
        $this->put($paths['bw_path'], $disk->get('demo/media/sample-bw.jpg'));
        $this->put($paths['gif_path'], $disk->get('demo/media/sample-animation.gif'));

        CapturedMedia::factory()->for($session, 'photoboothSession')->create([
            ...$paths,
            'public_token' => hash('sha256', 'thermasnap-demo-gallery:'.$session->session_token),
            'expires_at' => $createdAt->addHours(72),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    /**
     * Create a print record that remains consistent with the current print lifecycle.
     */
    private function createPrintJob(
        PhotoboothSession $session,
        PrintJobStatus $status,
        int $attempts,
        ?string $error,
        CarbonInterface $occurredAt,
    ): void {
        PrintJob::factory()->for($session, 'photoboothSession')->create([
            'status' => $status,
            'attempt_count' => $attempts,
            'last_error' => $error,
            'completed_at' => $status === PrintJobStatus::Printed ? $occurredAt : null,
            'created_at' => $occurredAt,
            'updated_at' => $occurredAt,
        ]);
    }

    /**
     * Build fourteen ordered timestamps inside the last two hours without crossing today's boundary.
     *
     * @return list<CarbonInterface>
     */
    private function todayTimeline(CarbonInterface $now): array
    {
        $startOfDay = $now->copy()->startOfDay();
        $elapsed = max(0, intdiv($now->getTimestamp() - $startOfDay->getTimestamp(), 60));
        $window = min($elapsed, 120);
        $windowStart = $now->copy()->subMinutes($window);
        $timeline = [];

        for ($index = 0; $index < 14; $index++) {
            $timeline[] = $windowStart->copy()->addMinutes((int) floor($window * ($index / 13)));
        }

        return $timeline;
    }

    /**
     * Generate deterministic template, sticker, and gallery sample files on the named public disk.
     */
    private function seedAssets(): void
    {
        $disk = Storage::disk('public');

        $disk->deleteDirectory('demo');
        $disk->deleteDirectory('captures/demo');

        $templateAssets = [
            ['thermasnap-classic-strip', 580, 1600, '#f5f5f4'],
            ['double-portrait', 580, 1250, '#fff7ed'],
            ['wide-memory-pair', 800, 580, '#eff6ff'],
            ['legacy-single-portrait', 580, 1000, '#f8fafc'],
        ];

        foreach ($templateAssets as [$slug, $width, $height, $background]) {
            $this->writePng(
                "demo/templates/{$slug}-layout.png",
                $width,
                $height,
                $background,
            );

            $this->writePng(
                "demo/templates/{$slug}-thumbnail.png",
                max(200, intdiv($width, 2)),
                max(200, intdiv($height, 2)),
                $background,
            );
        }

        foreach ([
            ['confetti-corner', '#fb7185'],
            ['flash-badge', '#facc15'],
            ['thermasnap-mark', '#0f172a'],
            ['archived-star', '#94a3b8'],
        ] as [$slug, $background]) {
            $this->writePng("demo/stickers/{$slug}.png", 256, 256, $background);
            $this->writePng(
                "demo/stickers/thumbnails/{$slug}.png",
                128,
                128,
                $background,
            );
        }

        $this->writeJpeg('demo/media/sample-color.jpg', 1200, 1600, '#fde68a');
        $this->writeJpeg('demo/media/sample-bw.jpg', 1200, 1600, '#d6d3d1');
        $this->writeGif('demo/media/sample-animation.gif', 480, 640, '#fda4af');
    }

    /**
     * Write a valid PNG using the application's configured Intervention Image driver.
     */
    private function writePng(string $path, int $width, int $height, string $background): void
    {
        $image = app(ImageManager::class)
            ->createImage($width, $height)
            ->fill($background);

        $this->put($path, (string) $image->encode(new PngEncoder));
    }

    /**
     * Write a valid JPEG using the application's configured Intervention Image driver.
     */
    private function writeJpeg(string $path, int $width, int $height, string $background): void
    {
        $image = app(ImageManager::class)
            ->createImage($width, $height)
            ->fill($background);

        $this->put(
            $path,
            (string) $image->encode(new JpegEncoder(quality: 88)),
        );
    }

    /**
     * Write a valid static GIF for the gallery's animation slot.
     */
    private function writeGif(string $path, int $width, int $height, string $background): void
    {
        $image = app(ImageManager::class)
            ->createImage($width, $height)
            ->fill($background);

        $this->put($path, (string) $image->encode(new GifEncoder));
    }

    /**
     * Persist bytes to the public disk and fail loudly if the write fails.
     */
    private function put(string $path, string $contents): void
    {
        if (! Storage::disk('public')->put($path, $contents)) {
            throw new RuntimeException("Unable to write ThermaSnap demo asset [{$path}].");
        }
    }
}
