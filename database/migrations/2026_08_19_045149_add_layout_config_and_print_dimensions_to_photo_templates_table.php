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
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->json('layout_config')->nullable()->after('photo_slots');
            $table->unsignedInteger('print_width_mm')->after('layout_config');
            $table->unsignedInteger('print_height_mm')->after('print_width_mm');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->dropColumn(['layout_config', 'print_width_mm', 'print_height_mm']);
        });
    }
};
