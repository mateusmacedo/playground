import {
  cilBolt,
  cilCheckAlt,
  cilLocationPin,
  cilMediaPause,
} from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import { MARK_TEXT, type RunMark } from './run-marks';

const MARK_ICON: Readonly<Record<RunMark, string[]>> = {
  active: cilLocationPin,
  waiting: cilMediaPause,
  done: cilCheckAlt,
  raised: cilBolt,
};

export interface RunMarkBadgeProps {
  readonly mark: RunMark;
}

/** Selo da marca: o ícone e o nome dela, para a cor nunca ser o único sinal. */
export function RunMarkBadge({ mark }: Readonly<RunMarkBadgeProps>) {
  return (
    <span className={`process-run-badge process-run-badge--${mark}`}>
      <CIcon
        icon={MARK_ICON[mark]}
        aria-hidden="true"
        className="process-run-badge__icon"
      />
      {MARK_TEXT[mark]}
    </span>
  );
}
