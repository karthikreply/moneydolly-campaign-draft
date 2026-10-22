"use client";

import { useOperator } from "./OperatorProvider";

const CHAIN = ["Platform", "Organization", "Campaign", "Participant"] as const;

export function OperatorSwitcher() {
  const { operator, operators, selectOperator } = useOperator();
  const fee = `${Math.round(operator.customFeeRate * 1000) / 10}%`;

  return (
    <div className="operator-switcher">
      <p className="tenancy-chain">
        <span>{CHAIN[0]}</span>
        <span aria-hidden="true">→</span>
        <strong>{operator.operatorName}</strong>
        <span aria-hidden="true">→</span>
        <span>Lincoln Volleyball</span>
        <span aria-hidden="true">→</span>
        <span>{CHAIN[2]}</span>
        <span aria-hidden="true">→</span>
        <span>Jordan Lee</span>
      </p>
      <label className="operator-select" htmlFor="operator">
        Operator
        <select
          id="operator"
          value={operator.id}
          onChange={(event) => selectOperator(event.target.value)}
        >
          {operators.map((item) => (
            <option key={item.id} value={item.id}>
              {item.operatorName}
            </option>
          ))}
        </select>
      </label>
      <span className="operator-fee">Fee {fee}</span>
    </div>
  );
}
