<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PhotoboothSessionStatus;
use App\Http\Controllers\Controller;
use App\Models\PhotoboothSession;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SessionMonitorController extends Controller
{
    /**
     * List photobooth sessions with their payment and print job status for operational monitoring.
     */
    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();

        $sessions = PhotoboothSession::query()
            ->with(['payment', 'printJob', 'photoTemplate', 'stickerDesign', 'voucher'])
            ->when($status !== '' && PhotoboothSessionStatus::tryFrom($status) !== null, fn ($query) => $query->where('status', $status))
            ->when($from !== '', fn ($query) => $query->whereDate('started_at', '>=', $from))
            ->when($to !== '', fn ($query) => $query->whereDate('started_at', '<=', $to))
            ->orderByDesc('started_at')
            ->paginate(20)
            ->withQueryString();

        $sessions->through(fn (PhotoboothSession $session) => $this->presentSession($session));

        return Inertia::render('admin/sessions/index', [
            'sessions' => $sessions,
            'filters' => [
                'status' => $status !== '' ? $status : null,
                'from' => $from !== '' ? $from : null,
                'to' => $to !== '' ? $to : null,
            ],
            'statuses' => array_map(fn (PhotoboothSessionStatus $case) => $case->value, PhotoboothSessionStatus::cases()),
        ]);
    }

    /**
     * Present a session for the frontend.
     *
     * @return array<string, mixed>
     */
    private function presentSession(PhotoboothSession $session): array
    {
        return [
            'id' => $session->id,
            'sessionToken' => $session->session_token,
            'status' => $session->status->value,
            'startedAt' => $session->started_at?->toIso8601String(),
            'expiresAt' => $session->expires_at?->toIso8601String(),
            'payment' => $session->payment ? [
                'method' => $session->payment->method->value,
                'status' => $session->payment->status->value,
                'amount' => $session->payment->amount,
            ] : null,
            'printJob' => $session->printJob ? [
                'status' => $session->printJob->status->value,
                'attemptCount' => $session->printJob->attempt_count,
                'completedAt' => $session->printJob->completed_at?->toIso8601String(),
            ] : null,
        ];
    }
}
