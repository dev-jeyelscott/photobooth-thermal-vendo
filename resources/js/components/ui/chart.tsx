import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
    string,
    {
        label?: React.ReactNode;
        color?: string;
    }
>;

type ChartContextValue = {
    config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

/**
 * Returns the configuration owned by the nearest chart container.
 */
function useChart(): ChartContextValue {
    const context = React.useContext(ChartContext);

    if (!context) {
        throw new Error('useChart must be used inside a ChartContainer.');
    }

    return context;
}

type ChartContainerProps = React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ReactElement;
};

/**
 * Provides chart design tokens and a responsive Recharts measurement boundary.
 */
function ChartContainer({
    config,
    children,
    className,
    style,
    ...props
}: ChartContainerProps) {
    const chartVariables = Object.entries(config).reduce<Record<string, string>>(
        (variables, [key, item]) => {
            if (item.color) {
                variables[`--color-${key}`] = item.color;
            }

            return variables;
        },
        {},
    );

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                className={cn(
                    'flex min-h-[200px] w-full justify-center text-xs',
                    '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
                    '[&_.recharts-cartesian-grid_line]:stroke-border/60',
                    '[&_.recharts-sector]:outline-none',
                    '[&_.recharts-surface]:outline-none',
                    className,
                )}
                style={
                    {
                        ...chartVariables,
                        ...style,
                    } as React.CSSProperties
                }
                {...props}
            >
                <RechartsPrimitive.ResponsiveContainer
                    width="100%"
                    height="100%"
                >
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

type TooltipPayloadItem = {
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: unknown;
};

type ChartTooltipContentProps = React.ComponentProps<'div'> & {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: React.ReactNode;
    hideLabel?: boolean;
    formatter?: (
        value: unknown,
        name: string,
        item: TooltipPayloadItem,
        index: number,
    ) => React.ReactNode;
};

/**
 * Renders a small theme-aware tooltip for Recharts data points.
 */
function ChartTooltipContent({
    active,
    payload,
    label,
    hideLabel = false,
    formatter,
    className,
}: ChartTooltipContentProps) {
    const { config } = useChart();

    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div
            className={cn(
                'grid min-w-36 gap-2 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md',
                className,
            )}
        >
            {!hideLabel && label && (
                <div className="font-medium">{label}</div>
            )}

            <div className="grid gap-1.5">
                {payload.map((item, index) => {
                    const key = String(item.dataKey ?? item.name ?? index);
                    const configItem = config[key];
                    const itemLabel = configItem?.label ?? item.name ?? key;
                    const color =
                        item.color ??
                        configItem?.color ??
                        'var(--muted-foreground)';

                    return (
                        <div
                            key={`${key}-${index}`}
                            className="flex items-center justify-between gap-4"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="truncate text-muted-foreground">
                                    {itemLabel}
                                </span>
                            </div>

                            <div className="shrink-0 font-medium tabular-nums">
                                {formatter
                                    ? formatter(
                                          item.value,
                                          key,
                                          item,
                                          index,
                                      )
                                    : String(item.value ?? '')}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

export { ChartContainer, ChartTooltip, ChartTooltipContent };
