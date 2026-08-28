<?php

namespace App\Http\Controllers;

use App\Actions\Stickers\SelectStickerDesign;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Models\StickerDesign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StickerDesignController extends Controller
{
    /**
     * List globally managed stickers available to this Business kiosk.
     */
    public function index(Business $business, Request $request): JsonResponse
    {
        $query = StickerDesign::active()
            ->orderBy('sort_order')
            ->orderBy('name');

        $sessionToken = $request->query('sessionToken');

        if ($sessionToken !== null) {
            $session = $business->photoboothSessions()
                ->where('session_token', $sessionToken)
                ->first();

            if ($session === null) {
                return response()->json([
                    'message' => 'Session not found.',
                ], 404);
            }

            if ($session->photo_template_id !== null) {
                $query->where(function ($compatible) use ($session): void {
                    $compatible
                        ->doesntHave('photoTemplates')
                        ->orWhereHas(
                            'photoTemplates',
                            fn ($templates) => $templates->where(
                                'photo_templates.id',
                                $session->photo_template_id,
                            ),
                        );
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
     * Select a sticker for the route-scoped photobooth session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        Request $request,
        SelectStickerDesign $selectStickerDesign,
    ): JsonResponse {
        $validated = $request->validate([
            'stickerDesignId' => ['required', 'integer'],
        ]);

        $selected = $selectStickerDesign->handle(
            $photoboothSession,
            $validated['stickerDesignId'],
        );

        if (! $selected) {
            return response()->json([
                'message' => 'This sticker could not be selected for the current session.',
                'status' => $photoboothSession->fresh()->status->value,
            ], 422);
        }

        return response()->json([
            'status' => $photoboothSession->fresh()->status->value,
        ]);
    }
}
