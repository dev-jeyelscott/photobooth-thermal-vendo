<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->json('template_snapshot')->nullable()->after('template_photo_slots');
        });

        DB::table('photobooth_sessions')->whereNotNull('template_layout_config')->orWhereNotNull('template_photo_slots')->orderBy('id')->chunkById(100, function ($sessions) {
            foreach ($sessions as $session) {
                DB::table('photobooth_sessions')->where('id', $session->id)->update([
                    'template_snapshot' => json_encode([
                        'layout_config' => $session->template_layout_config !== null ? json_decode($session->template_layout_config, true) : null,
                        'photo_slots' => $session->template_photo_slots,
                        'print_width_mm' => $session->template_print_width_mm,
                        'print_height_mm' => $session->template_print_height_mm,
                    ]),
                ]);
            }
        });

        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->dropColumn([
                'template_layout_config',
                'template_print_width_mm',
                'template_print_height_mm',
                'template_photo_slots',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->json('template_layout_config')->nullable()->after('required_capture_count');
            $table->unsignedInteger('template_print_width_mm')->nullable()->after('template_layout_config');
            $table->unsignedInteger('template_print_height_mm')->nullable()->after('template_print_width_mm');
            $table->unsignedTinyInteger('template_photo_slots')->nullable()->after('template_print_height_mm');
        });

        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->dropColumn('template_snapshot');
        });
    }
};
