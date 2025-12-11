"use client";

import { type ReactNode } from "react";
import { Flame, Beef, Wheat, Droplet, ChevronRight } from "lucide-react";

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
    onClick: () => void;
    badge?: ReactNode;
    actionButton?: ReactNode;
    animationDelay?: number;
    className?: string;
}

export function MealCard({
    name,
    description,
    mealType,
    macros,
    imageUrl,
    onClick,
    badge,
    actionButton,
    animationDelay,
    className = "",
}: MealCardProps) {
    const thumbSrc = imageUrl ?? "https://placehold.co/256x256/e5e7eb/9ca3af?text=Meal";

    return (
        <div
            className={`relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex p-4 gap-4 ${animationDelay !== undefined ? "animate-fade-slide-in" : ""} ${className}`}
            style={
                animationDelay !== undefined
                    ? { animationDelay: `${animationDelay}ms`, animationFillMode: "backwards" }
                    : undefined
            }
        >
            {/* Action button slot (e.g., delete button) - Top Right */}
            {actionButton && (
                <div className="absolute top-2 right-2">
                    {actionButton}
                </div>
            )}

            {/* Thumbnail - Left */}
            <div
                onClick={onClick}
                className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={thumbSrc}
                    alt={name}
                    className="w-full h-full object-cover transition-opacity duration-300"
                />
            </div>

            {/* Content - Right */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize">
                        {mealType}
                    </span>
                    {badge}
                </div>
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
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        <span>{macros.calories}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Beef className="w-3 h-3 text-blue-500" />
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

                {/* View Button */}
                <button
                    onClick={onClick}
                    className="inline-flex items-center gap-0.5 px-2 py-1 bg-[#4A90E2]/10 text-[#4A90E2] text-[10px] font-medium rounded-lg hover:bg-[#4A90E2]/20 transition-colors w-fit whitespace-nowrap"
                >
                    <span>View</span>
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
