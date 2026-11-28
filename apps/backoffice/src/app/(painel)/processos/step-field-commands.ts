import {
  addStepField,
  removeStepField,
  updateStepField,
} from './model/step-fields';
import type {
  RemoveStepFieldChange,
  UpdateStepFieldChange,
} from './properties/panel-commands';
import type { GraphChange } from './use-document-history';

export interface StepFieldCommandsParams {
  readonly change: (change: GraphChange) => void;
  readonly createId: () => string;
}

/**
 * Campos a preencher de uma etapa: criar, editar e remover, cada um como um passo do histórico. A `key` junta a
 * digitação seguida na mesma propriedade do mesmo campo num passo só.
 */
export function createStepFieldCommands({
  change,
  createId,
}: Readonly<StepFieldCommandsParams>) {
  function addField(nodeId: string) {
    change({
      update: (current) => addStepField({ graph: current, nodeId, createId }),
    });
  }

  function updateField({
    nodeId,
    fieldId,
    patch,
  }: Readonly<UpdateStepFieldChange>) {
    const properties = Object.keys(patch).join(',');
    change({
      update: (current) =>
        updateStepField({ graph: current, nodeId, fieldId, patch }),
      key: `step-field:${nodeId}:${fieldId}:${properties}`,
    });
  }

  function removeField({ nodeId, fieldId }: Readonly<RemoveStepFieldChange>) {
    change({
      update: (current) => removeStepField({ graph: current, nodeId, fieldId }),
    });
  }

  return {
    addStepField: addField,
    updateStepField: updateField,
    removeStepField: removeField,
  };
}
