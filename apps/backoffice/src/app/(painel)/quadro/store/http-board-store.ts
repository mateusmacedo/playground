import {
  type ApiErrorKind,
  type ApiResult,
  succeeded,
} from '@/shared/api/api-result';
import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardDocument } from '@/shared/api/contract';
import {
  createSerialWriter,
  type WriteOutcome,
} from '@/shared/api/serial-writer';

import type { Board } from '../model/board';
import { boardOfDocument, toBoardDocument } from '../model/board-document';
import {
  type BoardLoad,
  type BoardStore,
  type RemoteBoardActions,
  SAVED,
  type SaveStatus,
} from './board-store';
import { type BoardSnapshot, confirmSentWrite } from './sent-write';
import { createStatusChannel } from './status-channel';

export const UNREADABLE_BOARD =
  'O quadro gravado no servidor não pôde ser lido por esta versão do painel.';

const PENDING: SaveStatus = { kind: 'pending' };

/** Falhas em que o envio pode ter chegado ao servidor, mesmo sem a resposta. */
const UNANSWERED: readonly ApiErrorKind[] = ['network', 'timeout'];

type WriteResult = ApiResult<BoardDocument>;

/** O quadro lido do servidor, já conferido, ou o motivo de não ter sido lido. */
type BoardRead =
  | {
      readonly ok: true;
      readonly revision: number;
      readonly snapshot: BoardSnapshot;
    }
  | { readonly ok: false; readonly message: string };

export interface HttpBoardStoreParams {
  readonly api: BoardsApi;
  readonly boardId: string;
  /** Quadro novo, que o servidor ainda não tem: a primeira gravação o cria. */
  readonly created?: BoardSnapshot;
  /** Espera entre a mudança e o envio, em milissegundos. */
  readonly writeDelayMs?: number;
}

export interface HttpBoardStore extends BoardStore {
  readonly remote: RemoteBoardActions;
  /** O nome mora no documento do quadro: renomear é regravá-lo. */
  readonly rename: (name: string) => void;
  /** O quadro vai ser excluído: desiste do que espera a vez e resolve quando o envio em andamento termina. */
  readonly discard: () => Promise<void>;
  readonly hasUnsaved: () => boolean;
}

/**
 * O quadro gravado na API, como documento inteiro: uma gravação por vez, a mais recente vence, cada uma com a revisão
 * lida. A revisão recusada vira conflito, que só a pessoa resolve.
 */
