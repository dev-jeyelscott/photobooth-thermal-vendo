<?php

namespace App\Concerns;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

trait StickerValidationRules
{
    /**
     * Get the validation rules shared by sticker create and update requests.
     *
     * @param  bool  $assetRequired  Whether the sticker asset must be uploaded.
     * @return array<string, array<int, ValidationRule|array<mixed>|string|Closure>>
     */
    protected function stickerRules(bool $assetRequired = true): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'asset' => [$assetRequired ? 'required' : 'sometimes', 'image', 'max:5120'],
            'thumbnail' => ['nullable', 'image', 'max:5120'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'placement' => ['nullable', 'json', $this->validPlacementJson()],
            'template_ids' => ['sometimes', 'array'],
            'template_ids.*' => ['integer', 'exists:photo_templates,id'],
        ];
    }

    /**
     * Reject placement JSON that does not decode to an array, or whose
     * size_ratio/margin_ratio are not safe positive numeric values.
     */
    protected function validPlacementJson(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || $value === '') {
                return;
            }

            $decoded = json_decode($value, true);

            if (! is_array($decoded)) {
                $fail('The :attribute must decode to a JSON object.');

                return;
            }

            foreach (['size_ratio', 'margin_ratio'] as $ratioKey) {
                if (! array_key_exists($ratioKey, $decoded)) {
                    continue;
                }

                $ratio = $decoded[$ratioKey];

                if (! is_numeric($ratio) || $ratio < 0 || $ratio > 1) {
                    $fail("The :attribute {$ratioKey} must be a number between 0 and 1.");

                    return;
                }
            }
        };
    }
}
