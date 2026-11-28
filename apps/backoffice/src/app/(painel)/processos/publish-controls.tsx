import { cilCloudUpload, cilHistory } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CSpinner } from '@coreui/react';
import { useId } from 'react';

import type { PublishFeedback } from './use-publish';

export interface PublishControlsProps {
  /** Por que não dá para publicar agora; `null` quando dá. */
  readonly blocker: string | null;
  readonly publishing: boolean;
  readonly feedback: PublishFeedback | null;
  readonly versionCount: number;
  readonly onPublish: () => void;
  readonly onShowVersions: () => void;
}

/** "Publicar versão", com o motivo quando ela está desligada, e o acesso às versões já publicadas. */
export function PublishControls({
  blocker,
  publishing,
  feedback,
  versionCount,
  onPublish,
  onShowVersions,
}: Readonly<PublishControlsProps>) {
  const blockerId = useId();
  return (
    <>
      {feedback === null ? null : (
        <span
          role={feedback.tone === 'danger' ? 'alert' : 'status'}
          className={`small text-${feedback.tone}-emphasis`}
        >
          {feedback.text}
        </span>
      )}
      {blocker === null ? null : (
        <span id={blockerId} className="small text-body-secondary">
          {blocker}
        </span>
      )}
      <CButton
        color="success"
        variant="outline"
        size="sm"
        disabled={publishing || blocker !== null}
        aria-describedby={blocker === null ? undefined : blockerId}
        onClick={onPublish}
      >
        {publishing ? (
          <CSpinner size="sm" aria-hidden="true" className="me-1" />
        ) : (
          <CIcon icon={cilCloudUpload} aria-hidden="true" className="me-1" />
        )}
        Publicar versão
      </CButton>
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        disabled={versionCount === 0}
        onClick={onShowVersions}
      >
        <CIcon icon={cilHistory} aria-hidden="true" className="me-1" />
        {`Versões (${versionCount})`}
      </CButton>
    </>
  );
}
