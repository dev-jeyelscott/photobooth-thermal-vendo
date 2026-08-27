import { useSyncExternalStore } from 'react';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';
export type InterfaceDensity = 'comfortable' | 'balanced' | 'compact';

export type AppearancePreferences = {
    appearance: Appearance;
    density: InterfaceDensity;
    reduceMotion: boolean;
};

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly density: InterfaceDensity;
    readonly reduceMotion: boolean;
    readonly updateAppearance: (mode: Appearance) => void;
    readonly updatePreferences: (preferences: AppearancePreferences) => void;
};

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
    appearance: 'system',
    density: 'balanced',
    reduceMotion: false,
};

const appearanceStorageKey = 'appearance';
const densityStorageKey = 'interface-density';
const reduceMotionStorageKey = 'reduce-motion';
const reducedMotionStyleId = 'thermasnap-reduced-motion';

const listeners = new Set<() => void>();
const supportedDensities: InterfaceDensity[] = [
    'comfortable',
    'balanced',
    'compact',
];

let currentAppearance: Appearance = DEFAULT_APPEARANCE_PREFERENCES.appearance;
let currentDensity: InterfaceDensity = DEFAULT_APPEARANCE_PREFERENCES.density;
let currentReduceMotion = DEFAULT_APPEARANCE_PREFERENCES.reduceMotion;
let initialized = false;

/**
 * Detect whether the operating system currently requests dark appearance.
 */
function prefersDark(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Detect whether the operating system currently requests reduced motion.
 */
function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Persist one small SSR-relevant UI value in a first-party cookie.
 */
function setCookie(name: string, value: string, days = 365): void {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;

    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
}

/**
 * Read and validate the persisted theme preference.
 */
function getStoredAppearance(): Appearance {
    if (typeof window === 'undefined') {
        return DEFAULT_APPEARANCE_PREFERENCES.appearance;
    }

    const value = localStorage.getItem(appearanceStorageKey);

    return value === 'light' || value === 'dark' || value === 'system'
        ? value
        : DEFAULT_APPEARANCE_PREFERENCES.appearance;
}

/**
 * Read and validate the persisted interface density preference.
 */
function getStoredDensity(): InterfaceDensity {
    if (typeof window === 'undefined') {
        return DEFAULT_APPEARANCE_PREFERENCES.density;
    }

    const value = localStorage.getItem(densityStorageKey);

    return supportedDensities.includes(value as InterfaceDensity)
        ? (value as InterfaceDensity)
        : DEFAULT_APPEARANCE_PREFERENCES.density;
}

/**
 * Read the persisted explicit reduce-motion preference.
 */
function getStoredReduceMotion(): boolean {
    if (typeof window === 'undefined') {
        return DEFAULT_APPEARANCE_PREFERENCES.reduceMotion;
    }

    return localStorage.getItem(reduceMotionStorageKey) === 'true';
}

/**
 * Resolve light, dark, or system theme to the actual palette that should render.
 */
export function resolveAppearance(appearance: Appearance): ResolvedAppearance {
    return appearance === 'dark' || (appearance === 'system' && prefersDark())
        ? 'dark'
        : 'light';
}

/**
 * Apply the resolved theme to the document root.
 */
function applyTheme(appearance: Appearance): void {
    if (typeof document === 'undefined') {
        return;
    }

    const resolvedAppearance = resolveAppearance(appearance);
    const dark = resolvedAppearance === 'dark';

    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * Expose the persisted density on the root element for reusable responsive
 * surfaces without creating another component-level state system.
 */
function applyDensity(density: InterfaceDensity): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.density = density;
}

/**
 * Apply reduced-motion behavior when either ThermaSnap or the operating system
 * requests it.
 */
function applyReducedMotion(reduceMotion: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    const shouldReduceMotion = reduceMotion || prefersReducedMotion();
    let style = document.getElementById(
        reducedMotionStyleId,
    ) as HTMLStyleElement | null;

    document.documentElement.dataset.reduceMotion = shouldReduceMotion
        ? 'true'
        : 'false';

    if (!shouldReduceMotion) {
        style?.remove();

        return;
    }

    if (style === null) {
        style = document.createElement('style');
        style.id = reducedMotionStyleId;
        document.head.appendChild(style);
    }

    style.textContent = `
        html {
            scroll-behavior: auto !important;
        }

        *,
        *::before,
        *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0ms !important;
        }
    `;
}

/**
 * Apply all currently persisted appearance preferences to the document.
 */
function applyPreferences(): void {
    applyTheme(currentAppearance);
    applyDensity(currentDensity);
    applyReducedMotion(currentReduceMotion);
}

/**
 * Subscribe one React consumer to appearance preference changes.
 */
function subscribe(callback: () => void): () => void {
    listeners.add(callback);

    return () => {
        listeners.delete(callback);
    };
}

/**
 * Notify subscribed React consumers after a persisted preference changes.
 */
function notify(): void {
    listeners.forEach((listener) => listener());
}

/**
 * Return the browser color-scheme media query when browser APIs are available.
 */
function colorSchemeMediaQuery(): MediaQueryList | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
}

