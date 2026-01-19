"use client";

import { useEffect, useState, useRef } from "react";
import { ChefHat, ShoppingCart, Clock } from "lucide-react";

// Fixed epoch: Jan 1, 2025 00:00:00 UTC
const EPOCH = new Date("2025-01-01T00:00:00Z").getTime();

type StatConfig = {
    label: string;
    icon: React.ReactNode;
    baseValue: number;
    // Growth rate per hour (average)
    growthPerHour: number;
    // Random increment range for live updates
    incrementRange: [number, number];
};

const stats: StatConfig[] = [
    {
        label: "Meals Generated",
        icon: <ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />,
        baseValue: 3847,
        growthPerHour: 2.5, // ~500 users, some generate a few meals/week
        incrementRange: [1, 2],
    },
    {
        label: "Added to Cart",
        icon: <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />,
        baseValue: 2156,
        growthPerHour: 1.5, // ~60% of meals get added to cart
        incrementRange: [0, 1],
    },
    {
        label: "Hours Saved",
        icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6" />,
        baseValue: 1923,
        growthPerHour: 1.2, // ~30 min saved per meal
        incrementRange: [0, 1],
    },
];

/**
 * Calculate the current value based on elapsed time since epoch
 * This ensures values are consistent across page refreshes and only go up
 */
function calculateCurrentValue(stat: StatConfig): number {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - EPOCH);
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Add some deterministic variation based on the hour
    // This prevents all stats from incrementing at exactly the same rate
    const hourOfDay = new Date().getUTCHours();
    const variation = 1 + (Math.sin(hourOfDay * 0.5) * 0.2); // ±20% variation

    const growth = Math.floor(elapsedHours * stat.growthPerHour * variation);
    return stat.baseValue + growth;
}

function formatNumber(num: number): string {
    return num.toLocaleString();
}

function AnimatedNumber({ value, initialValue }: { value: number; initialValue: number }) {
    const [displayValue, setDisplayValue] = useState(initialValue);
    const prevValue = useRef(initialValue);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // On first render, animate from 0 to current value (quick count-up)
        if (isFirstRender.current) {
            isFirstRender.current = false;
            const duration = 1500; // 1.5s initial animation
            const steps = 30;
            const stepDuration = duration / steps;
            const increment = value / steps;

            let currentStep = 0;
            const timer = setInterval(() => {
                currentStep++;
                if (currentStep >= steps) {
                    setDisplayValue(value);
                    prevValue.current = value;
                    clearInterval(timer);
                } else {
                    setDisplayValue(Math.round(increment * currentStep));
                }
            }, stepDuration);

            return () => clearInterval(timer);
        }

        // Subsequent updates - smooth transition
        if (value === prevValue.current) return;

        const diff = value - prevValue.current;
        const duration = 500;
        const steps = 20;
        const stepDuration = duration / steps;
        const incrementPerStep = diff / steps;

        let currentStep = 0;
        const startValue = prevValue.current;

        const timer = setInterval(() => {
            currentStep++;
            if (currentStep >= steps) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.round(startValue + incrementPerStep * currentStep));
            }
        }, stepDuration);

        prevValue.current = value;

        return () => clearInterval(timer);
    }, [value]);

    return <span>{formatNumber(displayValue)}</span>;
}

export function LiveStats() {
    // Calculate initial values based on current time
    const [values, setValues] = useState<number[]>(() =>
        stats.map((s) => calculateCurrentValue(s))
    );
    const [isVisible, setIsVisible] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle hydration - recalculate on mount to avoid SSR mismatch
    useEffect(() => {
        setValues(stats.map((s) => calculateCurrentValue(s)));
        setHasMounted(true);
    }, []);

    // Intersection observer to start live updates only when visible
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.3 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Increment values at random intervals to simulate real-time activity
    useEffect(() => {
        if (!isVisible || !hasMounted) return;

        const intervals = stats.map((stat, index) => {
            // Random interval between 3-8 seconds for each stat
            const baseInterval = 3000 + Math.random() * 5000;

            return setInterval(() => {
                const [min, max] = stat.incrementRange;
                const increment = Math.floor(Math.random() * (max - min + 1)) + min;

                if (increment > 0) {
                    setValues((prev) => {
                        const newValues = [...prev];
                        newValues[index] += increment;
                        return newValues;
                    });
                }
            }, baseInterval);
        });

        return () => intervals.forEach(clearInterval);
    }, [isVisible, hasMounted]);

    // Show placeholder during SSR/hydration to avoid mismatch
    if (!hasMounted) {
        return (
            <div ref={containerRef} className="w-full">
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 text-center"
                        >
                            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-gradient-to-br from-[#4A90E2]/10 to-[#357ABD]/10 rounded-xl flex items-center justify-center text-[#4A90E2]">
                                {stat.icon}
                            </div>
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tabular-nums">
                                0
                            </div>
                            <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-1">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-center text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">
                    Live activity from CartSense users
                </p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full">
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
                {stats.map((stat, index) => (
                    <div
                        key={stat.label}
                        className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 text-center"
                    >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-gradient-to-br from-[#4A90E2]/10 to-[#357ABD]/10 rounded-xl flex items-center justify-center text-[#4A90E2]">
                            {stat.icon}
                        </div>
                        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tabular-nums">
                            <AnimatedNumber value={values[index]} initialValue={0} />
                        </div>
                        <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-1">
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-center text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">
                Live activity from CartSense users
            </p>
        </div>
    );
}
