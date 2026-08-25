import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const appCssPath = resolve(projectRoot, 'resources/css/app.css');
const designSystemPath = resolve(projectRoot, 'design-system.html');
const adminRulePath = resolve(projectRoot, '.ai/rules/admin.md');

const appCss = readFileSync(appCssPath, 'utf8');
const designSystem = readFileSync(designSystemPath, 'utf8');
const adminRule = readFileSync(adminRulePath, 'utf8');

const canonicalThemeTokens = [
    '--text-page-title:',
    '--text-section-title:',
    '--text-card-title:',
    '--spacing-page:',
    '--spacing-page-desktop:',
    '--spacing-section:',
    '--spacing-card:',
    '--spacing-form:',
    '--spacing-field:',
    '--spacing-toolbar:',
    '--spacing-control-md:',
    '--spacing-touch-target:',
    '--spacing-icon-md:',
    '--spacing-sidebar:',
    '--container-content:',
    '--container-dialog-md:',
    '--ease-standard:',
] as const;

const canonicalSemanticColorTokens = [
    '--color-background: var(--background);',
    '--color-card: var(--card);',
    '--color-muted: var(--muted);',
    '--color-destructive: var(--destructive);',
    '--color-success: var(--success);',
    '--color-warning: var(--warning);',
    '--color-info: var(--info);',
    '--color-border: var(--border);',
    '--color-ring: var(--ring);',
] as const;

const thermaSnapBrandTokens = [
    '--primary: oklch(0.59 0.24 15);',
    '--ring: oklch(0.59 0.24 15);',
    '--sidebar-primary: oklch(0.59 0.24 15);',
    '--sidebar-ring: oklch(0.59 0.24 15);',
] as const;

describe('canonical design-system contract', () => {
    it('exposes the reusable token API through Tailwind CSS 4 theme variables', () => {
        expect(appCss).toContain('@theme inline');

        for (const token of canonicalThemeTokens) {
            expect(appCss).toContain(token);
            expect(designSystem).toContain(token.replace(':', ''));
        }
    });

    it('preserves the established semantic color contract', () => {
        for (const token of canonicalSemanticColorTokens) {
            expect(appCss).toContain(token);
        }
    });

    it('keeps the approved ThermaSnap primary treatment synchronized', () => {
        for (const token of thermaSnapBrandTokens) {
            expect(appCss).toContain(token);
            expect(designSystem).toContain(token);
        }

        expect(appCss).toContain('--sidebar-accent: oklch(0.97 0.025 15);');
        expect(designSystem).toContain(
            '--sidebar-accent: oklch(0.97 0.025 15);',
        );
        expect(appCss).toContain('--sidebar-accent: oklch(0.25 0.045 15);');
        expect(designSystem).toContain(
            '--sidebar-accent: oklch(0.25 0.045 15);',
        );
    });

    it('keeps semantic text tokens readable across light and dark status surfaces', () => {
        const accessibleSemanticValues = [
            '--muted-foreground: oklch(0.54 0 0);',
            '--destructive-foreground: oklch(0.54 0.2 27.325);',
            '--success-foreground: oklch(0.72 0.16 150);',
            '--warning-foreground: oklch(0.78 0.16 80);',
            '--info-foreground: oklch(0.7 0.16 255);',
        ] as const;

        for (const token of accessibleSemanticValues) {
            expect(appCss).toContain(token);
            expect(designSystem).toContain(token);
        }
    });

    it('does not reference undefined design-system CSS custom properties', () => {
        const styleBlock =
            designSystem.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
        const definedTokens = new Set(
            [...styleBlock.matchAll(/(--[\w-]+)\s*:/g)].map(
                (match) => match[1],
            ),
        );
        const referencedTokens = new Set(
            [...styleBlock.matchAll(/var\((--[\w-]+)/g)].map(
                (match) => match[1],
            ),
        );
        const missingTokens = [...referencedTokens]
            .filter((token) => !definedTokens.has(token))
            .sort();

        expect(missingTokens).toEqual([]);
    });

    it('keeps visual specimens aligned with canonical semantic roles', () => {
        expect(designSystem).toContain(
            '.tag.canonical { color:var(--success-foreground);',
        );
        expect(designSystem).toContain(
            '.tag.normalize { color:var(--warning-foreground);',
        );
        expect(designSystem).toContain(
            '.tag.missing { color:var(--info-foreground);',
        );
        expect(designSystem).toContain(
            '.tag.deprecated { color:var(--destructive-foreground);',
        );
        expect(designSystem).toContain(
            '.status.danger { color:var(--destructive-foreground);',
        );
        expect(designSystem).toContain(
            '<input id="demoActive" class="demo-check" type="checkbox" checked>',
        );
        expect(designSystem).not.toContain('fake-check');
        expect(designSystem).not.toMatch(/HEAD [a-f0-9]{7,40}/i);
    });

    it('documents the mandatory reuse and synchronization rules', () => {
        expect(designSystem).toContain(
            'Reuse before extension. Extend before creation. Creation requires evidence of a real reusable design-system gap.',
        );
        expect(designSystem).toContain(
            'A screenshot or design mockup defines visual intent, not application behavior.',
        );
        expect(designSystem).toContain('Mandatory two-way synchronization');
        expect(designSystem).toContain('New token admission rule');
        expect(designSystem).toContain('New component admission rule');
    });

    it('makes the reuse-first contract durable for future admin-page agents', () => {
        expect(adminRule).toContain('design-system.html');
        expect(adminRule).toContain('resources/css/app.css');
        expect(adminRule).toContain(
            'Reuse before extension. Extend before creation. Creation requires evidence of a real reusable design-system gap.',
        );
        expect(adminRule).toContain(
            'A screenshot or design mockup defines visual intent, not application behavior.',
        );
    });

    it('does not introduce domain-named visual tokens into the canonical CSS layer', () => {
        expect(appCss).not.toMatch(
            /--(?:voucher|payment|payments|template|sticker|dashboard)-/i,
        );
    });
});
