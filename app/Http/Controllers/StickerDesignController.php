<?php

namespace App\Http\Controllers;

use App\Actions\Stickers\SelectStickerDesign;
use App\Models\PhotoboothSession;
use App\Models\StickerDesign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StickerDesignController extends Controller
{
    /**
     * List the sticker designs available for customers to choose from.
     *
     * When a session token is supplied and that session already has a template
     * selected, the list is filtered to stickers compatible with that template.
     * An empty compatibility set means a sticker is compatible with all templates.
     */
    public function index(Request $request): JsonResponse
    {
        $query = StickerDesign::active()
            ->orderBy('sort_order')
            ->orderBy('name');

        $sessionToken = $request->query('sessionToken');

        if ($sessionToken !== null) {
            $session = PhotoboothSession::where('session_token', $sessionToken)->first();

            if ($session !== null && $session->photo_template_id !== null) {
                $query->where(function ($compatible) use ($session) {
                    $compatible->doesntHave('photoTemplates')
                        ->orWhereHas('photoTemplates', fn ($templates) => $templates->where('photo_templates.id', $session->photo_template_id));
                });
            }
        }

        $stickers = $query->get()
            ->map(fn (StickerDesign $sticker) => [
                'id' => $sticker->id,
                'name' => $sticker->name,
                'assetPath' => $sticker->asset_path,
                'thumbnailPath' => $sticker->thumbnail_path,
            ]);

        return response()->json(['stickers' => $stickers]);
    }

    /**
     * Select a sticker design for the given photobooth session.
     */
    public function store(string $sessionToken, Request $request, SelectStickerDesign $selectStickerDesign): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $validated = $request->validate([
            'stickerDesignId' => ['required', 'integer'],
        ]);

        $selected = $selectStickerDesign->handle($session, $validated['stickerDesignId']);

        if (! $selected) {
            return response()->json([
                'message' => 'This sticker could not be selected for the current session.',
                'status' => $session->fresh()->status->value,
            ], 422);
        }

        return response()->json([
            'status' => $session->fresh()->status->value,
        ]);
    }
}
