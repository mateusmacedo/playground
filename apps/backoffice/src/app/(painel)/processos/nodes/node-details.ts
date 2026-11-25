import { type GraphNode, kindOf } from '../model/blocks';

function filled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/** A informação principal de cada tipo, mostrada sob o nome no canvas; vazia quando o campo não foi preenchido. */
export function nodeDetail(node: Pick<GraphNode, 'type' | 'data'>): string {
  const { data } = node;
  switch (kindOf(node)) {
    case 'human-task':
      return filled(data.role) ? `Papel: ${data.role}` : '';
    case 'automated-task':
      return filled(data.system) ? `Sistema: ${data.system}` : '';
    case 'send-message':
      return filled(data.recipient) ? `Para: ${data.recipient}` : '';
    case 'wait-event':
      return filled(data.deadline) ? `Prazo: ${data.deadline}` : '';
    case 'timer':
      if (data.timerMode === 'until') {
        return filled(data.until) ? `Até ${data.until.replace('T', ' ')}` : '';
      }
      return filled(data.duration) ? `Espera ${data.duration}` : '';
    case 'subprocess':
      return filled(data.goal) ? data.goal : '';
    case 'end':
      return filled(data.outcome) ? data.outcome : '';
    default:
      return filled(data.description) ? data.description : '';
  }
}
