<?php

namespace App\Http\Controllers;

use App\Actions\Templates\SelectPhotoTemplate;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PhotoTemplateController extends Controller
{
    /**
     * List the templates available for customers to choose from.
     */
    public function index(): JsonResponse
    {
        $templates = PhotoTemplate::active()
            ->orderBy('name')
            ->get()
            ->map(fn (PhotoTemplate $template) => [
                'id' => $template->id,
                'name' => $template->name,
                'thumbnailPath' => $template->thumbnail_path,
                'photoSlots' => $template->photo_slots,
                'layoutConfig' => $template->layout_config,
                'printWidthMm' => $template->print_width_mm,
                'printHeightMm' => $template->print_height_mm,
            ]);

        return response()->json(['templates' => $templates]);
    }

    /**
     * Select a template for the given photobooth session.
     */
    public function store(string $sessionToken, Request $request, SelectPhotoTemplate $selectPhotoTemplate): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $validated = $request->validate([
            'photoTemplateId' => ['required', 'integer'],
        ]);

        $selected = $selectPhotoTemplate->handle($session, $validated['photoTemplateId']);

        if (! $selected) {
            return response()->json(['message' => 'This template could not be selected for the current session.'], 422);
        }

        return response()->json([
            'status' => $session->fresh()->status->value,
        ]);
    }
}
