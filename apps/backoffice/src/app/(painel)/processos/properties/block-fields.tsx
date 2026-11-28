import { CFormFeedback, CFormInput } from '@coreui/react';
import { useId } from 'react';

import type { BlockData, EndOutcome } from '../model/blocks';
import { blockName, kindOf, PAIRED_SPLIT } from '../model/blocks';
import {
  type BlockField,
  FIELD_LABEL,
  FIELDS_BY_KIND,
  fieldLabel,
} from '../model/conversion';
import type { Lane } from '../model/document';
import { CHANNELS, isChannel, OUTCOMES } from '../model/fields';
import type { ProcessGraph, ProcessNode } from '../process-graph';
import { EVENT_FIELDS, EventField } from './event-fields';
import {
  Choice,
  type FieldProps,
  TEXTAREA_FIELDS,
  TextField,
  type Update,
} from './field-controls';
import type { PanelCommands } from './panel-commands';
import { OptionalDuration } from './time-inputs';

/**
 * Campos que o painel desenha à parte: os ramos no editor de ramos, os campos a preencher no editor deles e o canvas
 * interno pela navegação.
 */
const SEPARATE_FIELDS = new Set<BlockField>([
  'branches',
  'defaultBranchId',
  'process',
  'fields',
]);

/** Campos que são de fato texto: nomes de sistema, operação, destinatário, evento e objetivo. */
const TEXT_FIELDS = new Set<BlockField>([
  'system',
  'operation',
  'recipient',
  'eventName',
  'goal',
]);

/** Escolher "Outro" abre o nome do desfecho; escolher da lista apaga um nome antigo. */
export function outcomePatch(outcome: EndOutcome): Partial<BlockData> {
  return outcome === 'other'
    ? { outcome, outcomeLabel: '' }
    : { outcome, outcomeLabel: undefined };
}

/** Com raias, o papel é o da raia e muda pela raia; sem raias, é o nome digitado. */
function RoleField({ node, lanes, update }: Readonly<FieldProps>) {
  const id = useId();
  const kind = kindOf(node);
  const label = fieldLabel({ kind, field: 'role' });
  if (lanes.length > 0) {
    const role = node.data.role?.trim();
    const owner = kind === 'approval' ? 'aprovação' : 'tarefa';
    return (
      <p className="small mb-3">
        <span className="fw-semibold">{label}:</span>{' '}
        {role ? role : `escolha a raia da ${owner} abaixo`}
      </p>
    );
  }
  return (
    <CFormInput
      id={id}
      label={label}
      className="mb-3"
      value={node.data.role ?? ''}
      onChange={(event) => update({ role: event.target.value })}
    />
  );
}

function OutcomeLabelField({ node, update }: Readonly<FieldProps>) {
  const id = useId();
  const feedbackId = useId();
  if (node.data.outcome !== 'other') {
    return null;
  }
  const blank = (node.data.outcomeLabel ?? '').trim() === '';
  return (
    <div className="mb-3">
      <CFormInput
        id={id}
        label={FIELD_LABEL.outcomeLabel}
        required
        invalid={blank}
        aria-describedby={blank ? feedbackId : undefined}
        value={node.data.outcomeLabel ?? ''}
        onChange={(event) => update({ outcomeLabel: event.target.value })}
      />
      {blank ? (
        <CFormFeedback invalid id={feedbackId} className="d-block">
          Dê um nome ao desfecho.
        </CFormFeedback>
      ) : null}
    </div>
  );
}

function PairSelect({ node, graph, update }: Readonly<FieldProps>) {
  const splitKind = PAIRED_SPLIT[kindOf(node)];
  const options = graph.nodes
    .filter((candidate) => kindOf(candidate) === splitKind)
    .map((split) => ({ value: split.id, label: blockName(split) }));
  return (
    <Choice
      label={FIELD_LABEL.pairId}
      value={node.data.pairId}
      options={options}
      placeholder="Escolha a abertura"
      onChange={(pairId) => update({ pairId })}
    />
  );
}

/** O controle de cada campo, conforme o propósito dele. */
function FieldControl(props: Readonly<FieldProps>) {
  const { field, node, update } = props;
  const { data } = node;
  if (EVENT_FIELDS.has(field)) {
    return <EventField {...props} />;
  }
  switch (field) {
    case 'role':
      return <RoleField {...props} />;
    case 'dueIn':
      return (
        <OptionalDuration
          toggleLabel="Tem prazo de atendimento"
          label={FIELD_LABEL.dueIn}
          value={data.dueIn}
          onChange={(dueIn) => update({ dueIn })}
        />
      );
    case 'channel':
      return (
        <Choice
          label={FIELD_LABEL.channel}
          value={isChannel(data.channel) ? data.channel : undefined}
          options={CHANNELS}
          placeholder="Escolha o canal"
          onChange={(channel) => update({ channel })}
        />
      );
    case 'pairId':
      return <PairSelect {...props} />;
    case 'outcome':
      return (
        <Choice
          label={FIELD_LABEL.outcome}
          value={data.outcome}
          options={OUTCOMES}
          placeholder="Escolha o desfecho"
          onChange={(outcome) => update(outcomePatch(outcome))}
        />
      );
    case 'outcomeLabel':
      return <OutcomeLabelField {...props} />;
    default:
      return TEXT_FIELDS.has(field) || TEXTAREA_FIELDS.has(field) ? (
        <TextField {...props} />
      ) : null;
  }
}

export interface BlockFieldsProps {
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly lanes: readonly Lane[];
  readonly commands: PanelCommands;
}

/** Os campos próprios do tipo do bloco, na ordem de `FIELDS_BY_KIND`, cada um com o controle do seu propósito. */
export function BlockFields({
  node,
  graph,
  lanes,
  commands,
}: Readonly<BlockFieldsProps>) {
  const update: Update = (patch) =>
    commands.updateBlock({ nodeId: node.id, patch });
  const fields = FIELDS_BY_KIND[kindOf(node)].filter(
    (field) => !SEPARATE_FIELDS.has(field),
  );
  return (
    <>
      {fields.map((field) => (
        <FieldControl
          key={field}
          field={field}
          node={node}
          graph={graph}
          lanes={lanes}
          update={update}
        />
      ))}
    </>
  );
}
