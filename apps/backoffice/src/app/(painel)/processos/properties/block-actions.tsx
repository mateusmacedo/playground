import { cilBolt, cilExternalLink, cilSwapHorizontal } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormSelect } from '@coreui/react';
import { useId, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import {
  acceptsExceptions,
  type BlockKind,
  blockName,
  kindOf,
  PAIRED_SPLIT,
  specOf,
} from '../model/blocks';
import { CONVERSIONS, conversionReport } from '../model/conversion';
import type { Lane } from '../model/document';
import type { ProcessGraph, ProcessNode } from '../process-graph';
import type { PanelCommands } from './panel-commands';

interface ActionProps {
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly commands: PanelCommands;
}

/** Converter a Etapa em outra atividade, mostrando antes o que se perde. */
function Conversions({ node, graph, commands }: Readonly<ActionProps>) {
  const [target, setTarget] = useState<BlockKind | null>(null);
  const options = CONVERSIONS[kindOf(node)] ?? [];
  if (options.length === 0) {
    return null;
  }
  const report =
    target === null
      ? null
      : conversionReport({ graph, nodeId: node.id, to: target });
  const lossCount =
    (report?.lostFields.length ?? 0) +
    (report?.lostEdgeIds.length ?? 0) +
    (report?.lostNodeIds.length ?? 0);
  return (
    <div className="d-grid gap-2 mb-3">
      {options.map((kind) => (
        <CButton
          key={kind}
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => setTarget(kind)}
        >
          <CIcon icon={cilSwapHorizontal} aria-hidden="true" className="me-1" />
          Converter em {specOf(kind).label}
        </CButton>
      ))}
      <ConfirmModal
        visible={target !== null}
        title={`Converter em ${target ? specOf(target).label : ''}`}
        confirmLabel="Converter"
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target !== null) {
            commands.convert({ nodeId: node.id, to: target });
          }
          setTarget(null);
        }}
      >
        {lossCount === 0 ? (
          <p className="mb-0">
            Sem incompatibilidades: o título, a descrição e as conexões são
            mantidos.
          </p>
        ) : (
          <>
            <p>A conversão remove o que o tipo novo não tem:</p>
            <ul className="mb-0">
              {report?.lostFields.map((field) => (
                <li key={field}>Campo {field}</li>
              ))}
              {report && report.lostEdgeIds.length > 0 ? (
                <li>{report.lostEdgeIds.length} conexão(ões)</li>
              ) : null}
              {report && report.lostNodeIds.length > 0 ? (
                <li>{report.lostNodeIds.length} evento(s) de exceção</li>
              ) : null}
            </ul>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}

interface LaneSelectProps {
  readonly node: ProcessNode;
  readonly lanes: readonly Lane[];
  readonly commands: PanelCommands;
}

function LaneSelect({ node, lanes, commands }: Readonly<LaneSelectProps>) {
  const id = useId();
  if (lanes.length === 0 || node.parentId !== undefined) {
    return null;
  }
  return (
    <CFormSelect
      id={id}
      label="Raia"
      className="mb-3"
      value={node.data.laneId ?? ''}
      onChange={(event) =>
        commands.moveToLane({ nodeId: node.id, laneId: event.target.value })
      }
    >
      <option value="" disabled>
        Sem raia
      </option>
      {lanes.map((lane) => (
        <option key={lane.id} value={lane.id}>
          {lane.name}
        </option>
      ))}
    </CFormSelect>
  );
}

/** Os ramos da abertura que a sincronização ou a junção espera. */
function ExpectedArrivals({
  node,
  graph,
}: Readonly<Omit<ActionProps, 'commands'>>) {
  if (PAIRED_SPLIT[kindOf(node)] === undefined) {
    return null;
  }
  const split = graph.nodes.find(
    (candidate) => candidate.id === node.data.pairId,
  );
  if (!split) {
    return null;
  }
  return (
    <div className="mb-3">
      <p className="small fw-semibold mb-1">
        Chegadas esperadas de {blockName(split)}
      </p>
      <ul className="small mb-0">
        {(split.data.branches ?? []).map((branch) => (
          <li key={branch.id}>{branch.label}</li>
        ))}
      </ul>
    </div>
  );
}

export interface BlockActionsProps extends ActionProps {
  readonly lanes: readonly Lane[];
}

/** Ações que dependem do tipo: converter, prender exceção, abrir subprocesso, raia e chegadas esperadas. */
export function BlockActions(props: Readonly<BlockActionsProps>) {
  const { node, commands } = props;
  const kind = kindOf(node);
  return (
    <>
      <LaneSelect node={node} lanes={props.lanes} commands={commands} />
      <ExpectedArrivals node={node} graph={props.graph} />
      <Conversions {...props} />
      {acceptsExceptions(kind) ? (
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          className="mb-3 me-2"
          onClick={() => commands.addException(node.id)}
        >
          <CIcon icon={cilBolt} aria-hidden="true" className="me-1" />
          Adicionar evento de exceção
        </CButton>
      ) : null}
      {kind === 'subprocess' ? (
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          className="mb-3"
          onClick={() => commands.openSubprocess(node.id)}
        >
          <CIcon icon={cilExternalLink} aria-hidden="true" className="me-1" />
          Abrir subprocesso
        </CButton>
      ) : null}
    </>
  );
}
