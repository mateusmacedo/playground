import { fireEvent, render, screen, within } from '@testing-library/react';

import { testDefinition } from '@/shared/process/catalog-test-data';

import { publishedAtText } from './process-list-dialogs';
import { ProcessNameDialog } from './process-text-dialogs';

const catalog = { definitions: [testDefinition()] };

describe('ProcessNameDialog', () => {
  it('pede o nome ao enviar vazio, sem salvar', async () => {
    const onSave = vi.fn();
    render(
      <ProcessNameDialog
        title="Novo processo"
        confirmLabel="Criar processo"
        initialName=""
        catalog={catalog}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const form = await screen.findByRole('dialog', { name: 'Novo processo' });
    const name = within(form).getByLabelText('Nome do processo');

    expect(within(form).queryByText('Informe o nome do processo.')).toBeNull();
    fireEvent.submit(name.closest('form') as HTMLFormElement);

    const feedback = within(form).getByText('Informe o nome do processo.');
    expect(name.getAttribute('aria-describedby')).toBe(feedback.id);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('aceita o nome atual do processo renomeado e envia com Enter', async () => {
    const onSave = vi.fn();
    render(
      <ProcessNameDialog
        title="Renomear processo"
        confirmLabel="Renomear"
        initialName="Atendimento"
        catalog={catalog}
        definitionId="process-1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const form = await screen.findByRole('dialog', {
      name: 'Renomear processo',
    });

    fireEvent.submit(
      within(form)
        .getByLabelText('Nome do processo')
        .closest('form') as HTMLFormElement,
    );

    expect(onSave).toHaveBeenCalledWith('Atendimento');
  });
});

describe('publishedAtText', () => {
  it('mostra data e hora no formato do Brasil', () => {
    expect(publishedAtText('2026-11-20T10:00:00.000Z')).toMatch(
      /^20\/11\/2026,? \d{2}:\d{2}$/,
    );
  });
});
