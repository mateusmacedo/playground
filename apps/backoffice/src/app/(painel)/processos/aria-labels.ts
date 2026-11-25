import type { AriaLabelConfig } from '@xyflow/react';

const DIRECTIONS: Readonly<Record<string, string>> = {
  up: 'para cima',
  down: 'para baixo',
  left: 'para a esquerda',
  right: 'para a direita',
};

/** Textos de acessibilidade do React Flow em PT-BR. */
export const ariaLabels: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default':
    'Pressione Enter ou Espaço para selecionar o bloco. Pressione Delete para removê-lo e Esc para cancelar.',
  'node.a11yDescription.keyboardDisabled':
    'Pressione Enter ou Espaço para selecionar o bloco. Depois, use as setas para movê-lo. Pressione Delete para removê-lo e Esc para cancelar.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) =>
    `Bloco movido ${DIRECTIONS[direction] ?? direction}. Nova posição: x ${x}, y ${y}.`,
  'edge.a11yDescription.default':
    'Pressione Enter ou Espaço para selecionar a conexão. Depois, pressione Delete para removê-la ou Esc para cancelar.',
  'controls.ariaLabel': 'Controles do canvas',
  'controls.zoomIn.ariaLabel': 'Aumentar o zoom',
  'controls.zoomOut.ariaLabel': 'Diminuir o zoom',
  'minimap.ariaLabel': 'Minimapa',
};
