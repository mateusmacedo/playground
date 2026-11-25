import {
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
} from '@coreui/react';
import { useId } from 'react';

import {
  type BlockData,
  blockName,
  kindOf,
  PAIRED_SPLIT,
} from '../model/blocks';
import {
  type BlockField,
  FIELD_LABEL,
  FIELDS_BY_KIND,
} from '../model/conversion';
import type { ProcessGraph, ProcessNode } from '../process-graph';
import type { PanelCommands } from './panel-commands';

/** Campos que o painel desenha à parte: os ramos no editor de ramos e o canvas interno pela navegação. */
const SEPARATE_FIELDS = new Set<BlockField>([
  'branches',
  'defaultBranchId',
  'process',
]);

const TEXTAREA_FIELDS = new Set<BlockField>([
  'description',
  'instructions',
  'expectedResult',
  'inputs',
  'outputs',
  'content',
]);

interface Option {
  readonly value: string;
  readonly label: string;
}

const SELECT_OPTIONS: Readonly<Partial<Record<BlockField, readonly Option[]>>> =
  {
    trigger: [
      { value: 'manual', label: 'Manual' },
      { value: 'message', label: 'Por mensagem' },
      { value: 'schedule', label: 'Por agendamento' },
    ],
    timerMode: [
      { value: 'duration', label: 'Por uma duração' },
      { value: 'until', label: 'Até data e horário' },
    ],
    exceptionTrigger: [
      { value: 'error', label: 'Erro técnico' },
      { value: 'timeout', label: 'Tempo esgotado' },
    ],
  };

const PLACEHOLDER: Readonly<Partial<Record<BlockField, string>>> = {
  deadline: 'Ex.: 48 horas; vazio, sem prazo',
  duration: 'Ex.: 2 dias',
  dueIn: 'Ex.: 24 horas',
};

const OUTCOMES = ['Concluído', 'Recusado', 'Cancelado', 'Expirado'];

interface VisibleParams {
  readonly node: ProcessNode;
  readonly field: BlockField;
}

/** O campo aparece para o tipo e, no temporizador, só o do modo escolhido. */
function isVisible(params: VisibleParams): boolean {
  const { node, field } = params;
  if (SEPARATE_FIELDS.has(field)) {
    return false;
  }
  const untilMode = node.data.timerMode === 'until';
  if (field === 'duration') {
    return !untilMode;
  }
  if (field === 'until') {
    return untilMode;
  }
  return true;
}

export interface BlockFieldsProps {
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly commands: PanelCommands;
}

/** Os campos próprios do tipo do bloco, na ordem de `FIELDS_BY_KIND`. */
export function BlockFields({
  node,
  graph,
  commands,
}: Readonly<BlockFieldsProps>) {
  const update = (patch: Partial<BlockData>) =>
    commands.updateBlock({ nodeId: node.id, patch });
  const fields = FIELDS_BY_KIND[kindOf(node)].filter((field) =>
    isVisible({ node, field }),
  );
  return (
    <>
      {fields.map((field) => (
        <FieldControl
          key={field}
          field={field}
          node={node}
          graph={graph}
          update={update}
        />
      ))}
    </>
  );
}

interface FieldControlProps {
  readonly field: BlockField;
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly update: (patch: Partial<BlockData>) => void;
}

function FieldControl({
  field,
  node,
  graph,
  update,
}: Readonly<FieldControlProps>) {
  const id = useId();
  const label = FIELD_LABEL[field];
  const value = node.data[field];
  const text = typeof value === 'string' ? value : '';
  const options = SELECT_OPTIONS[field];

  if (field === 'interrupting') {
    return (
      <CFormCheck
        id={id}
        className="mb-3"
        label="Interrompe a atividade (sem marcar, abre um caminho a mais)"
        checked={node.data.interrupting !== false}
        onChange={(event) => update({ interrupting: event.target.checked })}
      />
    );
  }
  if (field === 'pairId') {
    return <PairSelect node={node} graph={graph} update={update} />;
  }
  if (options) {
    return (
      <CFormSelect
        id={id}
        label={label}
        className="mb-3"
        value={text || options[0]?.value}
        onChange={(event) => update({ [field]: event.target.value })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </CFormSelect>
    );
  }
  if (TEXTAREA_FIELDS.has(field)) {
    return (
      <CFormTextarea
        id={id}
        label={label}
        rows={field === 'description' ? 2 : 3}
        className="mb-3"
        value={text}
        onChange={(event) => update({ [field]: event.target.value })}
      />
    );
  }
  return (
    <>
      <CFormInput
        id={id}
        label={label}
        className="mb-3"
        type={field === 'until' ? 'datetime-local' : 'text'}
        placeholder={PLACEHOLDER[field]}
        list={field === 'outcome' ? `${node.id}-outcomes` : undefined}
        value={text}
        onChange={(event) => update({ [field]: event.target.value })}
      />
      {field === 'outcome' ? (
        <datalist id={`${node.id}-outcomes`}>
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}

interface PairSelectProps {
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly update: (patch: Partial<BlockData>) => void;
}

/** A abertura que a sincronização ou a junção espera, entre as do tipo certo neste canvas. */
function PairSelect({ node, graph, update }: Readonly<PairSelectProps>) {
  const id = useId();
  const splitKind = PAIRED_SPLIT[kindOf(node)];
  const splits = graph.nodes.filter(
    (candidate) => kindOf(candidate) === splitKind,
  );
  return (
    <CFormSelect
      id={id}
      label={FIELD_LABEL.pairId}
      className="mb-3"
      value={node.data.pairId ?? ''}
      onChange={(event) => update({ pairId: event.target.value || undefined })}
    >
      <option value="">Escolha a abertura</option>
      {splits.map((split) => (
        <option key={split.id} value={split.id}>
          {blockName(split)}
        </option>
      ))}
    </CFormSelect>
  );
}
