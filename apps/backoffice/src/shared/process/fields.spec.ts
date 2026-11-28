import {
  parseEntries,
  parseFields,
  type StepField,
  validateValues,
} from './fields';

const note: StepField = {
  id: 'note',
  label: 'Observação',
  type: 'text',
  required: false,
};
const reason: StepField = {
  id: 'reason',
  label: 'Motivo',
  type: 'long-text',
  required: true,
};
const amount: StepField = {
  id: 'amount',
  label: 'Valor',
  type: 'number',
  required: false,
};
const delivery: StepField = {
  id: 'delivery',
  label: 'Entrega',
  type: 'date',
  required: false,
};
const channel: StepField = {
  id: 'channel',
  label: 'Canal',
  type: 'choice',
  required: false,
  options: ['E-mail', 'Telefone'],
};
const agreed: StepField = {
  id: 'agreed',
  label: 'De acordo',
  type: 'checkbox',
  required: false,
};

describe('validateValues', () => {
  it('aceita a etapa sem campos', () => {
    expect(validateValues({})).toEqual({ ok: true, entries: [] });
  });

  it('devolve os valores preenchidos na ordem dos campos, sem espaços nas pontas', () => {
    const check = validateValues({
      fields: [note, reason],
      values: { reason: '  Cliente pediu  ', note: 'Urgente' },
    });
    expect(check).toEqual({
      ok: true,
      entries: [
        { label: 'Observação', value: 'Urgente' },
        { label: 'Motivo', value: 'Cliente pediu' },
      ],
    });
  });

  it('deixa de fora o campo opcional sem valor', () => {
    const check = validateValues({
      fields: [note, amount],
      values: { note: '   ' },
    });
    expect(check).toEqual({ ok: true, entries: [] });
  });

  it('recusa o campo obrigatório vazio, com o rótulo dele', () => {
    const check = validateValues({ fields: [note, reason], values: {} });
    expect(check).toEqual({ ok: false, missing: ['Motivo'], invalid: [] });
  });

  it('aceita só número finito no campo de número', () => {
    const accepted = validateValues({
      fields: [amount],
      values: { amount: '12.5' },
    });
    expect(accepted).toEqual({
      ok: true,
      entries: [{ label: 'Valor', value: '12.5' }],
    });
    for (const text of ['doze', 'Infinity', '1,5']) {
      const refused = validateValues({
        fields: [amount],
        values: { amount: text },
      });
      expect(refused).toEqual({ ok: false, missing: [], invalid: ['Valor'] });
    }
  });

  it('aceita a data AAAA-MM-DD e a guarda como DD/MM/AAAA', () => {
    const check = validateValues({
      fields: [delivery],
      values: { delivery: '2026-11-26' },
    });
    expect(check).toEqual({
      ok: true,
      entries: [{ label: 'Entrega', value: '26/11/2026' }],
    });
  });

  it('recusa a data fora do formato ou que não existe no calendário', () => {
    for (const text of ['26/11/2026', '2026-02-30', '2026-13-45']) {
      const check = validateValues({
        fields: [delivery],
        values: { delivery: text },
      });
      expect(check).toEqual({ ok: false, missing: [], invalid: ['Entrega'] });
    }
  });

  it('aceita na lista só uma das opções', () => {
    const accepted = validateValues({
      fields: [channel],
      values: { channel: 'Telefone' },
    });
    expect(accepted).toEqual({
      ok: true,
      entries: [{ label: 'Canal', value: 'Telefone' }],
    });
    const refused = validateValues({
      fields: [channel],
      values: { channel: 'Carta' },
    });
    expect(refused).toEqual({ ok: false, missing: [], invalid: ['Canal'] });
  });

  it('recusa qualquer valor na lista sem opções', () => {
    const check = validateValues({
      fields: [{ ...channel, options: undefined }],
      values: { channel: 'E-mail' },
    });
    expect(check).toEqual({ ok: false, missing: [], invalid: ['Canal'] });
  });

  it('registra a caixa opcional como Sim ou Não', () => {
    const checked = validateValues({
      fields: [agreed],
      values: { agreed: true },
    });
    expect(checked).toEqual({
      ok: true,
      entries: [{ label: 'De acordo', value: 'Sim' }],
    });
    const unchecked = validateValues({
      fields: [agreed],
      values: { agreed: false },
    });
    expect(unchecked).toEqual({
      ok: true,
      entries: [{ label: 'De acordo', value: 'Não' }],
    });
  });

  it('deixa de fora a caixa opcional que não veio', () => {
    expect(validateValues({ fields: [agreed], values: {} })).toEqual({
      ok: true,
      entries: [],
    });
  });

  it('exige a caixa obrigatória marcada', () => {
    const required: StepField = { ...agreed, required: true };
    const unchecked = validateValues({
      fields: [required],
      values: { agreed: false },
    });
    expect(unchecked).toEqual({
      ok: false,
      missing: ['De acordo'],
      invalid: [],
    });
    const absent = validateValues({ fields: [required] });
    expect(absent).toEqual({ ok: false, missing: ['De acordo'], invalid: [] });
  });

  it('recusa o valor de tipo trocado: texto na caixa e marca no texto', () => {
    const check = validateValues({
      fields: [agreed, note],
      values: { agreed: 'sim', note: true },
    });
    expect(check).toEqual({
      ok: false,
      missing: [],
      invalid: ['De acordo', 'Observação'],
    });
  });

  it('informa juntos os obrigatórios vazios e os valores recusados', () => {
    const check = validateValues({
      fields: [reason, amount, delivery],
      values: { amount: 'muito', delivery: 'amanhã' },
    });
    expect(check).toEqual({
      ok: false,
      missing: ['Motivo'],
      invalid: ['Valor', 'Entrega'],
    });
  });

  it('ignora o valor de campo que a etapa não tem', () => {
    const check = validateValues({
      fields: [note],
      values: { other: 'x', note: 'ok' },
    });
    expect(check).toEqual({
      ok: true,
      entries: [{ label: 'Observação', value: 'ok' }],
    });
  });

  it('não confunde o id do campo com uma propriedade herdada do objeto', () => {
    const check = validateValues({
      fields: [{ ...note, id: 'constructor' }],
      values: {},
    });
    expect(check).toEqual({ ok: true, entries: [] });
  });
});

