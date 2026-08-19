<?php

namespace App\Services;

use App\Models\ApplicationSetting;

class Settings
{
    /**
     * Get the effective value for a photobooth setting key.
     *
     * Reads the persisted ApplicationSetting row for the key when present,
     * cast to match the type of its config/photobooth.php default, and
     * falls back to that default otherwise.
     */
    public static function get(string $key): mixed
    {
        $default = config("photobooth.{$key}");

        $setting = ApplicationSetting::where('key', $key)->first();

        if ($setting === null || $setting->value === null) {
            return $default;
        }

        return match (true) {
            is_int($default) => (int) $setting->value,
            is_float($default) => (float) $setting->value,
            is_bool($default) => filter_var($setting->value, FILTER_VALIDATE_BOOLEAN),
            default => $setting->value,
        };
    }
}
