"use client";

import { type ReactNode } from "react";
import { Flame, Beef, Wheat, Droplet, ChevronRight, Clock, Bean } from "lucide-react";
import { MealImage } from "./MealImage";

interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
}

interface MealCardProps {
    id: string;
    name: string;
    description: string;
    mealType: string;
    macros: Macros;
    imageUrl?: string;
    cookTimeRange?: {
        min: number;
        max: number;
    };
    onClick: () => void;
    badge?: ReactNode;
    actionButton?: ReactNode;
    bottomActions?: ReactNode;
    inlineActions?: ReactNode;
    animationDelay?: number;
    className?: string;
    dietType?: string;
    isPremium?: boolean;
    dietBadges?: string[];
    estimatedCost?: number;
}

export function MealCard({
    name,
    description,
    mealType,
    macros,
    imageUrl,
    cookTimeRange,
    onClick,
    badge,
    actionButton,
    bottomActions,
    inlineActions,
    animationDelay,
    className = "",
    dietType,
    isPremium = false,
    dietBadges = [],
    estimatedCost,
}: MealCardProps) {

    return (
        <div
            className={`relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col ${animationDelay !== undefined ? "animate-fade-slide-in" : ""} ${className}`}
            style={
                animationDelay !== undefined
                    ? { animationDelay: `${animationDelay}ms`, animationFillMode: "backwards" }
                    : undefined
            }
        >
            {/* Top Row: Image & Content */}
            <div className="flex p-4 gap-4">
                {/* Action button slot (e.g., delete button) - Top Right */}
                {actionButton && (
                    <div className="absolute top-2 right-2 z-10">
                        {actionButton}
                    </div>
                )}

                {/* Thumbnail - Left */}
                <div
                    onClick={onClick}
                    className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer flex-shrink-0"
                >
                    <MealImage
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full"
                        isPremium={isPremium}
                    />
                </div>

                {/* Content - Right */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* First row: meal type, cook time, price - with right margin for action button */}
                    <div className="flex items-center gap-2 mb-1 mr-10 flex-wrap">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize flex-shrink-0">
                            {mealType}
                        </span>
                        {cookTimeRange && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-full flex-shrink-0">
                                <Clock className="w-3 h-3 text-sky-600" />
                                <span className="text-[10px] font-medium text-sky-700">{cookTimeRange.min}-{cookTimeRange.max}m</span>
                            </div>
                        )}
                        {badge && <div className="flex-shrink-0">{badge}</div>}
                    </div>
                    {/* Second row: Diet badges (limit to 2) */}
                    {dietBadges.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-1">
                            {dietBadges.slice(0, 2).map((diet) => (
                                <span
                                    key={diet}
                                    className="inline-block px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-full text-[10px] font-medium text-pink-700 capitalize"
                                >
                                    {diet}
                                </span>
                            ))}
                            {dietBadges.length > 2 && (
                                <span className="text-[10px] text-gray-500">+{dietBadges.length - 2} more</span>
                            )}
                        </div>
                    )}
                    <h2
                        onClick={onClick}
                        className="text-base font-medium text-gray-900 mb-1 cursor-pointer hover:text-[#4A90E2] transition-colors"
                    >
                        {name}
                    </h2>
                    <p className="text-sm text-gray-500 mb-2">
                        {description}
                    </p>

                    {/* Macros */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-500" />
                            <span>{macros.calories}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {(dietType === "vegetarian" || dietType === "vegan") ? (
                                <Bean className="w-3 h-3 text-emerald-500" />
                            ) : (
                                <Beef className="w-3 h-3 text-blue-500" />
                            )}
                            <span>{macros.protein}g</span>
                        </div>
                        <div className="flex items-center gap-1" title={`${macros.carbs}g total carbs - ${macros.fiber ?? 0}g fiber`}>
                            <Wheat className="w-3 h-3 text-amber-500" />
                            <span>{Math.max(0, macros.carbs - (macros.fiber ?? 0))}g net</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Droplet className="w-3 h-3 text-purple-500" />
                            <span>{macros.fat}g</span>
                        </div>
                    </div>

                    {/* Default View Button (Only if no bottom actions) */}
                    {!bottomActions && (
                        <div className="mt-3 flex items-center gap-2">
                            <button
                                onClick={onClick}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#4A90E2]/10 text-[#4A90E2] text-xs font-medium rounded-lg hover:bg-[#4A90E2]/20 transition-colors w-fit whitespace-nowrap"
                            >
                                <span>View</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            {inlineActions}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions Footer (Full Width) */}
            {bottomActions && (
                <div className="px-4 pb-4 w-full">
                    {bottomActions}
                </div>
            )}
        </div>
    );
}
