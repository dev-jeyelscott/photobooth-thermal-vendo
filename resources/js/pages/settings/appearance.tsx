import { Head, setLayoutProps } from '@inertiajs/react';
import { LayoutDashboard, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import AppearanceTabs from '@/components/appearance-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useSidebar } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import {
    DEFAULT_APPEARANCE_PREFERENCES,
    resolveAppearance,
    useAppearance,
} from '@/hooks/use-appearance';
import type { Appearance, InterfaceDensity } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';

type AppearanceDraft = {
    appearance: Appearance;
    density: InterfaceDensity;
    reduceMotion: boolean;
    compactNavigation: boolean;
};

const densityOptions: {
    value: InterfaceDensity;
    label: string;
    description: string;
}[] = [
    {
        value: 'comfortable',
        label: 'Comfortable',
        description: 'More space',
    },
    {
        value: 'balanced',
        label: 'Balanced',
        description: 'Default',
    },
    {
        value: 'compact',
        label: 'Compact',
        description: 'More content',
    },
];

/**
 * Render keyboard-accessible interface-density options.
 */
function DensitySelector({
    value,
    onValueChange,
}: {
    value: InterfaceDensity;
    onValueChange: (value: InterfaceDensity) => void;
}) {
    return (
        <div
            role="radiogroup"
            aria-label="Interface density"
            className="grid overflow-hidden rounded-lg border sm:grid-cols-3"
        >
            {densityOptions.map((option) => {
                const selected = value === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${option.label} density`}
                        onClick={() => onValueChange(option.value)}
                        className={cn(
                            'min-h-20 border-b px-5 py-4 text-center transition-colors last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0',
                            selected
                                ? 'bg-primary/5 text-primary ring-1 ring-primary ring-inset'
                                : 'hover:bg-muted/40',
                        )}
                    >
                        <span className="block text-sm font-semibold">
                            {option.label}
                        </span>
                        <span className="mt-1 block text-caption text-muted-foreground">
                            {option.description}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Render one switch-based preference row with an explicit accessible label.
 */
function PreferenceRow({
    id,
    title,
    description,
    checked,
    onCheckedChange,
}: {
    id: string;
    title: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Label htmlFor={id} className="text-section-title">
                        {title}
                    </Label>
                    <p className="mt-1 text-body text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <Switch
                        id={id}
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                    />
                    <span className="text-sm text-muted-foreground">
                        {checked ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Render a clearly labelled synthetic ThermaSnap shell that reflects draft
 * theme, density, and compact-navigation settings.
 */
function LivePreview({ draft }: { draft: AppearanceDraft }) {
    const resolvedAppearance = resolveAppearance(draft.appearance);

    const densityClasses = {
        comfortable: {
            shell: 'gap-4 p-4',
            card: 'p-4',
        },
        balanced: {
            shell: 'gap-3 p-3',
            card: 'p-3',
        },
        compact: {
            shell: 'gap-2 p-2',
            card: 'p-2',
        },
    }[draft.density];

    return (
        <div className={cn(resolvedAppearance === 'dark' && 'dark')}>
            <div className="overflow-hidden rounded-xl border bg-background text-foreground shadow-xs">
                <div className="flex h-9 items-center gap-2 border-b px-3">
                    <span className="size-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-semibold text-primary">
                        ThermaSnap
                    </span>
                    <span className="ml-auto text-[9px] text-muted-foreground">
                        Sample preview
                    </span>
                </div>

                <div className="flex min-h-56">
                    <aside
                        className={cn(
                            'border-r bg-sidebar p-2 transition-[width]',
                            draft.compactNavigation ? 'w-10' : 'w-24',
                        )}
                    >
                        <LayoutDashboard
                            aria-hidden="true"
                            className="size-4 text-sidebar-foreground"
                        />

                        {!draft.compactNavigation && (
                            <p className="mt-2 text-[9px] font-medium">
                                Dashboard
                            </p>
                        )}
                    </aside>

                    <div
                        className={cn(
                            'grid flex-1 content-start',
                            densityClasses.shell,
                        )}
                    >
                        <div className="text-[10px] font-semibold">
                            Sample Dashboard
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ['Sessions', '128'],
                                ['Revenue', '₱24,680'],
                                ['Booths', '3'],
                                ['Prints', '986'],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    className={cn(
                                        'rounded-md border bg-card',
                                        densityClasses.card,
                                    )}
                                >
                                    <p className="text-[8px] text-muted-foreground">
                                        Sample {label}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Render appearance settings using draft state so changes are persisted only
 * when the operator explicitly selects Save changes.
 */
export default function Appearance() {
    const { appearance, density, reduceMotion, updatePreferences } =
        useAppearance();

    const { state: sidebarState, setOpen } = useSidebar();

    const [draft, setDraft] = useState<AppearanceDraft>(() => ({
        appearance,
        density,
        reduceMotion,
        compactNavigation: sidebarState === 'collapsed',
    }));

    const persistedCompactNavigation = sidebarState === 'collapsed';

    const isDirty =
        draft.appearance !== appearance ||
        draft.density !== density ||
        draft.reduceMotion !== reduceMotion ||
        draft.compactNavigation !== persistedCompactNavigation;

    /**
     * Persist the draft preference snapshot and use the existing sidebar
     * provider to persist compact-navigation state.
     */
    const saveChanges = (): void => {
        updatePreferences({
            appearance: draft.appearance,
            density: draft.density,
            reduceMotion: draft.reduceMotion,
        });

        setOpen(!draft.compactNavigation);
    };

    /**
     * Restore the page draft to the currently persisted preference state.
     */
    const cancelChanges = (): void => {
        setDraft({
            appearance,
            density,
            reduceMotion,
            compactNavigation: sidebarState === 'collapsed',
        });
    };

    /**
     * Restore deterministic ThermaSnap appearance defaults in draft state.
     */
    const resetToDefaults = (): void => {
        setDraft({
            ...DEFAULT_APPEARANCE_PREFERENCES,
            compactNavigation: false,
        });
    };

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Appearance settings',
                href: editAppearance(),
            },
        ],
    });

    return (
        <>
            <Head title="Appearance settings" />

            <main className="p-4 lg:p-6">
                <div className="mx-auto w-full max-w-content">
                    <header className="mb-6">
                        <h1 className="text-display">Appearance Settings</h1>
                        <p className="mt-2 text-body text-muted-foreground">
                            Customize how ThermaSnap looks and behaves for your
                            account.
                        </p>
                    </header>

                    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                        <div className="space-y-4">
                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Theme Preference
                                    </h2>
                                    <p className="mt-1 text-body text-muted-foreground">
                                        Choose the color theme for the
                                        ThermaSnap interface.
                                    </p>
                                </CardHeader>

                                <CardContent className="p-5">
                                    <AppearanceTabs
                                        value={draft.appearance}
                                        onValueChange={(nextAppearance) =>
                                            setDraft((current) => ({
                                                ...current,
                                                appearance: nextAppearance,
                                            }))
                                        }
                                    />
                                </CardContent>
                            </Card>

                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Interface Density
                                    </h2>
                                    <p className="mt-1 text-body text-muted-foreground">
                                        Select the layout scale and spacing for
                                        account-setting content.
                                    </p>
                                </CardHeader>

                                <CardContent className="p-5">
                                    <DensitySelector
                                        value={draft.density}
                                        onValueChange={(nextDensity) =>
                                            setDraft((current) => ({
                                                ...current,
                                                density: nextDensity,
                                            }))
                                        }
                                    />
                                </CardContent>
                            </Card>

                            <PreferenceRow
                                id="reduce-motion"
                                title="Reduce Motion"
                                description="Minimize non-essential animations and transitions while continuing to respect your operating-system preference."
                                checked={draft.reduceMotion}
                                onCheckedChange={(checked) =>
                                    setDraft((current) => ({
                                        ...current,
                                        reduceMotion: checked,
                                    }))
                                }
                            />

                            <PreferenceRow
                                id="compact-navigation"
                                title="Compact Navigation"
                                description="Collapse the existing ThermaSnap sidebar while preserving its normal manual toggle."
                                checked={draft.compactNavigation}
                                onCheckedChange={(checked) =>
                                    setDraft((current) => ({
                                        ...current,
                                        compactNavigation: checked,
                                    }))
                                }
                            />

                            <div className="flex flex-wrap gap-3 pt-1">
                                <Button
                                    type="button"
                                    size="lg"
                                    disabled={!isDirty}
                                    onClick={saveChanges}
                                >
                                    <Save
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                    Save changes
                                </Button>

                                <Button
                                    type="button"
                                    size="lg"
                                    variant="outline"
                                    disabled={!isDirty}
                                    onClick={cancelChanges}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>

                        <aside className="space-y-4">
                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Live Preview
                                    </h2>
                                    <p className="mt-1 text-caption text-muted-foreground">
                                        Sample content only. No production
                                        dashboard data is shown here.
                                    </p>
                                </CardHeader>

                                <CardContent className="p-5">
                                    <LivePreview draft={draft} />
                                </CardContent>
                            </Card>

                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Appearance defaults
                                    </h2>
                                </CardHeader>

                                <CardContent className="grid gap-4 p-5">
                                    <p className="text-body text-muted-foreground">
                                        Defaults are System theme, Balanced
                                        density, normal motion, and expanded
                                        navigation.
                                    </p>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resetToDefaults}
                                    >
                                        <RotateCcw
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                        Reset to Defaults
                                    </Button>
                                </CardContent>
                            </Card>
                        </aside>
                    </div>
                </div>
            </main>
        </>
    );
}
