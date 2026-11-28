import { DraftBar } from './draft-bar';
import type { EditorDocument } from './editor-document';
import type { EditorPublication } from './publication';
import { PublishControls } from './publish-controls';
import type { DraftState } from './use-draft';
import { usePublish } from './use-publish';

interface PublishingDraftBarProps {
  readonly document: EditorDocument;
  readonly draft: DraftState;
  readonly publication: EditorPublication;
}

function PublishingDraftBar({
  document,
  draft,
  publication,
}: Readonly<PublishingDraftBarProps>) {
  const publishing = usePublish({ document, draft, publication });
  return (
    <DraftBar
      status={draft.status}
      everSaved={draft.everSaved}
      onSave={() => {
        void draft.save();
      }}
    >
      <PublishControls
        blocker={publishing.blocker}
        publishing={publishing.publishing}
        feedback={publishing.feedback}
        versionCount={publication.versionCount}
        onPublish={() => {
          void publishing.publish();
        }}
        onShowVersions={publication.onShowVersions}
      />
    </DraftBar>
  );
}

export interface EditorDraftBarProps {
  readonly document: EditorDocument;
  readonly draft: DraftState;
  /** Publicação do processo do catálogo; sem ela, a barra só salva o rascunho. */
  readonly publication?: EditorPublication;
}

/** Barra do rascunho do editor: salvar e, no processo do catálogo, publicar e ver as versões. */
export function EditorDraftBar({
  document,
  draft,
  publication,
}: Readonly<EditorDraftBarProps>) {
  if (publication === undefined) {
    return (
      <DraftBar
        status={draft.status}
        everSaved={draft.everSaved}
        onSave={() => {
          void draft.save();
        }}
      />
    );
  }
  return (
    <PublishingDraftBar
      document={document}
      draft={draft}
      publication={publication}
    />
  );
}
