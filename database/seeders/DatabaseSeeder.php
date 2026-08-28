<?php

namespace Database\Seeders;

use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's local/demo dataset and its Business ownership.
     */
    public function run(): void
    {
        $this->call(DemoSeeder::class);

        $this->assignDemoBusiness();
    }

    /**
     * Assign the deterministic demo operator and demo sessions to one Business.
     */
    private function assignDemoBusiness(): void
    {
        if (! in_array(app()->environment(), ['local', 'testing', 'demo'], true)) {
            return;
        }

        $admin = User::query()
            ->where('email', 'demo@thermasnap.local')
            ->first();

        if ($admin === null) {
            return;
        }

        $business = $admin->ownedBusiness()->first();

        if ($business === null) {
            $slug = Business::query()
                ->where('slug', 'thermasnap-demo')
                ->exists()
                    ? "thermasnap-demo-{$admin->id}"
                    : 'thermasnap-demo';

            $business = Business::query()->create([
                'name' => 'ThermaSnap Demo',
                'slug' => $slug,
                'owner_user_id' => $admin->id,
            ]);
        }

        $admin->forceFill([
            'business_id' => $business->id,
        ])->save();

        PhotoboothSession::query()
            ->whereNull('business_id')
            ->update([
                'business_id' => $business->id,
            ]);
    }
}
