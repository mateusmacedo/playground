'use client';

import '@xyflow/react/dist/style.css';

import { useMemo, useState } from 'react';

import type { StepStates } from '@/shared/process/engine-states';

import type { Graph } from '../model/blocks';
import type { Lane, ProcessDocument } from '../model/document';
import { parseDocument } from '../model/draft';
import { graphAt, type ProcessPath, pathCrumbs } from '../model/subprocess';
import { toProcessGraph } from '../process-graph';
import { SubprocessBreadcrumb } from '../subprocess-breadcrumb';
import { RunCanvas } from './run-canvas';
import { RunLegend } from './run-legend';
import { levelScope, nodeMarks, takenEdgeIds } from './run-marks';

const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };
const NO_LANES: readonly Lane[] = [];

interface RunLevelsProps extends StepStates {
  readonly document: ProcessDocument;
}

/** O desenho já lido: a legenda, a trilha dos subprocessos abertos e o nível atual com as marcas da execução. */
function RunLevels({ document, states, takenExits }: Readonly<RunLevelsProps>) {
  const [openPath, setOpenPath] = useState<ProcessPath>([]);
  const root = document.graph;
  const crumbs = useMemo(
    () => pathCrumbs({ root, path: openPath }),
    [root, openPath],
  );
  // WHY: o caminho que vale é o que a trilha confirma; se o desenho mudar com um subprocesso aberto, o diagrama volta
  // ao último nível que ainda existe em vez de mostrar um nível que sumiu.
  const path = useMemo(() => crumbs.map((crumb) => crumb.nodeId), [crumbs]);
  const level = useMemo(
    () => toProcessGraph(graphAt({ root, path }) ?? EMPTY_GRAPH),
    [root, path],
  );
  const marks = useMemo(() => {
    const levelRun = {
      graph: level,
      scope: levelScope(path),
      states,
      takenExits,
    };
    return { nodes: nodeMarks(levelRun), takenEdges: takenEdgeIds(levelRun) };
  }, [level, path, states, takenExits]);

  return (
    <div className="process-run-viewer">
      <RunLegend />
      <SubprocessBreadcrumb
        crumbs={crumbs}
        onOpenLevel={(depth) => setOpenPath(path.slice(0, depth))}
      />
      {level.nodes.length === 0 ? (
        <p role="status" className="small text-body-secondary mb-2">
          Este nível do processo não tem blocos desenhados.
        </p>
      ) : null}
      <div className="process-run-viewer__canvas">
        <RunCanvas
          // WHY: cada nível é um diagrama novo; remontar faz o React Flow enquadrar o nível aberto.
          key={path.join('/')}
          level={level}
          lanes={path.length === 0 ? document.lanes : NO_LANES}
          marks={marks}
          onOpenSubprocess={(nodeId) => setOpenPath([...path, nodeId])}
        />
      </div>
    </div>
  );
}

export interface ProcessRunViewerProps extends StepStates {
  /** Desenho da versão em execução, no texto em que o editor o publica. */
  readonly documentText: string;
}

/**
 * Diagrama da execução: o desenho do processo, somente leitura, com a etapa atual, as em espera, as concluídas e os
 * caminhos percorridos em destaque, e a navegação para dentro dos subprocessos. Desenho ilegível vira estado de erro.
 */
export function ProcessRunViewer({
  documentText,
  states,
  takenExits,
}: Readonly<ProcessRunViewerProps>) {
  const reading = useMemo(() => parseDocument(documentText), [documentText]);
  if (reading === null) {
    return (
      <div role="alert" className="text-center py-5">
        <p className="mb-1">Não foi possível ler o desenho deste processo.</p>
        <p className="small text-body-secondary mb-0">
          O desenho desta versão, guardado neste navegador, está ilegível.
        </p>
      </div>
    );
  }
  return (
    <RunLevels
      document={reading.document}
      states={states}
      takenExits={takenExits}
    />
  );
}
