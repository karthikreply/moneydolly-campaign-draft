"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { findOperator, OPERATORS, type OperatorBrand } from "@/domain/operators";

interface OperatorContextValue {
  operator: OperatorBrand;
  operators: OperatorBrand[];
  selectOperator: (id: string) => void;
}

const OperatorContext = createContext<OperatorContextValue | null>(null);

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const [operatorId, setOperatorId] = useState(OPERATORS[0].id);
  const operator = findOperator(operatorId);
  const value = useMemo(
    () => ({
      operator,
      operators: OPERATORS,
      selectOperator: setOperatorId,
    }),
    [operator],
  );

  return (
    <OperatorContext.Provider value={value}>
      <div
        className="operator-root"
        style={
          {
            "--operator-primary": operator.primaryColor,
            "--operator-logo": `url("${operator.logoUrl}")`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </OperatorContext.Provider>
  );
}

export function useOperator(): OperatorContextValue {
  const value = useContext(OperatorContext);
  if (!value) {
    throw new Error("useOperator must be used inside OperatorProvider");
  }
  return value;
}
