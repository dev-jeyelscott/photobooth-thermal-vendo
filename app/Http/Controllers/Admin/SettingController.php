<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSettingsRequest;
use App\Models\ApplicationSetting;
use App\Services\Settings;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    /**
     * The application setting keys configurable from the admin settings page.
     *
     * @var list<string>
     */
    private const KEYS = [
        'session_price',
        'retake_limit',
        'session_timeout_seconds',
        'gallery_expiration_hours',
        'gif_frame_duration_ms',
        'default_printer',
        'booth_display_name',
    ];

    /**
     * Show the system settings edit form.
     */
    public function edit(): Response
    {
        $settings = collect(self::KEYS)
            ->mapWithKeys(fn (string $key) => [$key => Settings::get($key)]);

        return Inertia::render('admin/settings/edit', [
            'settings' => $settings,
        ]);
    }

    /**
     * Persist updated system settings.
     */
    public function update(UpdateSettingsRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        foreach (self::KEYS as $key) {
            ApplicationSetting::updateOrCreate(
                ['key' => $key],
                ['value' => (string) $validated[$key]]
            );
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Settings updated.')]);

        return to_route('admin.settings.edit');
    }
}
