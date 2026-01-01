/**
 * Spelling Corrections for Kroger Product Search
 * 
 * Maps common typos and variant spellings to the canonical terms used by Kroger.
 */

export const SPELLING_CORRECTIONS: Record<string, string> = {
    // Critical fix for current issue
    "schezwan": "szechuan",
    "schezuan": "szechuan",
    "sichuan": "szechuan",
    "szechwan": "szechuan",

    // Common typos
    "chineese": "chinese",
    "chiken": "chicken",
    "chikn": "chicken",
    "siracha": "sriracha",
    "parmesean": "parmesan",
    "parmigiana": "parmesan",
    "fettucini": "fettuccine",
    "yoghurt": "yogurt",
    "brussel sprouts": "brussels sprouts",
    "tumeric": "turmeric",
    "cillantro": "cilantro",
    "jalepeno": "jalapeno",
    "avacado": "avocado",
    "zuchini": "zucchini",
    "brocoli": "broccoli",
    "exra": "extra",
    "mozzerella": "mozzarella",
    "massala": "masala",
};

/**
 * Corrects spelling of a search term based on known typos.
 * Handles both full-term matches and individual word corrections.
 */
export function correctSpelling(term: string): string {
    if (!term) return term;

    const lower = term.toLowerCase().trim();

    // 1. Check if the whole term is a known typo
    if (SPELLING_CORRECTIONS[lower]) {
        return SPELLING_CORRECTIONS[lower];
    }

    // 2. Check individual words
    const words = lower.split(/\s+/);
    let changed = false;

    const correctedWords = words.map(word => {
        if (SPELLING_CORRECTIONS[word]) {
            changed = true;
            return SPELLING_CORRECTIONS[word];
        }
        return word;
    });

    if (changed) {
        return correctedWords.join(" ");
    }

    // Return original if no changes (preserves original casing if needed, though we worked on lower)
    // Actually, let's return the corrected lowercase version if changes happened, 
    // or just the original term if no changes to be safe about casing.
    return term;
}