describe('parseFields', () => {
  it('lê os campos gravados como estão', () => {
    const fields: StepField[] = [note, reason, amount, delivery, channel];
    const stored: unknown = JSON.parse(JSON.stringify(fields));
    expect(parseFields(stored)).toEqual(fields);
  });

  it('descarta o campo ilegível sem perder os outros', () => {
    const fields = parseFields([
      'lixo',
      { label: 'Sem id', type: 'text' },
      { id: 'a', label: '   ', type: 'text' },
      { id: 'b', label: 'Tipo desconhecido', type: 'arquivo' },
      { id: 'c', label: '  Válido  ', type: 'text' },
    ]);
    expect(fields).toEqual([
      { id: 'c', label: 'Válido', type: 'text', required: false },
    ]);
  });

  it('só trata como obrigatório o campo gravado com true', () => {
    const fields = parseFields([
      { id: 'a', label: 'A', type: 'text', required: 'sim' },
      { id: 'b', label: 'B', type: 'text', required: true },
    ]);
    expect(fields?.map((field) => field.required)).toEqual([false, true]);
  });

  it('limpa as opções da lista: sem vazias, sem espaços e sem repetidas', () => {
    const fields = parseFields([
      {
        id: 'a',
        label: 'Canal',
        type: 'choice',
        options: [' E-mail ', '', 'Telefone', 'E-mail', 7],
      },
    ]);
    expect(fields?.[0]?.options).toEqual(['E-mail', 'Telefone']);
  });

  it('descarta a lista sem nenhuma opção', () => {
    const fields = parseFields([
      { id: 'a', label: 'Canal', type: 'choice', options: [' '] },
      { id: 'b', label: 'Outra', type: 'choice' },
    ]);
    expect(fields).toBeUndefined();
  });

  it('não leva opções para o campo que não é lista', () => {
    const fields = parseFields([
      { id: 'a', label: 'Texto', type: 'text', options: ['x'] },
    ]);
    expect(fields).toEqual([
      { id: 'a', label: 'Texto', type: 'text', required: false },
    ]);
  });

  it('fica com o primeiro campo de cada id', () => {
    const fields = parseFields([
      { id: 'a', label: 'Primeiro', type: 'text' },
      { id: 'a', label: 'Segundo', type: 'number' },
    ]);
    expect(fields?.map((field) => field.label)).toEqual(['Primeiro']);
  });

  it('devolve undefined quando não é lista', () => {
    expect(parseFields({ id: 'a' })).toBeUndefined();
  });
});

describe('parseEntries', () => {
  it('mantém as entradas com rótulo e valor de texto', () => {
    const entries = parseEntries([
      { label: 'Motivo', value: 'Cliente pediu' },
      { label: 'Sem valor' },
      { label: 3, value: 'x' },
      'lixo',
    ]);
    expect(entries).toEqual([{ label: 'Motivo', value: 'Cliente pediu' }]);
  });

  it('devolve undefined quando não há entrada legível', () => {
    expect(parseEntries(undefined)).toBeUndefined();
  });
});
