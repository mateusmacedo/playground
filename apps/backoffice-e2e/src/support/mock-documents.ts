// NOTE: espelha o contrato da API (`apps/backoffice-mock/openapi.yaml`) no que um teste precisa montar para semear. O
// que não está declarado aqui segue o schema de mesmo nome no contrato e passa como campo livre.

export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | JsonObject;

export interface JsonObject {
  readonly [field: string]: Json | undefined;
}

export interface BoardCard extends JsonObject {
  readonly id: string;
  readonly title: string;
}

export interface BoardLane extends JsonObject {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly BoardCard[];
}

export interface Board extends JsonObject {
  readonly lanes: readonly BoardLane[];
  readonly archive: readonly JsonObject[];
  readonly labels: readonly JsonObject[];
  readonly nextNumber: number;
  readonly config: JsonObject;
}

export interface BoardDocument {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly board: Board;
}

export interface ProcessVersion extends JsonObject {
  readonly version: number;
  readonly publishedAt: string;
  readonly documentText: string;
  readonly plan: JsonObject;
}

export interface ProcessDefinition extends JsonObject {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly draftText: string | null;
  readonly versions: readonly ProcessVersion[];
}

export interface ProcessDefinitionDocument {
  readonly id: string;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly definition: ProcessDefinition;
}

/** Documento a semear: a revisão quem decide é a semeadura, pela que o mock tem gravada. */
export type Seed<T> = Omit<T, 'revision'>;

export type BoardSeed = Seed<BoardDocument>;
export type ProcessDefinitionSeed = Seed<ProcessDefinitionDocument>;
