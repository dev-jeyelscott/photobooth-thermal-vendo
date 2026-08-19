<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Image Processing Driver
    |--------------------------------------------------------------------------
    |
    | The Intervention Image driver used to compose the final color photo.
    | Supported: "gd", "imagick".
    |
    */

    'driver' => env('IMAGE_DRIVER', 'gd'),

];
