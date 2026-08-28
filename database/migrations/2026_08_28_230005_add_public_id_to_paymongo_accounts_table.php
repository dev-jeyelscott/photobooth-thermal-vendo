<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Add a non-secret opaque UUID used for public PayMongo webhook routing.
     */
    public function up(): void
    {
        Schema::table('paymongo_accounts', function (Blueprint $table): void {
            $table->uuid('public_id')
                ->nullable()
                ->after('id');
        });

        DB::table('paymongo_accounts')
            ->select('id')
            ->orderBy('id')
            ->chunkById(100, function ($accounts): void {
                foreach ($accounts as $account) {
                    DB::table('paymongo_accounts')
                        ->where('id', $account->id)
                        ->update([
                            'public_id' => (string) Str::uuid(),
                        ]);
                }
            });

        Schema::table('paymongo_accounts', function (Blueprint $table): void {
            $table->uuid('public_id')
                ->nullable(false)
                ->change();

            $table->unique('public_id');
        });
    }

    /**
     * Remove the public PayMongo account routing identifier.
     */
    public function down(): void
    {
        Schema::table('paymongo_accounts', function (Blueprint $table): void {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }
};
