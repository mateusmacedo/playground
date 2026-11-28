import type { CatalogRefusal, CatalogResult, ProcessCatalog } from './catalog';
import type { CatalogFailure, CatalogStore } from './catalog-store';

/** Uma mudança do catálogo: recebe o catálogo atual e devolve o resultado, como as funções de `catalog-changes`. */
export type CatalogChange<R extends CatalogResult> = (
  catalog: ProcessCatalog,
) => R;

/** O que a tela mostra do catálogo e da leitura e gravação dele. */
export interface CatalogSnapshot {
  readonly catalog: ProcessCatalog;
  /** O catálogo gravado já foi lido (ou não há o que ler). */
  readonly loaded: boolean;
  /** Há uma leitura pedida pela tela em andamento: a primeira, a nova tentativa ou a recarga. */
  readonly loading: boolean;
  /** Por que a última leitura pedida pela tela não deu certo; `null` quando deu ou ainda não terminou. */
  readonly loadFailure: CatalogFailure | null;
  /** A última gravação desta tela não foi feita; o catálogo segue só na memória dela. */
  readonly storageFailed: boolean;
  /** Um processo foi alterado em outro lugar, e a gravação espera a escolha: recarregar ou manter a versão da tela. */
  readonly conflict: CatalogFailure | null;
}

/** O que aconteceu com uma mudança que espera a gravação. */
export type CommitOutcome<R extends CatalogResult> =
  | {
      readonly kind: 'saved';
      readonly result: Extract<R, { readonly ok: true }>;
    }
  | { readonly kind: 'refused'; readonly refusal: CatalogRefusal }
  | { readonly kind: 'failed'; readonly failure: CatalogFailure }
  /** A gravação entrou em conflito e a tela foi recarregada com o que estava gravado: a mudança saiu dela. */
  | { readonly kind: 'discarded' };

/** O catálogo da tela antes e depois de uma releitura automática. */
export interface CatalogRefreshed {
  readonly before: ProcessCatalog;
  readonly after: ProcessCatalog;
}

export interface CatalogSessionParams {
  readonly store: CatalogStore;
  /** Com `true`, a releitura automática não acontece: a tela tem algo que a releitura deixaria para trás. */
  readonly holdRefresh?: () => boolean;
  /** Chamada depois que uma releitura automática trocou o catálogo da tela. */
  readonly onRefreshed?: (change: CatalogRefreshed) => void;
}

/** O catálogo de uma tela: o que ela mostra, as mudanças dela e a conversa com o armazenamento. */
export interface CatalogSession {
  readonly getSnapshot: () => CatalogSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  /** A tela apareceu: faz a primeira leitura ou, depois dela, a releitura automática. */
  readonly start: () => void;
  /** O armazenamento avisou um catálogo gravado em outro lugar. */
  readonly adopt: (catalog: ProcessCatalog) => void;
  /**
   * Lê o catálogo gravado e o põe no lugar do da tela, descartando o que ela tinha e não gravou. É a nova tentativa
   * da leitura que falhou e o "recarregar" de um conflito. Devolve o catálogo lido; `null` quando a leitura falha.
   */
  readonly reload: () => Promise<ProcessCatalog | null>;
  /**
   * Releitura automática: só acontece com tudo gravado, e a falha dela não vira aviso. Devolve o catálogo lido;
   * `null` quando não leu.
   */
  readonly refresh: () => Promise<ProcessCatalog | null>;
  /**
   * Aplica a mudança sobre o catálogo mais recente e manda gravar, sem esperar. Devolve o que a mudança devolveu: a
   * recusa, quando ela não foi feita, ou o catálogo novo com os dados dela.
   */
  readonly update: <R extends CatalogResult>(change: CatalogChange<R>) => R;
  /**
   * Aplica a mudança e espera a gravação. Quando ela falha, a mudança sai da tela, para a tela não mostrar o que não
   * foi gravado. No conflito, espera a escolha: recarregar descarta a mudança, manter a grava.
   */
  readonly commit: <R extends CatalogResult>(
    change: CatalogChange<R>,
  ) => Promise<CommitOutcome<R>>;
  /** Grava de novo o catálogo da tela, depois de uma gravação que falhou. Devolve se gravou. */
  readonly retrySave: () => Promise<boolean>;
  /** No conflito, grava o catálogo da tela por cima do que foi gravado em outro lugar. Devolve se gravou. */
  readonly keepMine: () => Promise<boolean>;
}
