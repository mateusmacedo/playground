import { useCallback, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import { BlockPicker, type PickerRequest } from './block-picker';
import type { BlockKind } from './model/blocks';
import type { ProcessEditorState } from './use-process-editor';

/** Os dois diálogos do editor: o seletor de bloco filtrado e a confirmação do Limpar. */
export function useEditorDialogs() {
  const [pickRequest, setPickRequest] = useState<PickerRequest | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const requestPick = useCallback(
    (request: PickerRequest) => setPickRequest(request),
    [],
  );
  return {
    pickRequest,
    requestPick,
    closePick: () => setPickRequest(null),
    confirmingClear,
    askClear: () => setConfirmingClear(true),
    closeClear: () => setConfirmingClear(false),
  };
}

export type EditorDialogsState = ReturnType<typeof useEditorDialogs>;

interface PickBlockParams {
  readonly editor: ProcessEditorState;
  readonly request: PickerRequest | null;
  readonly kind: BlockKind;
}

/** Escolher um tipo no seletor: inserir na conexão ou criar ligado à saída, conforme o pedido. */
function pickBlock({ editor, request, kind }: PickBlockParams) {
  if (request?.purpose === 'edge') {
    editor.insertOnEdge({ edgeId: request.edgeId, kind });
  } else if (request?.purpose === 'output') {
    editor.addConnectedBlock({
      source: request.source,
      sourceHandle: request.sourceHandle,
      kind,
      position: request.position,
    });
  }
}

export interface EditorDialogsProps {
  readonly editor: ProcessEditorState;
  readonly dialogs: EditorDialogsState;
}

export function EditorDialogs({
  editor,
  dialogs,
}: Readonly<EditorDialogsProps>) {
  return (
    <>
      <BlockPicker
        request={dialogs.pickRequest}
        onCancel={dialogs.closePick}
        onPick={(kind) => {
          pickBlock({ editor, request: dialogs.pickRequest, kind });
          dialogs.closePick();
        }}
      />
      <ConfirmModal
        visible={dialogs.confirmingClear}
        title="Limpar o canvas"
        confirmLabel="Limpar"
        confirmColor="danger"
        onCancel={dialogs.closeClear}
        onConfirm={() => {
          editor.clear();
          dialogs.closeClear();
        }}
      >
        Todos os blocos e conexões deste canvas serão removidos. Use Desfazer
        para recuperar o conteúdo.
      </ConfirmModal>
    </>
  );
}
