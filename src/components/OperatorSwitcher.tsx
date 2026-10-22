"use client";

import { useOperator } from "./OperatorProvider";

export function OperatorSwitcher() {
  const { operator, operators, selectOperator } = useOperator();
  const fee = `${Math.round(operator.customFeeRate * 1000) / 10}%`;

  return (
    <div className="operator-switcher">
      <label className="operator-select" htmlFor="operator">
        <span className="sr-only-inline">Operator</span>
        <select
          id="operator"
          aria-label="Operator"
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
      <span className="operator-fee" title="Donation take rate">
        fee {fee}
      </span>
    </div>
  );
}
