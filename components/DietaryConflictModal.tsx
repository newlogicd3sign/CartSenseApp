"use client";

import { AlertTriangle, ShieldAlert, X, HeartPulse, Utensils, Users } from "lucide-react";
import type { ConflictResult } from "@/lib/sensitivityMapping";

interface DietaryConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProceed: () => void;
    conflicts: ConflictResult["conflicts"];
    prompt: string;
}

// Helper to format person attribution
function formatPerson(person?: string): string {
    return person ? `${person}'s` : "your";
}

export function DietaryConflictModal({
    isOpen,
    onClose,
    onProceed,
    conflicts,
    prompt,
}: DietaryConflictModalProps) {
    if (!isOpen) return null;

    const allergyConflicts = conflicts.filter(c => c.type === "allergy");
    const customRestrictionConflicts = conflicts.filter(c => c.type === "diet_restricted");
    const sensitivityConflicts = conflicts.filter(c => c.type === "sensitivity");
    const dietConflicts = conflicts.filter(c => c.type === "diet");
    const dislikeConflicts = conflicts.filter(c => c.type === "dislike");

    const hasAllergies = allergyConflicts.length > 0;
    const hasCustomRestrictions = customRestrictionConflicts.length > 0;
    const hasCritical = hasAllergies || hasCustomRestrictions;

    // Check if any family members are affected
    const hasFamilyMemberConflicts = conflicts.some(c => c.person !== undefined);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md bg-white rounded-2xl p-6 animate-scale-up shadow-xl max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>

                {/* Header */}
                <div className="text-center mb-5">
                    <div className={`w-14 h-14 ${hasCritical ? "bg-red-100" : "bg-amber-100"} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        {hasFamilyMemberConflicts ? (
                            <Users className={`w-7 h-7 ${hasCritical ? "text-red-600" : "text-amber-600"}`} />
                        ) : hasCritical ? (
                            <ShieldAlert className="w-7 h-7 text-red-600" />
                        ) : (
                            <AlertTriangle className="w-7 h-7 text-amber-600" />
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {hasCritical ? "Dietary Restriction Alert" : "Heads Up!"}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Your request may conflict with {hasFamilyMemberConflicts ? "household" : "your"} dietary settings
                    </p>
                </div>

                {/* Prompt Preview */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    <p className="text-sm text-gray-600 italic">&ldquo;{prompt}&rdquo;</p>
                </div>

                {/* Conflicts List */}
                <div className="space-y-3 mb-6">
                    {/* Allergy Conflicts - Most Critical */}
                    {allergyConflicts.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldAlert className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-800">Allergy Warning</span>
                            </div>
                            <ul className="space-y-1">
                                {allergyConflicts.map((conflict, i) => (
                                    <li key={i} className="text-sm text-red-700">
                                        <span className="font-medium">&ldquo;{conflict.matchedKeyword}&rdquo;</span>
                                        {" "}conflicts with {formatPerson(conflict.person)}{" "}
                                        <span className="font-medium">{conflict.restriction}</span> allergy
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Custom Diet Restrictions */}
                    {customRestrictionConflicts.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <HeartPulse className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-800">Diet Restriction</span>
                            </div>
                            <ul className="space-y-1">
                                {customRestrictionConflicts.map((conflict, i) => (
                                    <li key={i} className="text-sm text-red-700">
                                        <span className="font-medium">&ldquo;{conflict.matchedKeyword}&rdquo;</span>
                                        {" "}is restricted by {formatPerson(conflict.person)} diet instructions
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Sensitivity Conflicts */}
                    {sensitivityConflicts.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-medium text-amber-800">Sensitivity Notice</span>
                            </div>
                            <ul className="space-y-1">
                                {sensitivityConflicts.map((conflict, i) => (
                                    <li key={i} className="text-sm text-amber-700">
                                        <span className="font-medium">&ldquo;{conflict.matchedKeyword}&rdquo;</span>
                                        {" "}may trigger {formatPerson(conflict.person)}{" "}
                                        <span className="font-medium">{conflict.restriction}</span> sensitivity
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Diet Conflicts */}
                    {dietConflicts.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Utensils className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">Diet Conflict</span>
                            </div>
                            <ul className="space-y-1">
                                {dietConflicts.map((conflict, i) => (
                                    <li key={i} className="text-sm text-blue-700">
                                        <span className="font-medium">&ldquo;{conflict.matchedKeyword}&rdquo;</span>
                                        {" "}doesn&apos;t align with {formatPerson(conflict.person)}{" "}
                                        <span className="font-medium">{conflict.restriction}</span> diet
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Dislike Conflicts */}
                    {dislikeConflicts.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-800">Disliked Food</span>
                            </div>
                            <ul className="space-y-1">
                                {dislikeConflicts.map((conflict, i) => (
                                    <li key={i} className="text-sm text-gray-700">
                                        <span className="font-medium">&ldquo;{conflict.matchedKeyword}&rdquo;</span>
                                        {" "}is on {formatPerson(conflict.person)} dislike list
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                        Modify Request
                    </button>
                    <button
                        onClick={onProceed}
                        className={`flex-1 py-3 rounded-xl font-medium transition-colors ${hasCritical
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-amber-500 hover:bg-amber-600 text-white"
                            }`}
                    >
                        Proceed Anyway
                    </button>
                </div>

                {/* Disclaimer for critical conflicts */}
                {hasCritical && (
                    <p className="text-xs text-center text-gray-400 mt-4">
                        Proceeding may result in meals that don&apos;t meet {hasFamilyMemberConflicts ? "household" : "your"} dietary requirements
                    </p>
                )}
            </div>
        </div>
    );
}
