<?php

namespace App\Providers;

use App\Services\Printing\LocalMockPrinterDriver;
use App\Services\Printing\PrinterDriver;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Drivers\Imagick\Driver as ImagickDriver;
use Intervention\Image\ImageManager;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ImageManager::class, fn (): ImageManager => new ImageManager(
            config('image.driver') === 'imagick' ? new ImagickDriver : new GdDriver,
        ));

        $this->app->bind(PrinterDriver::class, function ($app): PrinterDriver {
            $driverKey = config('photobooth.default_printer_driver');
            $driverClass = config("photobooth.printer_drivers.{$driverKey}", LocalMockPrinterDriver::class);

            return $app->make($driverClass);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );

        $this->configureRateLimiting();
    }

    /**
     * Configure named rate limiters for public-facing photobooth endpoints.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('session-creation', fn (Request $request): Limit => Limit::perMinute(
            (int) config('photobooth.rate_limits.session_creation_attempts_per_minute'),
        )->by($request->ip()));

        RateLimiter::for('payment-creation', fn (Request $request): Limit => Limit::perMinute(
            (int) config('photobooth.rate_limits.payment_attempts_per_minute'),
        )->by($request->ip()));

        RateLimiter::for('voucher-redemption', fn (Request $request): Limit => Limit::perMinute(
            (int) config('photobooth.rate_limits.voucher_attempts_per_minute'),
        )->by($request->ip()));
    }
}
