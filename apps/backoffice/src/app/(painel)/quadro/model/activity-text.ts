import type { CardActivity } from './board';
import { formatFullDate } from './due';

type LabelsActivity = Extract<CardActivity, { kind: 'labels' }>;

function labelText(entry: LabelsActivity): string {
  const parts: string[] = [];
  if (entry.added.length > 0) {
    parts.push(
      `${entry.added.length === 1 ? 'Etiqueta incluída' : 'Etiquetas incluídas'}: ${entry.added.join(', ')}`,
    );
  }
  if (entry.removed.length > 0) {
    parts.push(
      `${entry.removed.length === 1 ? 'Etiqueta removida' : 'Etiquetas removidas'}: ${entry.removed.join(', ')}`,
    );
  }
  return `${parts.join('. ')}.`;
}

type ParentActivity = Extract<CardActivity, { kind: 'parent' }>;

function parentText(entry: ParentActivity): string {
  if (entry.from && entry.to) {
    return `Card pai trocado de ${entry.from} para ${entry.to}.`;
  }
  return entry.to
    ? `Ligado ao card pai ${entry.to}.`
    : `Desligado do card pai ${entry.from ?? ''}.`.replace(' .', '.');
}

/** O registro em uma frase, para a lista do painel. */
export function activityText(entry: CardActivity): string {
  switch (entry.kind) {
    case 'created':
      return `Criado em ${entry.lane}.`;
    case 'moved':
      return `Movido de ${entry.from} para ${entry.to}.`;
    case 'renamed':
      return `Título alterado de "${entry.from}" para "${entry.to}".`;
    case 'description':
      return 'Descrição alterada.';
    case 'parent':
      return parentText(entry);
    case 'labels':
      return labelText(entry);
    case 'due':
      return entry.to
        ? `Prazo definido para ${formatFullDate(entry.to)}.`
        : 'Prazo retirado.';
    case 'due-done':
      return entry.done
        ? 'Prazo marcado como cumprido.'
        : 'Prazo marcado como não cumprido.';
    case 'checklist':
      return entry.total === 0
        ? 'Checklist esvaziado.'
        : `Checklist com ${entry.done} de ${entry.total} itens feitos.`;
    case 'archived':
      return 'Arquivado.';
    case 'restored':
      return `Restaurado em ${entry.lane}.`;
    case 'duplicated':
      return `Duplicado de ${entry.from}.`;
    case 'assignee':
      return entry.to ? `Responsável: ${entry.to}.` : 'Responsável retirado.';
    case 'attachment':
      return entry.added
        ? `Anexo ${entry.added} adicionado.`
        : `Anexo ${entry.removed ?? ''} removido.`;
    case 'process-started':
      return `Processo ${entry.name} iniciado.`;
    case 'process-step':
      return entry.detail
        ? `Etapa ${entry.step} resolvida: ${entry.detail}.`
        : `Etapa ${entry.step} resolvida.`;
    case 'process-finished':
      return entry.outcome
        ? `Processo ${entry.name} concluído: ${entry.outcome}.`
        : `Processo ${entry.name} concluído.`;
    case 'process-cancelled':
      return `Processo ${entry.name} cancelado.`;
    case 'process-removed':
      return `Processo ${entry.name} removido do card.`;
    case 'blocker-added':
      return `Passou a ser bloqueado por ${entry.blocker}.`;
    case 'blocker-removed':
      return `Deixou de ser bloqueado por ${entry.blocker}.`;
    case 'checklist-converted':
      return `Item "${entry.item}" do checklist convertido em card filho.`;
    case 'from-checklist':
      return `Criado em ${entry.lane} a partir de um item do checklist de ${entry.parent}.`;
  }
}
