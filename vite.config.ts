import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

const devServerHost = process.env.VITE_DEV_SERVER_HOST ?? 'localhost';
const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT ?? 5173);
const hmrHost = process.env.VITE_HMR_HOST ?? 'localhost';
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT ?? 5173);

export default defineConfig({
    server: {
        host: devServerHost,
        port: devServerPort,
        strictPort: true,
        hmr: {
            host: hmrHost,
            clientPort: hmrClientPort,
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
});
