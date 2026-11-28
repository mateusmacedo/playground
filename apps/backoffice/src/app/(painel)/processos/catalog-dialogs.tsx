import type { ProcessVersion } from '@/shared/process/catalog';
import { ConfirmModal } from '@/shared/ui/confirm-modal';
import type { CatalogActions } from './catalog-actions';
import {
  ArchivedProcessesDialog,
  ProcessVersionsDialog,
} from './process-list-dialogs';
import type { CatalogDialogKind } from './process-switcher';
import {
  ProcessDescriptionDialog,
  ProcessNameDialog,
} from './process-text-dialogs';
import { SwitchConfirmDialog } from './switch-confirm-dialog';
import type { ProcessWorkspace } from './use-process-workspace';

/** Janela aberta na página de processos. */
export type CatalogDialog =
  | { readonly kind: CatalogDialogKind | 'versions' }
  | { readonly kind: 'open-version'; readonly version: ProcessVersion };

export interface CatalogDialogsProps {
  readonly workspace: ProcessWorkspace;
  readonly actions: CatalogActions;
  readonly dialog: CatalogDialog | null;
  readonly onDialog: (dialog: CatalogDialog | null) => void;
}

/** As janelas do catálogo: nome, descrição, arquivar, arquivados, versões e a confirmação da troca de processo. */
export function CatalogDialogs({
  workspace,
  actions,
  dialog,
  onDialog,
}: Readonly<CatalogDialogsProps>) {
  const { active, access } = workspace;
  const close = () => onDialog(null);
  return (
    <>
      {dialog?.kind === 'new' ? (
        <ProcessNameDialog
          title="Novo processo"
          confirmLabel="Criar processo"
          initialName=""
          catalog={access.catalog}
          onSave={(name) => {
            close();
            actions.create(name);
          }}
          onCancel={close}
        />
      ) : null}
      {dialog?.kind === 'rename' && active ? (
        <ProcessNameDialog
          title="Renomear processo"
          confirmLabel="Renomear"
          initialName={active.name}
          catalog={access.catalog}
          definitionId={active.id}
          onSave={(name) => {
            close();
            actions.rename(name);
          }}
          onCancel={close}
        />
      ) : null}
      {dialog?.kind === 'describe' && active ? (
        <ProcessDescriptionDialog
          initialDescription={active.description ?? ''}
          onSave={(description) => {
            close();
            actions.describe(description);
          }}
          onCancel={close}
        />
      ) : null}
      {dialog?.kind === 'archive' && active ? (
        <ConfirmModal
          visible
          title="Arquivar processo"
          confirmLabel="Arquivar"
          confirmColor="warning"
          onConfirm={() => {
            close();
            actions.archive();
          }}
          onCancel={close}
        >
          {`${active.name} sai do seletor e dos processos que o quadro oferece. As versões publicadas continuam guardadas, e o processo pode ser restaurado em "Arquivados".`}
        </ConfirmModal>
      ) : null}
      {dialog?.kind === 'archived' ? (
        <ArchivedProcessesDialog
          archived={workspace.archived}
          onRestore={actions.restore}
          onClose={close}
        />
      ) : null}
      {dialog?.kind === 'versions' && active ? (
        <ProcessVersionsDialog
          processName={active.name}
          versions={active.versions}
          onOpenVersion={(version) =>
            onDialog({ kind: 'open-version', version })
          }
          onClose={close}
        />
      ) : null}
      {dialog?.kind === 'open-version' && active ? (
        <ConfirmModal
          visible
          title={`Abrir a versão ${dialog.version.version} como rascunho`}
          confirmLabel="Substituir o rascunho"
          confirmColor="warning"
          onConfirm={() => {
            close();
            actions.openVersion(dialog.version);
          }}
          onCancel={() => onDialog({ kind: 'versions' })}
        >
          O rascunho atual, inclusive o que não foi salvo, será substituído pelo
          desenho desta versão. As versões publicadas não mudam.
        </ConfirmModal>
      ) : null}
      {workspace.confirmingSwitch && active ? (
        <SwitchConfirmDialog
          processName={active.name}
          onSaveAndSwitch={workspace.saveAndSwitch}
          onSwitch={workspace.switchWithoutSaving}
          onCancel={workspace.cancelSwitch}
        />
      ) : null}
    </>
  );
}
