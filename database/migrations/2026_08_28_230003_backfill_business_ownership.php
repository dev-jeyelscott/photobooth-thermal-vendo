<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Place existing single-tenant records behind one legacy Business boundary.
     */
    public function up(): void
    {
        $owner = DB::table('users')
            ->orderBy('id')
            ->first(['id']);

        if ($owner === null) {
            return;
        }

        $businessId = DB::table('businesses')
            ->where('slug', 'thermasnap')
            ->value('id');

        if ($businessId === null) {
            $now = now();

            $businessId = DB::table('businesses')->insertGetId([
                'name' => 'ThermaSnap Business',
                'slug' => 'thermasnap',
                'owner_user_id' => (int) $owner->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('users')
            ->whereNull('business_id')
            ->update(['business_id' => $businessId]);

        DB::table('photobooth_sessions')
            ->whereNull('business_id')
            ->update(['business_id' => $businessId]);
    }

    /**
     * Keep the historical backfill forward-only.
     *
     * Schema rollback removes the owning columns and Business table in the
     * subsequent migration rollbacks, so reconstructing pre-migration tenant
     * assignments here would provide no durable value.
     */
    public function down(): void
    {
        //
    }
};
