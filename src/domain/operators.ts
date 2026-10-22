export interface OperatorBrand {
  id: string;
  operatorName: string;
  primaryColor: string;
  logoUrl: string;
  /** Donation take rate as a fraction. 0.05 is 5%. */
  customFeeRate: number;
  /** White-label persona the campaign agent speaks as. */
  assistant: {
    name: string;
    greeting: string;
    /** Web Speech voice shaping so each vendor's agent sounds distinct. */
    voice: { rate: number; pitch: number };
  };
}

function logo(letter: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="42" text-anchor="middle" font-family="Arial" font-size="32" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const OPERATORS: OperatorBrand[] = [
  {
    id: "apex",
    operatorName: "Apex Youth Sports",
    primaryColor: "#064e38",
    logoUrl: logo("A", "#064e38"),
    customFeeRate: 0.05,
    assistant: {
      name: "Ace",
      greeting:
        "Hi, I'm Ace, the Apex campaign assistant. Tell me about your season and I'll set up the fundraiser. For example: Lincoln volleyball, 18 players, March 1 to April 15.",
      voice: { rate: 1, pitch: 1 },
    },
  },
  {
    id: "victory",
    operatorName: "Victory Fundraising",
    primaryColor: "#9a3412",
    logoUrl: logo("V", "#9a3412"),
    customFeeRate: 0.09,
    assistant: {
      name: "Vic",
      greeting:
        "Hey coach, Vic here from Victory Fundraising. Give me the sport, how many players, and when you want to run it, and I'll build the campaign.",
      voice: { rate: 1.05, pitch: 0.85 },
    },
  },
];

export function feeRateToBps(rate: number): number {
  return Math.round(rate * 10_000);
}

export function findOperator(id: string): OperatorBrand {
  return OPERATORS.find((operator) => operator.id === id) ?? OPERATORS[0];
}
