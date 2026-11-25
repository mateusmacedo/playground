import { cilWarning } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { BlockKind } from '../model/blocks';
import type { ProcessIssue } from '../model/issues';

export interface BlockClassNameParams {
  readonly kind: BlockKind;
  readonly invalid: boolean;
}

/** Classes do bloco no canvas: o tipo define a cor e o problema, a borda de alerta. */
export function blockClassName(params: BlockClassNameParams): string {
  const { kind, invalid } = params;
  const base = `process-block process-block--${kind}`;
  return invalid ? `${base} process-block--invalid` : base;
}

export interface IssueMarkerProps {
  readonly issues: readonly ProcessIssue[];
}

/** Ícone de alerta no bloco, com os problemas em texto para o leitor de tela e no `title`. */
export function IssueMarker({ issues }: Readonly<IssueMarkerProps>) {
  if (issues.length === 0) {
    return null;
  }
  const text = issues.map((issue) => issue.message).join(' ');
  return (
    <span className="process-block__issue" title={text}>
      <CIcon icon={cilWarning} aria-hidden="true" />
      <span className="visually-hidden">{`Problemas: ${text}`}</span>
    </span>
  );
}
