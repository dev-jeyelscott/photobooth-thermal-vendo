<?php

namespace App\Http\Requests\Admin;

use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePayMongoAccountRequest extends FormRequest
{
    /**
     * Authorize only the authenticated owner of the current user's Business.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user instanceof User || $user->business_id === null) {
            return false;
        }

        $business = $user->business()->first();

        return $business instanceof Business
            && $user->can('managePaymentSettings', $business);
    }

    /**
     * Normalize credential whitespace without accepting ownership metadata.
     */
    protected function prepareForValidation(): void
    {
        $publicKey = $this->input('public_key');
        $secretKey = $this->input('secret_key');

        $this->merge([
            'public_key' => is_string($publicKey)
                ? trim($publicKey)
                : $publicKey,
            'secret_key' => is_string($secretKey)
                ? trim($secretKey)
                : $secretKey,
        ]);
    }

    /**
     * Validate credentials against the route-selected PayMongo mode.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $mode = $this->payMongoMode();

        return [
            'business_id' => ['prohibited'],
            'mode' => ['prohibited'],
            'public_key' => [
                'required',
                'string',
                'max:255',
                'starts_with:'.$mode->publicKeyPrefix(),
            ],
            'secret_key' => [
                'required',
                'string',
                'max:255',
                'starts_with:'.$mode->secretKeyPrefix(),
            ],
        ];
    }

    /**
     * Provide safe mode-specific validation messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        $mode = $this->payMongoMode();

        return [
            'business_id.prohibited' => 'Business ownership cannot be supplied by the request.',
            'mode.prohibited' => 'PayMongo mode is selected by the route.',
            'public_key.starts_with' => "The public key must be a {$mode->value} PayMongo public key.",
            'secret_key.starts_with' => "The secret key must be a {$mode->value} PayMongo secret key.",
        ];
    }

    /**
     * Resolve the route-selected PayMongo mode or fail closed.
     */
    private function payMongoMode(): PayMongoMode
    {
        $routeMode = $this->route('mode');

        if ($routeMode instanceof PayMongoMode) {
            return $routeMode;
        }

        $mode = PayMongoMode::tryFrom((string) $routeMode);

        if ($mode === null) {
            abort(404);
        }

        return $mode;
    }
}
