// app/api/doctor-note/route.ts
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
        const { imageDataUrl } = body as { imageDataUrl?: string };

        if (!imageDataUrl || typeof imageDataUrl !== "string") {
            return NextResponse.json(
                { error: "imageDataUrl (data URL) is required" },
                { status: 400 }
            );
        }

        const systemPrompt = `
You are a medical diet instruction parser.

You will be given a PHOTO of a doctor's instructions for a patient's diet
(e.g., "no red meat", "limit sodium", "avoid grapefruit", "no added sugar", etc.).

Your job is to:
1. Extract specific ingredients, foods, or common packaged items the patient should *avoid*.
2. Group any broader patterns (e.g., "fried foods", "fast food", "high sodium", "red meat").
3. Produce a short summary of the doctor's instructions in plain language.

Return ONLY valid JSON with this shape (no extra keys):

{
  "blockedIngredients": string[],
  "blockedFoodGroups": string[],
  "instructionsSummary": string
}

- "blockedIngredients": concrete ingredients or specific foods to avoid (e.g., "bacon", "sausage", "whole milk", "soda", "butter", "cheddar cheese").
- "blockedFoodGroups": broader patterns or categories (e.g., "fried foods", "fast food", "processed meats", "high-sodium canned soups").
- "instructionsSummary": concise human-readable explanation of the doctor's notes (2–4 sentences).

If there are no clear blocked ingredients, use an empty array.
If there are no clear blocked groups, use an empty array.
`;

        const userPrompt = `
Extract the diet restrictions and blocked foods from this doctor's note image.
Return ONLY JSON in the exact format specified in the system message.
`;

        const response = await openai.responses.create({
            model: "gpt-4.1-mini",
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
                        {
                            type: "input_image",
                            image_url: {
                                // data URL from client
                                url: imageDataUrl,
                            },
                        },
                    ],
                },
            ],
        });

        const firstOutput = response.output[0];
        const firstContent = firstOutput.content[0];

        if (firstContent.type !== "output_text") {
            return NextResponse.json(
                { error: "Unexpected OpenAI response format" },
                { status: 500 }
            );
        }

        const rawText = firstContent.text;
        let parsed: DoctorNoteParsed;

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
        console.error("Error in /api/doctor-note:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
