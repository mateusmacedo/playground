import {
  FIELD_TYPES,
  type FieldType,
  type StepField,
} from '@/shared/process/fields';
import {
  isFilledText,
  isRecord,
  knownOption,
} from '@/shared/process/stored-values';

import type { Graph, GraphEdge, GraphNode } from './blocks';
import { updateBlockData } from './editing';
import type { Option } from './fields';
import { suggestedName } from './names';

/** Tipos de campo com o nome que a tela mostra, na ordem da lista. */
export const FIELD_TYPE_OPTIONS: readonly Option<FieldType>[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'long-text', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'choice', label: 'Lista de opções' },
  { value: 'checkbox', label: 'Caixa de marcação' },
];

/** Palavra do nome provisório de um campo: "Campo 1", "Campo 2" e assim por diante. */
const FIELD_PREFIX = 'Campo';

export interface StepFieldNameParams {
  readonly field: StepField;
  /** Posição do campo no bloco, a partir de 1. */
  readonly position: number;
}

/** Nome do campo na tela e nas mensagens: o que o usuário deu ou, sem nome, a posição dele na lista. */
export function stepFieldName(params: StepFieldNameParams): string {
  const { field, position } = params;
  return field.label.trim() || `${FIELD_PREFIX} ${position}`;
}

function textsOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === 'string');
}

/**
 * Campo lido de um rascunho. Aceita o campo ainda incompleto (sem nome, lista sem opções), porque o rascunho guarda o
 * trabalho pela metade e é a validação que aponta o que falta; só sai o que não dá para editar: sem id ou de tipo
 * desconhecido.
 */
function toStepField(value: unknown): StepField | null {
  if (!isRecord(value) || !isFilledText(value.id)) {
    return null;
  }
  const type = knownOption({ value: value.type, options: FIELD_TYPES });
  if (typeof value.label !== 'string' || type === undefined) {
    return null;
  }
  const field: StepField = {
    id: value.id,
    label: value.label,
    type,
    required: value.required === true,
  };
  return type === 'choice'
    ? { ...field, options: textsOf(value.options) }
    : field;
}

/** Campos legíveis de uma lista salva, sem id repetido (fica o primeiro). */
export function readStepFields(items: readonly unknown[]): StepField[] {
  const ids = new Set<string>();
  const fields: StepField[] = [];
  for (const item of items) {
    const field = toStepField(item);
    if (field !== null && !ids.has(field.id)) {
      ids.add(field.id);
      fields.push(field);
    }
  }
  return fields;
}

interface BlockParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
}

interface ChangeFieldsParams<N extends GraphNode, E extends GraphEdge>
  extends BlockParams<N, E> {
  readonly change: (fields: readonly StepField[]) => readonly StepField[];
}

function withStepFields<N extends GraphNode, E extends GraphEdge>(
  params: ChangeFieldsParams<N, E>,
): Graph<N, E> {
  const { graph, nodeId, change } = params;
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return graph;
  }
  const current = node.data.fields ?? [];
  const fields = change(current);
  const unchanged =
    fields.length === current.length &&
    fields.every((field, index) => field === current[index]);
  return unchanged
    ? graph
    : updateBlockData({ graph, nodeId, patch: { fields } });
}

export interface AddStepFieldParams<N extends GraphNode, E extends GraphEdge>
  extends BlockParams<N, E> {
  readonly createId: () => string;
}

/** Campo novo no fim da lista: texto curto, opcional, com um nome provisório que nenhum outro campo do bloco usa. */
export function addStepField<N extends GraphNode, E extends GraphEdge>(
  params: AddStepFieldParams<N, E>,
): Graph<N, E> {
  const { createId } = params;
  return withStepFields({
    ...params,
    change: (fields) => {
      const taken = fields.map((field) => field.label);
      const label = suggestedName({ prefix: FIELD_PREFIX, taken });
      const field: StepField = {
        id: createId(),
        label,
        type: 'text',
        required: false,
      };
      return [...fields, field];
    },
  });
}

/** O que dá para mudar num campo; o id, que identifica o valor preenchido, não muda. */
export type StepFieldPatch = Partial<Omit<StepField, 'id'>>;

interface PatchedFieldParams {
  readonly field: StepField;
  readonly patch: StepFieldPatch;
}

/** Só a lista de opções tem opções: trocar o tipo cria a lista vazia ou tira as opções que sobraram. */
function patchedField({ field, patch }: PatchedFieldParams): StepField {
  const changed = { ...field, ...patch };
  const base: StepField = {
    id: field.id,
    label: changed.label,
    type: changed.type,
    required: changed.required,
  };
  return changed.type === 'choice'
    ? { ...base, options: changed.options ?? [] }
    : base;
}

export interface UpdateStepFieldParams<N extends GraphNode, E extends GraphEdge>
  extends BlockParams<N, E> {
  readonly fieldId: string;
  readonly patch: StepFieldPatch;
}

export function updateStepField<N extends GraphNode, E extends GraphEdge>(
  params: UpdateStepFieldParams<N, E>,
): Graph<N, E> {
  const { fieldId, patch } = params;
  return withStepFields({
    ...params,
    change: (fields) =>
      fields.map((field) =>
        field.id === fieldId ? patchedField({ field, patch }) : field,
      ),
  });
}

export interface RemoveStepFieldParams<N extends GraphNode, E extends GraphEdge>
  extends BlockParams<N, E> {
  readonly fieldId: string;
}

export function removeStepField<N extends GraphNode, E extends GraphEdge>(
  params: RemoveStepFieldParams<N, E>,
): Graph<N, E> {
  const { fieldId } = params;
  return withStepFields({
    ...params,
    change: (fields) => fields.filter((field) => field.id !== fieldId),
  });
}
