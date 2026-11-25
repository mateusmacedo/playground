import { cilWarning } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { ProcessIssue } from '../model/validation';

export interface IssueListProps {
  readonly issues: readonly ProcessIssue[];
  readonly emptyText?: string;
}

/** Lista de problemas; sem problema, mostra `emptyText` quando ele vem, ou nada. */
export function IssueList({ issues, emptyText }: Readonly<IssueListProps>) {
  if (issues.length === 0) {
    return emptyText ? (
      <p className="small text-body-secondary">{emptyText}</p>
    ) : null;
  }
  return (
    <ul className="process-issue-list small">
      {issues.map((issue) => (
        <li key={issue.key}>
          <CIcon icon={cilWarning} aria-hidden="true" className="me-1" />
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
