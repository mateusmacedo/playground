import { type BlockData, type GraphNode, kindOf } from '../model/blocks';
import {
  channelLabel,
  formatDateTime,
  formatDuration,
  formatSchedule,
  outcomeText,
} from '../model/fields';

function filled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/** A informação principal de cada tipo, mostrada sob o nome no canvas; vazia quando o campo não foi preenchido. */
export function nodeDetail(node: Pick<GraphNode, 'type' | 'data'>): string {
  const { data } = node;
  switch (kindOf(node)) {
    case 'start':
      return startDetail(data);
    case 'human-task':
      return filled(data.role) ? `Papel: ${data.role}` : '';
    case 'approval':
      return filled(data.role) ? `Aprovador: ${data.role}` : '';
    case 'automated-task':
      return filled(data.system) ? `Sistema: ${data.system}` : '';
    case 'send-message':
      return messageDetail(data);
    case 'wait-event':
      return data.deadline ? `Prazo: ${formatDuration(data.deadline)}` : '';
    case 'timer':
      return timerDetail(data);
    case 'exception':
      return data.exceptionTrigger === 'timeout' && data.timeout
        ? `Após ${formatDuration(data.timeout)}`
        : '';
    case 'subprocess':
      return filled(data.goal) ? data.goal : '';
    case 'end':
      return outcomeText(data);
    default:
      return filled(data.description) ? data.description : '';
  }
}

function messageDetail(data: BlockData): string {
  if (!data.channel) {
    return '';
  }
  const channel = channelLabel(data.channel);
  return filled(data.recipient) ? `${channel} para ${data.recipient}` : channel;
}

function startDetail(data: BlockData): string {
  if (data.trigger === 'schedule' && data.schedule) {
    return formatSchedule(data.schedule);
  }
  if (data.trigger === 'message' && filled(data.triggerMessage)) {
    return `Ao receber: ${data.triggerMessage}`;
  }
  return '';
}

function timerDetail(data: BlockData): string {
  if (data.timerMode === 'until') {
    return data.until ? `Até ${formatDateTime(data.until)}` : '';
  }
  return data.duration ? `Espera ${formatDuration(data.duration)}` : '';
}
