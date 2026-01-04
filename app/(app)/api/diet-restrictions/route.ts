// app/api/diet-restrictions/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type DoctorNoteParsed = {
    blockedIngredients: string[];
    blockedFoodGroups: string[];
    instructionsSummary: string;
};

export async function POST(request: Request) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "Missing OPENAI_API_KEY" },
                { status: 500 }
            );
        }

        const body = await request.json();
        // Support both single image (legacy) and multiple images
        let imageDataUrls: string[] = [];

        if (body.imageDataUrls && Array.isArray(body.imageDataUrls)) {
            imageDataUrls = body.imageDataUrls.filter((url: unknown) => typeof url === "string");
        } else if (body.imageDataUrl && typeof body.imageDataUrl === "string") {
            // Legacy single image support
            imageDataUrls = [body.imageDataUrl];
        }

        if (imageDataUrls.length === 0) {
            return NextResponse.json(
                { error: "At least one image is required" },
                { status: 400 }
            );
        }

        const pageCount = imageDataUrls.length;
        const systemPrompt = `
You are a diet instruction parser.

You will be given ${pageCount === 1 ? "a PHOTO" : `${pageCount} PHOTOS (multiple pages)`} of diet instructions
(e.g., "no red meat", "limit sodium", "avoid grapefruit", "no added sugar", etc.).

Your job is to:
1. Extract specific ingredients, foods, or common packaged items that should be *avoided* from ALL provided images.
2. Group any broader patterns (e.g., "fried foods", "fast food", "high sodium", "red meat").
3. Produce a short summary of the diet instructions in plain language.
${pageCount > 1 ? "4. Combine and deduplicate information from all pages into a single cohesive result." : ""}

Return ONLY valid JSON with this shape (no extra keys):

{
  "blockedIngredients": string[],
  "blockedFoodGroups": string[],
  "instructionsSummary": string
}

- "blockedIngredients": concrete ingredients or specific foods to avoid (e.g., "bacon", "sausage", "whole milk", "soda", "butter", "cheddar cheese").
- "blockedFoodGroups": broader patterns or categories (e.g., "fried foods", "fast food", "processed meats", "high-sodium canned soups").
- "instructionsSummary": concise human-readable explanation of the diet instructions (2–4 sentences).

If there are no clear blocked ingredients, use an empty array.
If there are no clear blocked groups, use an empty array.
`;

        const userPrompt = pageCount === 1
            ? `Extract the diet restrictions and blocked foods from this diet instruction image.
Return ONLY JSON in the exact format specified in the system message.`
            : `Extract the diet restrictions and blocked foods from these ${pageCount} diet instruction images.
Combine all information from all pages into a single result. Remove any duplicates.
Return ONLY JSON in the exact format specified in the system message.`;

        // Build image content array
        const imageContent = imageDataUrls.map((url) => ({
            type: "input_image" as const,
            image_url: url,
            detail: "auto" as const,
        }));

        const response = await openai.responses.create({
            model: "gpt-4o-mini",
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: systemPrompt,
                        },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: userPrompt,
                        },
                        ...imageContent,
                    ],
                },
            ],
        });

        const firstOutput = response.output[0];

        if (!firstOutput || firstOutput.type !== "message" || !("content" in firstOutput)) {
            return NextResponse.json(
                { error: "Unexpected OpenAI response format" },
                { status: 500 }
            );
        }

        const firstContent = firstOutput.content[0];

        if (!firstContent || firstContent.type !== "output_text") {
            return NextResponse.json(
                { error: "Unexpected OpenAI response format" },
                { status: 500 }
            );
        }

        let rawText = firstContent.text;
        let parsed: DoctorNoteParsed;

        // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
        rawText = rawText.trim();
        if (rawText.startsWith("```")) {
            rawText = rawText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        }

        try {
            parsed = JSON.parse(rawText) as DoctorNoteParsed;
        } catch (err) {
            console.error("Failed to parse JSON from OpenAI:", rawText);
            return NextResponse.json(
                {
                    error: "Failed to parse JSON from model",
                    raw: rawText,
                },
                { status: 500 }
            );
        }

        // Basic validation / normalization
        parsed.blockedIngredients = Array.isArray(parsed.blockedIngredients)
            ? parsed.blockedIngredients.map((s) => String(s).trim()).filter(Boolean)
            : [];
        parsed.blockedFoodGroups = Array.isArray(parsed.blockedFoodGroups)
            ? parsed.blockedFoodGroups.map((s) => String(s).trim()).filter(Boolean)
            : [];
        parsed.instructionsSummary = String(parsed.instructionsSummary || "").trim();

        return NextResponse.json(parsed);
    } catch (error) {
        console.error("Error in /api/diet-restrictions:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
