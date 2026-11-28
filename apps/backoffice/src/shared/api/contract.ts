// NOTE: o conteúdo (`board` e `definition`) passa por aqui sem ser lido: quem o entende é a tela dona dele, com o
// leitor do formato que ela já grava no navegador.

export interface BoardDocument {
  readonly id: string;
  readonly name: string;
  /** A partir de 1; sobe 1 a cada gravação. */
  readonly revision: number;
  /** Versão do formato de `board`. */
  readonly schemaVersion: number;
  readonly board: unknown;
}

/** O que a lista de quadros informa de cada um. */
export interface BoardSummary {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
}

export interface ProcessDefinitionDocument {
  readonly id: string;
  /** A partir de 1; sobe 1 a cada gravação. */
  readonly revision: number;
  /** Versão do formato de `definition`. */
  readonly schemaVersion: number;
  readonly definition: unknown;
}

/** Documento que ainda não foi gravado: a revisão quem dá é a criação. */
export type Unrevised<T> = Omit<T, 'revision'>;

export type NewBoardDocument = Unrevised<BoardDocument>;
export type NewProcessDefinitionDocument = Unrevised<ProcessDefinitionDocument>;
