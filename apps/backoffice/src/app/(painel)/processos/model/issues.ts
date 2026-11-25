/** Erro impede o processo de fazer sentido; aviso aponta algo que falta para operá-lo. */
export type IssueSeverity = 'error' | 'warning';

/** Problema do processo, preso a um bloco, a uma conexão ou ao processo inteiro. */
export interface ProcessIssue {
  readonly key: string;
  readonly message: string;
  readonly severity: IssueSeverity;
  readonly nodeId?: string;
  readonly edgeId?: string;
  /** Ramo afetado, quando o problema é de um caminho que sai de uma decisão ou abertura. */
  readonly branchId?: string;
}

export interface IssueCount {
  readonly errors: number;
  readonly warnings: number;
}

export function countIssues(issues: readonly ProcessIssue[]): IssueCount {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === 'error') {
      errors += 1;
    } else {
      warnings += 1;
    }
  }
  return { errors, warnings };
}
