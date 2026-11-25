import { createContext, type ReactNode, useContext } from 'react';

import type { ProcessIssue } from './model/validation';

type IssuesByElement = ReadonlyMap<string, readonly ProcessIssue[]>;

const NO_ISSUES: readonly ProcessIssue[] = [];

const IssuesContext = createContext<IssuesByElement | null>(null);

/** Entrega aos blocos do canvas os problemas de cada um, sem guardar dado derivado no estado do React Flow. */
export function IssuesProvider({
  value,
  children,
}: Readonly<{ value: IssuesByElement; children: ReactNode }>) {
  return <IssuesContext value={value}>{children}</IssuesContext>;
}

export function useElementIssues(elementId: string): readonly ProcessIssue[] {
  const issues = useContext(IssuesContext);
  if (!issues) {
    throw new Error('useElementIssues precisa estar dentro do IssuesProvider.');
  }
  return issues.get(elementId) ?? NO_ISSUES;
}
