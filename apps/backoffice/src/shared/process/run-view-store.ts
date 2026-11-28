import { type ProcessRun, parseRun } from './run';
import {
  isFilledText,
  isPositiveInteger,
  isRecord,
  isTimestamp,
  keepValid,
} from './stored-values';

/** Situação de uma execução, como o quadro a entrega à página do diagrama. */
export interface RunView {
  /** Identifica a execução: o id do quadro, `:` e o id do card (ver `runViewRef`). */
  readonly ref: string;
  readonly definitionId: string;
  /** Versão em que a execução começou; é o desenho dela que o diagrama mostra. */
  readonly version: number;
  readonly processName: string;
  /** Como o card aparece para o usuário: o código e o título dele. */
  readonly cardLabel: string;
  /** Endereço do card no quadro, para a página do diagrama trazer o usuário de volta. */
  readonly backHref: string;
  readonly run: ProcessRun;
  /** Quando a situação foi gravada (ISO 8601). */
  readonly savedAt: string;
}

/**
 * Por onde o quadro entrega a situação de uma execução à página do diagrama. Guarda a execução, e não os estados das
 * etapas: a página calcula os estados com o roteiro da versão. Hoje o adaptador é o `localStorage` do navegador.
 */
export interface RunViewStore {
  /** Situação gravada da execução; `null` sem ela, com o gravado ilegível ou com o armazenamento bloqueado. */
  readonly load: (ref: string) => RunView | null;
  /** Grava a situação no lugar da anterior da mesma execução; `false` quando o navegador recusa a gravação. */
  readonly save: (view: RunView) => boolean;
}

/** Chave das situações no `localStorage`; a versão do formato vai dentro do valor gravado. */
export const RUN_VIEW_STORAGE_KEY = 'backoffice:processos:execucoes:v1';

/** Quantas situações ficam gravadas; ao passar, saem as mais antigas. */
export const RUN_VIEW_LIMIT = 20;

/** Endereço do quadro: a volta quando a situação não traz um endereço de card que sirva. */
export const BOARD_HREF = '/quadro';

const FORMAT_VERSION = 1;

export interface RunViewRefParams {
  readonly boardId: string;
  readonly cardId: string;
}

/** Referência da execução de um card, usada no endereço da página do diagrama (`?ref=`). */
export function runViewRef(params: RunViewRefParams): string {
  const { boardId, cardId } = params;
  return `${boardId}:${cardId}`;
}

/**
 * Lê a referência do endereço da página do diagrama; `null` quando ela não veio ou não tem o id do quadro e o do card.
 * O id do quadro vai até o primeiro `:`, e o resto é o id do card.
 */
export function parseRunViewRef(ref: string | null): RunViewRefParams | null {
  if (ref === null) {
    return null;
  }
  const separator = ref.indexOf(':');
  const boardId = ref.slice(0, separator);
  const cardId = ref.slice(separator + 1);
  if (separator < 0 || boardId === '' || cardId === '') {
    return null;
  }
  return { boardId, cardId };
}

/** Caminho dentro do painel: começa com uma só barra. */
const INTERNAL_HREF = /^\/(?![/\\])/;

// WHY: o endereço vira link na página do diagrama. O que vem do armazenamento só é aceito quando aponta para dentro do
// painel; outro site ou um `javascript:` gravado por engano ou de propósito não vira link.
function toBackHref(value: unknown): string {
  return typeof value === 'string' && INTERNAL_HREF.test(value)
    ? value
    : BOARD_HREF;
}

/**
 * Lê uma situação gravada. O que identifica a execução (referência, processo, versão e a própria execução), os nomes
 * que a página mostra e a hora da situação são lidos à risca: qualquer um vazio ou ilegível descarta a situação, assim
 * como a execução de outro processo ou de outra versão. O endereço de volta que não serve é trocado pelo do quadro.
 */
function toView(value: unknown): RunView | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.ref) ||
    !isFilledText(value.definitionId) ||
    !isPositiveInteger(value.version) ||
    !isFilledText(value.processName) ||
    !isFilledText(value.cardLabel) ||
    !isTimestamp(value.savedAt)
  ) {
    return null;
  }
  const run = parseRun(value.run);
  if (
    run === undefined ||
    run.definitionId !== value.definitionId ||
    run.version !== value.version
  ) {
    return null;
  }
  return {
    ref: value.ref,
    definitionId: value.definitionId,
    version: value.version,
    processName: value.processName,
    cardLabel: value.cardLabel,
    backHref: toBackHref(value.backHref),
    run,
    savedAt: value.savedAt,
  };
}

/** Situações gravadas, da mais recente para a mais antiga; o que não der para ler fica de fora. */
function parseViews(raw: string | null): readonly RunView[] {
  if (raw === null) {
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // WHY: texto corrompido é o mesmo que não ter situação gravada; a página do diagrama explica e oferece a volta.
    return [];
  }
  if (!isRecord(value) || value.version !== FORMAT_VERSION) {
    return [];
  }
  return keepValid({ value: value.views, parse: toView }) ?? [];
}

export function createBrowserRunViewStore(
  key: string = RUN_VIEW_STORAGE_KEY,
): RunViewStore {
  function storedViews(): readonly RunView[] {
    try {
      return parseViews(window.localStorage.getItem(key));
    } catch {
      // WHY: armazenamento bloqueado (modo privado, política do navegador) é o mesmo que não ter situação gravada.
      return [];
    }
  }

  return {
    load(ref) {
      return storedViews().find((view) => view.ref === ref) ?? null;
    },
    save(view) {
      const others = storedViews().filter((item) => item.ref !== view.ref);
      const views = [view, ...others].slice(0, RUN_VIEW_LIMIT);
      const text = JSON.stringify({ version: FORMAT_VERSION, views });
      try {
        window.localStorage.setItem(key, text);
        return true;
      } catch {
        // WHY: cota cheia ou armazenamento bloqueado não interrompem o quadro; quem chama decide como avisar.
        return false;
      }
    },
  };
}
