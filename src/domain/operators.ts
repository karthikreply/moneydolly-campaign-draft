export interface OperatorBrand {
  id: string;
  operatorName: string;
  primaryColor: string;
  logoUrl: string;
  /** Donation take rate as a fraction. 0.05 is 5%. */
  customFeeRate: number;
}

function logo(letter: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="42" text-anchor="middle" font-family="Arial" font-size="32" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const OPERATORS: OperatorBrand[] = [
  {
    id: "apex",
    operatorName: "Apex Youth Sports",
    primaryColor: "#0b6e4f",
    logoUrl: logo("A", "#0b6e4f"),
    customFeeRate: 0.05,
  },
  {
    id: "victory",
    operatorName: "Victory Fundraising",
    primaryColor: "#9a3412",
    logoUrl: logo("V", "#9a3412"),
    customFeeRate: 0.09,
  },
];

export function feeRateToBps(rate: number): number {
  return Math.round(rate * 10_000);
}

export function findOperator(id: string): OperatorBrand {
  return OPERATORS.find((operator) => operator.id === id) ?? OPERATORS[0];
}
