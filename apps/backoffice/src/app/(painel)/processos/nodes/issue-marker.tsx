import { cilInfo, cilWarning } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { BlockKind } from '../model/blocks';
import { countIssues, type ProcessIssue } from '../model/issues';

export interface BlockClassNameParams {
  readonly kind: BlockKind;
  readonly issues: readonly ProcessIssue[];
}

/** Classes do bloco no canvas: o tipo define a cor; erro e aviso, o contorno tracejado. */
export function blockClassName(params: BlockClassNameParams): string {
  const { kind, issues } = params;
  const base = `process-block process-block--${kind}`;
  const { errors, warnings } = countIssues(issues);
  if (errors > 0) {
    return `${base} process-block--invalid`;
  }
  return warnings > 0 ? `${base} process-block--warning` : base;
}

export interface IssueMarkerProps {
  readonly issues: readonly ProcessIssue[];
}

/** Ícone no bloco (alerta para erro, informação para aviso), com os problemas em texto para o leitor de tela e no `title`. */
export function IssueMarker({ issues }: Readonly<IssueMarkerProps>) {
  if (issues.length === 0) {
    return null;
  }
  const { errors } = countIssues(issues);
  const text = issues.map((issue) => issue.message).join(' ');
  const severity = errors > 0 ? 'error' : 'warning';
  return (
    <span
      className={`process-block__issue process-block__issue--${severity}`}
      title={text}
    >
      <CIcon icon={errors > 0 ? cilWarning : cilInfo} aria-hidden="true" />
      <span className="visually-hidden">{`Problemas: ${text}`}</span>
    </span>
  );
}
