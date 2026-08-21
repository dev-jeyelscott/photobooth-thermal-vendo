<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
            $table->string('orientation')->default('portrait')->after('slug');
            $table->unsignedInteger('sort_order')->default(0)->after('active');
            $table->json('printer_compatibility')->nullable()->after('sort_order');
        });

        $usedSlugs = [];

        DB::table('photo_templates')->orderBy('id')->select(['id', 'name'])->each(function (object $template) use (&$usedSlugs) {
            $baseSlug = Str::slug($template->name) ?: 'template';
            $slug = $baseSlug;
            $suffix = 1;

            while (in_array($slug, $usedSlugs, true)) {
                $slug = $baseSlug.'-'.(++$suffix);
            }

            $usedSlugs[] = $slug;

            DB::table('photo_templates')->where('id', $template->id)->update(['slug' => $slug]);
        });

        Schema::table('photo_templates', function (Blueprint $table) {
            $table->string('slug')->nullable(false)->unique()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->dropUnique(['slug']);
        });

        Schema::table('photo_templates', function (Blueprint $table) {
            $table->dropColumn(['slug', 'orientation', 'sort_order', 'printer_compatibility']);
        });
    }
};
