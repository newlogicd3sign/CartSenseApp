// types/family.ts

import { Timestamp } from "firebase/firestore";

export type DoctorDietInstructions = {
    hasActiveNote?: boolean;
    sourceType?: "photo" | "manual";
    summaryText?: string;
    blockedIngredients?: string[];
    blockedGroups?: string[];
    updatedAt?: Timestamp;
};

export type FamilyMember = {
    id: string;
    name: string;
    isActive: boolean; // When false, excluded from meal generation
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    dislikedFoods?: string[];
    dietRestrictions?: DoctorDietInstructions;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};
