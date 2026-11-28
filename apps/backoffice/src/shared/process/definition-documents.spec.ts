import { testDefinition, testVersion } from './catalog-test-data';
import {
  contentText,
  definitionContent,
  readDefinition,
} from './definition-documents';

const published = testDefinition({
  description: 'Pedidos de atendimento',
  draftText: 'rascunho',
  versions: [testVersion(1)],
});

describe('definitionContent', () => {
  it('põe o processo no envelope da API, com a versão do formato do catálogo', () => {
    const content = definitionContent(published);

    expect(content.id).toBe('process-1');
    expect(content.schemaVersion).toBe(1);
    expect(content.definition).toEqual(published);
  });

  it('deixa de fora o campo sem valor, como o texto gravado no navegador', () => {
    const content = definitionContent(testDefinition({ archived: undefined }));

    expect(content.definition).not.toHaveProperty('archived');
    expect(content.definition).not.toHaveProperty('description');
  });
});

describe('contentText', () => {
  it('é igual para dois processos de mesmo conteúdo', () => {
    const one = contentText(definitionContent(testDefinition()));
    const other = contentText(
      definitionContent(testDefinition({ description: undefined })),
    );

    expect(one).toBe(other);
  });

  it('muda quando o conteúdo do processo muda', () => {
    const before = contentText(definitionContent(testDefinition()));
    const after = contentText(
      definitionContent(testDefinition({ name: 'Cobrança' })),
    );

    expect(after).not.toBe(before);
  });
});

describe('readDefinition', () => {
  it('lê de volta o processo que foi posto no envelope, sem perda', () => {
    expect(readDefinition(definitionContent(published))).toEqual(published);
  });

  it('descarta o formato de outra versão', () => {
    const content = { ...definitionContent(published), schemaVersion: 2 };

    expect(readDefinition(content)).toBeNull();
  });

  it('descarta o conteúdo que não forma um processo', () => {
    const content = {
      id: 'process-1',
      schemaVersion: 1,
      definition: { id: 'process-1', name: '' },
    };

    expect(readDefinition(content)).toBeNull();
  });

  it('descarta o conteúdo que não é um objeto', () => {
    const content = { id: 'process-1', schemaVersion: 1, definition: 'texto' };

    expect(readDefinition(content)).toBeNull();
  });

  it('descarta o processo cujo id não é o do documento', () => {
    const content = { ...definitionContent(published), id: 'process-9' };

    expect(readDefinition(content)).toBeNull();
  });

  it('lê com a tolerância do catálogo gravado: a versão estragada sai e o processo fica', () => {
    const content = definitionContent(published);
    const broken = {
      ...content,
      definition: { ...published, versions: [{ version: 'um' }] },
    };

    expect(readDefinition(broken)).toEqual({ ...published, versions: [] });
  });
});
