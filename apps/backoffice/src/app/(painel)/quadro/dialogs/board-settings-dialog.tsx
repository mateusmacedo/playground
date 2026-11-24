import type { BoardCommands } from '../board-commands';
import type { Announce } from '../board-notices';
import type { Board } from '../model/board';
import { BoardFormDialog, type BoardFormValues } from './board-form-dialog';
import { OnClosed } from './on-closed';

/** Nome do quadro, que mora na lista de quadros, para a janela de configuração. */
export interface BoardSettings {
  readonly name: string;
  /** Devolve o nome que vale, ou `null` quando ele está vazio ou repetido. */
  readonly validateName: (name: string) => string | null;
  readonly onRename: (name: string) => void;
}

export interface BoardSettingsDialogProps {
  readonly visible: boolean;
  readonly settings: BoardSettings;
  readonly board: Board;
  readonly configure: BoardCommands['configure'];
  readonly announce: Announce;
  readonly onClose: () => void;
  /** A janela terminou de fechar. */
  readonly onClosed: () => void;
}

/** Janela "Configurar quadro": nome, prefixo do código, coluna de conclusão e pessoas. */
export function BoardSettingsDialog({
  visible,
  settings,
  board,
  configure,
  announce,
  onClose,
  onClosed,
}: Readonly<BoardSettingsDialogProps>) {
  function save(values: BoardFormValues) {
    settings.onRename(values.name);
    configure({
      keyPrefix: values.keyPrefix,
      doneLaneId: values.doneLaneId ?? null,
      people: values.people,
    });
    onClose();
    announce('Configuração do quadro salva.');
  }

  return (
    <BoardFormDialog
      visible={visible}
      title="Configurar quadro"
      confirmLabel="Salvar"
      initial={{
        name: settings.name,
        keyPrefix: board.config.keyPrefix,
        doneLaneId: board.config.doneLaneId,
        people: board.config.people,
      }}
      lanes={board.lanes}
      validateName={settings.validateName}
      prefixHelp="Os links copiados com o prefixo antigo deixam de abrir o card."
      onSave={save}
      onCancel={onClose}
    >
      <OnClosed
        onClosed={() => {
          if (!visible) {
            onClosed();
          }
        }}
      />
    </BoardFormDialog>
  );
}
