import {
  isFilledText,
  isRecord,
  keepValid,
  knownOption,
} from './stored-values';

export type FieldType =
  | 'text'
  | 'long-text'
  | 'number'
  | 'date'
  | 'choice'
  | 'checkbox';

/** Tipos de campo, na ordem em que a tela os oferece. */
export const FIELD_TYPES: readonly FieldType[] = [
  'text',
  'long-text',
  'number',
  'date',
  'choice',
  'checkbox',
];

/** Campo que a pessoa preenche ao resolver uma etapa. */
export interface StepField {
  readonly id: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required: boolean;
  /** Opções da lista; só o tipo `choice` tem. */
  readonly options?: readonly string[];
}

/** Valores preenchidos, pelo id do campo: o texto digitado ou a marca da caixa. */
export type FieldValues = Readonly<Record<string, string | boolean>>;

/** Valor aceito, como fica no histórico: o rótulo do campo e o texto pronto para leitura. */
export interface FieldEntry {
  readonly label: string;
  readonly value: string;
}

export interface ValidateValuesParams {
  readonly fields?: readonly StepField[];
  readonly values?: FieldValues;
}

export interface AcceptedValues {
  readonly ok: true;
  /** Só os campos preenchidos, na ordem dos campos da etapa. */
  readonly entries: readonly FieldEntry[];
}

export interface RefusedValues {
  readonly ok: false;
  /** Rótulos dos campos obrigatórios sem valor. */
  readonly missing: readonly string[];
  /** Rótulos dos campos preenchidos com um valor que o tipo não aceita. */
  readonly invalid: readonly string[];
}

export type ValuesCheck = AcceptedValues | RefusedValues;

/** Texto da caixa marcada no histórico. */
const CHECKED_TEXT = 'Sim';
/** Texto da caixa desmarcada no histórico. */
const UNCHECKED_TEXT = 'Não';

/** Leitura de um valor: vazio, recusado pelo tipo do campo ou aceito, já com o texto do histórico. */
interface Reading {
  readonly state: 'empty' | 'invalid' | 'filled';
  readonly text: string;
}

const EMPTY: Reading = { state: 'empty', text: '' };
const INVALID: Reading = { state: 'invalid', text: '' };

function filled(text: string): Reading {
  return { state: 'filled', text };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data `AAAA-MM-DD` que existe no calendário, no formato `DD/MM/AAAA`; `undefined` quando não é uma. */
function calendarDate(text: string): string | undefined {
  const match = DATE_ONLY.exec(text);
  if (!match) {
    return undefined;
  }
  const date = new Date(`${text}T00:00:00Z`);
  const exists =
    !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
  if (!exists) {
    return undefined;
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

interface FieldValue {
  readonly field: StepField;
  readonly value: string | boolean | undefined;
}

function readCheckbox(params: FieldValue): Reading {
  const { field, value } = params;
  if (value === undefined) {
    return EMPTY;
  }
  if (typeof value !== 'boolean') {
    return INVALID;
  }
  if (value) {
    return filled(CHECKED_TEXT);
  }
  // NOTE: a caixa obrigatória só vale marcada; desmarcada, conta como sem valor.
  return field.required ? EMPTY : filled(UNCHECKED_TEXT);
}

interface FieldText {
  readonly field: StepField;
  readonly text: string;
}

function readText(params: FieldText): Reading {
  const { field, text } = params;
  if (field.type === 'number') {
    return Number.isFinite(Number(text)) ? filled(text) : INVALID;
  }
  if (field.type === 'date') {
    const date = calendarDate(text);
    return date === undefined ? INVALID : filled(date);
  }
  if (field.type === 'choice') {
    const options = field.options ?? [];
    const listed = options.some((option) => option.trim() === text);
    return listed ? filled(text) : INVALID;
  }
  return filled(text);
}

function readValue(params: FieldValue): Reading {
  const { field, value } = params;
  if (field.type === 'checkbox') {
    return readCheckbox(params);
  }
  if (value === undefined) {
    return EMPTY;
  }
  if (typeof value !== 'string') {
    return INVALID;
  }
  const text = value.trim();
  return text === '' ? EMPTY : readText({ field, text });
}

/**
 * Confere os valores preenchidos contra os campos da etapa. Aceita quando todo obrigatório tem valor e nenhum valor
 * foge do tipo: número finito, data `AAAA-MM-DD` do calendário, opção da lista, caixa marcada quando obrigatória.
 * Valor de campo que a etapa não tem é ignorado.
 */
export function validateValues(params: ValidateValuesParams): ValuesCheck {
  const { fields = [], values = {} } = params;
  const entries: FieldEntry[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const field of fields) {
    // WHY: `hasOwn` evita ler `constructor` e afins do protótipo quando o id do campo coincide com eles.
    const value = Object.hasOwn(values, field.id)
      ? values[field.id]
      : undefined;
    const reading = readValue({ field, value });
    if (reading.state === 'filled') {
      entries.push({ label: field.label, value: reading.text });
    } else if (reading.state === 'invalid') {
      invalid.push(field.label);
    } else if (field.required) {
      missing.push(field.label);
    }
  }
  if (missing.length > 0 || invalid.length > 0) {
    return { ok: false, missing, invalid };
  }
  return { ok: true, entries };
}

function toOptions(value: unknown): string[] | undefined {
  const options = keepValid({
    value,
    parse: (item) => (isFilledText(item) ? item.trim() : null),
  });
  return options ? [...new Set(options)] : undefined;
}

function toField(value: unknown): StepField | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.id) ||
    !isFilledText(value.label)
  ) {
    return null;
  }
  const type = knownOption({ value: value.type, options: FIELD_TYPES });
  if (type === undefined) {
    return null;
  }
  const field: StepField = {
    id: value.id,
    label: value.label.trim(),
    type,
    required: value.required === true,
  };
  if (type !== 'choice') {
    return field;
  }
  const options = toOptions(value.options);
  // WHY: lista sem opção nunca recebe valor; obrigatória, travaria a etapa para sempre.
  return options ? { ...field, options } : null;
}

/**
 * Campos de uma etapa lidos do armazenamento. O campo ilegível, a lista sem opção e o id repetido (fica o primeiro)
 * saem, sem derrubar os outros; `undefined` quando não sobra nenhum.
 */
export function parseFields(value: unknown): StepField[] | undefined {
  const fields = keepValid({ value, parse: toField });
  if (!fields) {
    return undefined;
  }
  const ids = new Set<string>();
  const unique: StepField[] = [];
  for (const field of fields) {
    if (ids.has(field.id)) {
      continue;
    }
    ids.add(field.id);
    unique.push(field);
  }
  return unique;
}

function toEntry(value: unknown): FieldEntry | null {
  return isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.value === 'string'
    ? { label: value.label, value: value.value }
    : null;
}

/** Valores do histórico lidos do armazenamento; `undefined` quando não há nenhum legível. */
export function parseEntries(value: unknown): FieldEntry[] | undefined {
  return keepValid({ value, parse: toEntry });
}
