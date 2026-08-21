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
            $table->string('slug')->unique()->after('name');
            $table->string('orientation')->default('portrait')->after('slug');
            $table->unsignedInteger('sort_order')->default(0)->after('active');
            $table->json('printer_compatibility')->nullable()->after('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->dropColumn(['slug', 'orientation', 'sort_order', 'printer_compatibility']);
        });
    }
};
