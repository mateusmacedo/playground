import { cilLockLocked } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

export interface BlockedBadgeProps {
  readonly className?: string;
}

/** Selo do card que tem bloqueador fora da coluna de conclusão, igual no quadro e na lista. */
export function BlockedBadge({ className }: Readonly<BlockedBadgeProps>) {
  const classes = ['badge', 'text-bg-danger'];
  if (className) {
    classes.push(className);
  }
  return (
    <span className={classes.join(' ')}>
      <CIcon
        icon={cilLockLocked}
        size="sm"
        className="me-1"
        aria-hidden="true"
      />
      Bloqueado
    </span>
  );
}