/**
 * Return the browser reduced-motion media query when browser APIs are available.
 */
function reducedMotionMediaQuery(): MediaQueryList | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)');
}

/**
 * Reapply system-controlled theme state when the operating system changes.
 */
function handleSystemThemeChange(): void {
    applyTheme(currentAppearance);
    notify();
}

/**
 * Reapply effective motion state when the operating system preference changes.
 */
function handleSystemMotionChange(): void {
    applyReducedMotion(currentReduceMotion);
    notify();
}

/**
 * Initialize all persisted appearance preferences before normal application use.
 */
export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    if (!localStorage.getItem(appearanceStorageKey)) {
        localStorage.setItem(
            appearanceStorageKey,
            DEFAULT_APPEARANCE_PREFERENCES.appearance,
        );
        setCookie(
            appearanceStorageKey,
            DEFAULT_APPEARANCE_PREFERENCES.appearance,
        );
    }

    if (!localStorage.getItem(densityStorageKey)) {
        localStorage.setItem(
            densityStorageKey,
            DEFAULT_APPEARANCE_PREFERENCES.density,
        );
    }

    if (!localStorage.getItem(reduceMotionStorageKey)) {
        localStorage.setItem(
            reduceMotionStorageKey,
            String(DEFAULT_APPEARANCE_PREFERENCES.reduceMotion),
        );
    }

    currentAppearance = getStoredAppearance();
    currentDensity = getStoredDensity();
    currentReduceMotion = getStoredReduceMotion();

    applyPreferences();

    if (!initialized) {
        colorSchemeMediaQuery()?.addEventListener(
            'change',
            handleSystemThemeChange,
        );
        reducedMotionMediaQuery()?.addEventListener(
            'change',
            handleSystemMotionChange,
        );
        initialized = true;
    }
}

/**
 * Expose persisted appearance preferences and their mutation boundary to React.
 */
export function useAppearance(): UseAppearanceReturn {
    const appearance: Appearance = useSyncExternalStore(
        subscribe,
        () => currentAppearance,
        () => DEFAULT_APPEARANCE_PREFERENCES.appearance,
    );

    const density: InterfaceDensity = useSyncExternalStore(
        subscribe,
        () => currentDensity,
        () => DEFAULT_APPEARANCE_PREFERENCES.density,
    );

    const reduceMotion = useSyncExternalStore(
        subscribe,
        () => currentReduceMotion,
        () => DEFAULT_APPEARANCE_PREFERENCES.reduceMotion,
    );

    const resolvedAppearance = resolveAppearance(appearance);

    /**
     * Persist and apply one complete appearance-preference snapshot.
     */
    const updatePreferences = (preferences: AppearancePreferences): void => {
        currentAppearance = preferences.appearance;
        currentDensity = preferences.density;
        currentReduceMotion = preferences.reduceMotion;

        localStorage.setItem(appearanceStorageKey, preferences.appearance);
        localStorage.setItem(densityStorageKey, preferences.density);
        localStorage.setItem(
            reduceMotionStorageKey,
            String(preferences.reduceMotion),
        );

        setCookie(appearanceStorageKey, preferences.appearance);

        applyPreferences();
        notify();
    };

    /**
     * Preserve the existing theme-only mutation API for current consumers.
     */
    const updateAppearance = (mode: Appearance): void => {
        updatePreferences({
            appearance: mode,
            density: currentDensity,
            reduceMotion: currentReduceMotion,
        });
    };

    return {
        appearance,
        resolvedAppearance,
        density,
        reduceMotion,
        updateAppearance,
        updatePreferences,
    } as const;
}
