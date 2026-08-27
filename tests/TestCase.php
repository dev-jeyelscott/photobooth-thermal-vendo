<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * Environment variables declared by phpunit.xml that must win over Docker
     * runtime variables before Laravel boots the application for a test.
     *
     * @var list<string>
     */
    private const TEST_ENVIRONMENT_KEYS = [
        'APP_ENV',
        'APP_MAINTENANCE_DRIVER',
        'BCRYPT_ROUNDS',
        'BROADCAST_CONNECTION',
        'CACHE_STORE',
        'DB_CONNECTION',
        'DB_DATABASE',
        'DB_URL',
        'MAIL_MAILER',
        'QUEUE_CONNECTION',
        'SESSION_DRIVER',
        'PULSE_ENABLED',
        'TELESCOPE_ENABLED',
        'NIGHTWATCH_ENABLED',
    ];

    /**
     * Bootstrap Laravel only after synchronizing PHPUnit's testing environment
     * with the process environment inherited from Docker.
     */
    public function createApplication(): Application
    {
        $this->synchronizeTestingEnvironment();

        return parent::createApplication();
    }

    /**
     * Skip a test when the required Fortify feature is disabled.
     */
    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }

    /**
     * Promote PHPUnit's authoritative testing values into getenv() and
     * $_SERVER so Docker-injected development values cannot win at bootstrap.
     */
    private function synchronizeTestingEnvironment(): void
    {
        foreach (self::TEST_ENVIRONMENT_KEYS as $name) {
            $value = $_ENV[$name] ?? null;

            if (! is_string($value)) {
                continue;
            }

            putenv(sprintf('%s=%s', $name, $value));
            $_SERVER[$name] = $value;
        }
    }
}
