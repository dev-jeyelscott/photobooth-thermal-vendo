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
