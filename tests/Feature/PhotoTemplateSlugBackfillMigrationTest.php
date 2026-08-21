<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

test('slug backfill migration preserves existing templates and assigns unique slugs', function () {
    $migration = require database_path('migrations/2026_08_21_102341_add_slug_orientation_sort_order_and_printer_compatibility_to_photo_templates_table.php');

    $migration->down();

    $duplicateNameId = DB::table('photo_templates')->insertGetId([
        'name' => 'Classic Strip',
        'layout_path' => 'templates/existing-a.png',
        'photo_slots' => 1,
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $sameNameId = DB::table('photo_templates')->insertGetId([
        'name' => 'Classic Strip',
        'layout_path' => 'templates/existing-b.png',
        'photo_slots' => 1,
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $migration->up();

    expect(Schema::hasColumns('photo_templates', ['slug', 'orientation', 'sort_order', 'printer_compatibility']))->toBeTrue();

    $duplicate = DB::table('photo_templates')->find($duplicateNameId);
    $sameName = DB::table('photo_templates')->find($sameNameId);

    expect($duplicate->slug)->not->toBeNull();
    expect($sameName->slug)->not->toBeNull();
    expect($duplicate->slug)->not->toBe($sameName->slug);
    expect($duplicate->orientation)->toBe('portrait');
    expect($sameName->sort_order)->toBe(0);

    $slugColumn = collect(DB::select('PRAGMA table_info(photo_templates)'))->firstWhere('name', 'slug');
    expect($slugColumn->notnull)->toBe(1);
});
