<?php

namespace App\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

trait TemplateValidationRules
{
    /**
     * Get the validation rules shared by template create and update requests.
     *
     * @param  bool  $layoutRequired  Whether the layout asset must be uploaded.
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function templateRules(bool $layoutRequired = true): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:255',
                'alpha_dash',
                Rule::unique('photo_templates', 'slug')->ignore($this->route('template')),
            ],
            'orientation' => ['required', 'string', Rule::in(['portrait', 'landscape'])],
            'layout' => [$layoutRequired ? 'required' : 'sometimes', 'image', 'max:5120'],
            'thumbnail' => ['nullable', 'image', 'max:5120'],
            'photo_slots' => ['required', 'integer', 'min:1'],
            'layout_config' => ['required', 'json'],
            'print_width_mm' => ['required', 'integer', 'min:1'],
            'print_height_mm' => ['required', 'integer', 'min:1'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'printer_compatibility' => ['nullable', 'json'],
        ];
    }

    /**
     * Perform cross-field validation after the base template rules pass.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (
                    $validator->errors()->has('layout_config')
                    || $validator->errors()->has('photo_slots')
                    || $validator->errors()->has('print_width_mm')
                    || $validator->errors()->has('print_height_mm')
                ) {
                    return;
                }

                $this->validateLayoutConfiguration($validator);
            },
        ];
    }

    /**
     * Validate the canonical layout_config slot geometry against the selected print area.
     */
    private function validateLayoutConfiguration(Validator $validator): void
    {
        $decoded = json_decode((string) $this->input('layout_config'), true);

        if (! is_array($decoded)) {
            $validator->errors()->add(
                'layout_config',
                __('The layout configuration must be a JSON object.'),
            );

            return;
        }

        $slots = Arr::get($decoded, 'slots');

        if (! is_array($slots) || ! array_is_list($slots)) {
            $validator->errors()->add(
                'layout_config',
                __('The layout configuration must contain a slots array.'),
            );

            return;
        }

        $photoSlots = (int) $this->input('photo_slots');

        if (count($slots) !== $photoSlots) {
            $validator->errors()->add(
                'layout_config',
                __('The number of configured layout slots must match the photo slot count.'),
            );

            return;
        }

        $printWidth = (int) $this->input('print_width_mm');
        $printHeight = (int) $this->input('print_height_mm');

        foreach ($slots as $index => $slot) {
            if (! is_array($slot)) {
                $validator->errors()->add(
                    'layout_config',
                    __('Every layout slot must be a JSON object.'),
                );

                return;
            }

            $slotNumber = Arr::get($slot, 'slot');
            $x = Arr::get($slot, 'x');
            $y = Arr::get($slot, 'y');
            $width = Arr::get($slot, 'width');
            $height = Arr::get($slot, 'height');

            if (
                ! is_int($slotNumber)
                || ! is_int($x)
                || ! is_int($y)
                || ! is_int($width)
                || ! is_int($height)
            ) {
                $validator->errors()->add(
                    'layout_config',
                    __('Every slot must contain integer slot, x, y, width, and height values.'),
                );

                return;
            }

            if ($slotNumber !== $index + 1) {
                $validator->errors()->add(
                    'layout_config',
                    __('Layout slots must be sequentially numbered starting at 1.'),
                );

                return;
            }

            if ($x < 0 || $y < 0 || $width <= 0 || $height <= 0) {
                $validator->errors()->add(
                    'layout_config',
                    __('Slot positions cannot be negative and slot dimensions must be greater than zero.'),
                );

                return;
            }

            if ($x + $width > $printWidth || $y + $height > $printHeight) {
                $validator->errors()->add(
                    'layout_config',
                    __('Every layout slot must remain inside the configured print area.'),
                );

                return;
            }
        }
    }
}
