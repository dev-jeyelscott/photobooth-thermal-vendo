<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Storage;

class ComposeColorPhotoRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string|Closure>
     */
    public function rules(): array
    {
        return [
            'photos' => ['required_without:photo_paths', 'array', 'min:1', 'max:20'],
            'photos.*' => ['required', 'string', $this->validPhotoDataUri()],
            'photo_paths' => ['required_without:photos', 'array', 'min:1', 'max:20'],
            'photo_paths.*' => ['required', 'string', $this->validStoredFramePath()],
        ];
    }

    /**
     * Validate that a photo is a base64-encoded image data URI within the
     * configured size limit.
     */
    private function validPhotoDataUri(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || ! preg_match(
                '/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+\/]+={0,2})$/',
                $value,
                $matches,
            )) {
                $fail('Each photo must be a valid base64-encoded PNG, JPEG, or WebP image.');

                return;
            }

            $sizeKilobytes = (strlen($matches[2]) * 3 / 4) / 1024;
            $maxKilobytes = (int) config('photobooth.captured_photo_max_kilobytes');

            if ($sizeKilobytes > $maxKilobytes) {
                $fail("Each photo must not exceed {$maxKilobytes} KB.");
            }
        };
    }

    /**
     * Validate that a photo reference points to a previously stored capture
     * frame belonging to this session, preventing path traversal or access
     * to another session's captures.
     */
    private function validStoredFramePath(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $sessionToken = (string) $this->route('sessionToken');
            $prefix = "captures/{$sessionToken}/";

            if (! is_string($value) || ! str_starts_with($value, $prefix) || str_contains($value, '..')) {
                $fail('Each photo reference must be a previously stored frame for this session.');

                return;
            }

            if (! Storage::disk('public')->exists($value)) {
                $fail('Each photo reference must point to a previously stored frame.');
            }
        };
    }
}