export function createHttpBoardStore(
  params: HttpBoardStoreParams,
): HttpBoardStore {
  const { api, boardId } = params;
  const channel = createStatusChannel();
  /** Revisão que o servidor tem, até onde esta tela sabe; `null` enquanto o quadro não existe lá. */
  let revision: number | null = null;
  /** O que o servidor tem; é o mesmo objeto de `local` quando não há mudança por gravar. */
  let saved: BoardSnapshot | null = null;
  let local: BoardSnapshot | null = params.created ?? null;
  /** Nome pedido antes de o quadro ser lido. */
  let renamedTo: string | null = null;
  /** Envio que ficou sem resposta. */
  let unanswered: BoardSnapshot | null = null;
  let failure: string | null = null;
  let conflict = false;
  let conflictFailure: string | undefined;
  let resolving = false;
  let closed = false;

  const send = async (snapshot: BoardSnapshot): Promise<WriteResult> => {
    const document = toBoardDocument({ id: boardId, ...snapshot });
    const result =
      revision === null
        ? await api.create(document)
        : await api.update({ ...document, revision });
    if (!result.ok && UNANSWERED.includes(result.error.kind)) {
      unanswered = snapshot;
    }
    return result;
  };

  const write = async (snapshot: BoardSnapshot): Promise<WriteResult> => {
    const sent = unanswered;
    if (sent === null) {
      return send(snapshot);
    }
    const landed = await confirmSentWrite({ api, boardId, revision, sent });
    if (!landed.ok) {
      return landed;
    }
    unanswered = null;
    if (landed.value === null) {
      return send(snapshot);
    }
    revision = landed.value.revision;
    saved = sent;
    // NOTE: quando o envio que chegou já era este, não há o que mandar de novo.
    return snapshot === sent ? succeeded(landed.value) : send(snapshot);
  };

  const publish = (): void => {
    if (conflict) {
      const status: SaveStatus = { kind: 'conflict', busy: resolving };
      channel.set(
        conflictFailure ? { ...status, failure: conflictFailure } : status,
      );
      return;
    }
    const writing = writer.isPending();
    if (failure !== null) {
      channel.set({ kind: 'failed', message: failure, busy: writing });
      return;
    }
    channel.set(writing ? PENDING : SAVED);
  };

  const settle = (outcome: WriteOutcome<BoardSnapshot, WriteResult>): void => {
    const { value, result } = outcome;
    if (result.ok) {
      revision = result.value.revision;
      saved = value;
      failure = null;
    } else if (result.error.kind === 'conflict') {
      conflict = true;
      failure = null;
      // WHY: em conflito quem decide o que vale é a pessoa: a mudança que esperava a vez não pode sair sozinha.
      writer.cancel();
    } else {
      failure = result.error.message;
    }
    publish();
  };

  const writer = createSerialWriter<BoardSnapshot, WriteResult>({
    write,
    delayMs: params.writeDelayMs,
    onSettled: settle,
    onPendingChange: publish,
  });

  const change = (next: BoardSnapshot): void => {
    local = next;
    if (!closed && !conflict) {
      writer.schedule(next);
    }
  };

  const rename = (name: string): void => {
    if (local === null) {
      renamedTo = name;
      return;
    }
    if (name !== local.name) {
      change({ ...local, name });
    }
  };

  const read = async (): Promise<BoardRead> => {
    const result = await api.get(boardId);
    if (!result.ok) {
      return { ok: false, message: result.error.message };
    }
    const board = boardOfDocument(result.value);
    if (board === null) {
      return { ok: false, message: UNREADABLE_BOARD };
    }
    const snapshot = { name: result.value.name, board };
    return { ok: true, revision: result.value.revision, snapshot };
  };

  /** O servidor tem este quadro nesta revisão: é dele que as próximas gravações partem. */
  const adopt = (fresh: BoardRead & { readonly ok: true }): void => {
    revision = fresh.revision;
    saved = fresh.snapshot;
    local = fresh.snapshot;
    unanswered = null;
    failure = null;
    conflict = false;
    conflictFailure = undefined;
    if (renamedTo !== null) {
      const name = renamedTo;
      renamedTo = null;
      rename(name);
    }
    publish();
  };

  const keepMine = async (): Promise<void> => {
    if (!conflict || resolving || local === null) {
      return;
    }
    resolving = true;
    publish();
    const current = await api.get(boardId);
    resolving = false;
    if (!current.ok) {
      conflictFailure = current.error.message;
      publish();
      return;
    }
    revision = current.value.revision;
    // NOTE: a versão da tela vai por cima da do servidor mesmo quando é igual à última que esta tela gravou.
    saved = null;
    unanswered = null;
    conflict = false;
    conflictFailure = undefined;
    writer.schedule(local);
    await writer.flush();
  };

  const takeTheirs = async (): Promise<Board | null> => {
    if (!conflict || resolving) {
      return null;
    }
    resolving = true;
    publish();
    const fresh = await read();
    resolving = false;
    if (!fresh.ok) {
      conflictFailure = fresh.message;
      publish();
      return null;
    }
    adopt(fresh);
    return fresh.snapshot.board;
  };

  const open = async (): Promise<BoardLoad> => {
    await writer.flush();
    if (local !== null && local !== saved) {
      // WHY: a mudança que não chegou ao servidor continua na tela, com o aviso dela; reler agora a apagaria.
      return { kind: 'found', board: local.board };
    }
    const fresh = await read();
    if (!fresh.ok) {
      return { kind: 'failed', message: fresh.message };
    }
    adopt(fresh);
    return { kind: 'found', board: fresh.snapshot.board };
  };

  /** Leitura em andamento: quem pede de novo enquanto ela corre recebe a mesma. */
  let opening: Promise<BoardLoad> | null = null;

  if (local !== null) {
    writer.schedule(local);
  }

  return {
    load() {
      opening ??= open().finally(() => {
        opening = null;
      });
      return opening;
    },
    save(board) {
      if (local !== null && board !== local.board) {
        change({ ...local, board });
      }
    },
    status: channel.get,
    subscribe: channel.subscribe,
    remote: {
      async refresh() {
        if (local === null || channel.get().kind !== 'saved') {
          return null;
        }
        const fresh = await read();
        if (!fresh.ok || fresh.revision === revision) {
          return null;
        }
        // NOTE: a mudança feita enquanto a leitura corria vale mais do que ela: se o servidor também mudou, a
        // gravação dessa mudança acusa o conflito.
        if (channel.get().kind !== 'saved') {
          return null;
        }
        adopt(fresh);
        return fresh.snapshot.board;
      },
      retry() {
        if (local === null || local === saved || conflict || closed) {
          return;
        }
        writer.schedule(local);
        void writer.flush();
      },
      keepMine: () => void keepMine(),
      takeTheirs,
      async flush() {
        // NOTE: a mudança feita enquanto um envio corria volta a esperar a vez; o laço a envia também.
        while (writer.isPending()) {
          await writer.flush();
        }
      },
    },
    rename,
    discard() {
      closed = true;
      writer.cancel();
      return writer.flush();
    },
    hasUnsaved: () => channel.get().kind !== 'saved',
  };
}
