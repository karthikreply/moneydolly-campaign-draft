const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const NUMBER_WORD =
  "(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|zero|one|two|three|four|five|six|seven|eight|nine)";

export function wordsToNumber(phrase: string): number {
  const cleaned = phrase.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned in TEENS) return TEENS[cleaned];
  if (cleaned in ONES) return ONES[cleaned];
  const [ten, one] = cleaned.split(" ");
  if (ten in TENS && !one) return TENS[ten];
  if (ten in TENS && one in ONES) return TENS[ten] + ONES[one];
  throw new Error(`Unparsed number words: ${phrase}`);
}

/** Deterministic rewrite. "twenty five dollars" becomes "$25". Other number words become digits. */
export function normalizeNumberWords(input: string): string {
  const withMoney = input.replace(
    new RegExp(String.raw`\b(${NUMBER_WORD})\s+dollars?\b`, "gi"),
    (_full, words: string) => `$${wordsToNumber(words)}`,
  );
  return withMoney.replace(new RegExp(String.raw`\b${NUMBER_WORD}\b`, "gi"), (words) =>
    String(wordsToNumber(words)),
  );
}
