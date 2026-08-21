<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->decimal('price', 8, 2)->nullable()->after('voucher_id');
            $table->string('currency', 3)->nullable()->after('price');
            $table->string('payment_method')->nullable()->after('currency');
            $table->unsignedTinyInteger('required_capture_count')->nullable()->after('payment_method');
            $table->json('template_layout_config')->nullable()->after('required_capture_count');
            $table->unsignedInteger('template_print_width_mm')->nullable()->after('template_layout_config');
            $table->unsignedInteger('template_print_height_mm')->nullable()->after('template_print_width_mm');
            $table->unsignedTinyInteger('template_photo_slots')->nullable()->after('template_print_height_mm');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->dropColumn([
                'price',
                'currency',
                'payment_method',
                'required_capture_count',
                'template_layout_config',
                'template_print_width_mm',
                'template_print_height_mm',
                'template_photo_slots',
            ]);
        });
    }
};
