import type { AriaLabelConfig } from '@xyflow/react';

import { ariaLabels } from '../aria-labels';

const READ_ONLY_BLOCK = 'Bloco do diagrama da execução, somente leitura.';

/**
 * Textos de acessibilidade do diagrama da execução: os do editor, sem as instruções de selecionar, mover e remover,
 * que aqui não valem.
 */
export const viewerAriaLabels: Partial<AriaLabelConfig> = {
  ...ariaLabels,
  'node.a11yDescription.default': READ_ONLY_BLOCK,
  'node.a11yDescription.keyboardDisabled': READ_ONLY_BLOCK,
  'edge.a11yDescription.default':
    'Conexão do diagrama da execução, somente leitura.',
  'controls.ariaLabel': 'Controles do diagrama',
  'controls.fitView.ariaLabel': 'Ajustar à tela',
};
