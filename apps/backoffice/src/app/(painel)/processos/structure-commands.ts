import { updateLevel } from './editor-document';
import {
  type AlignMode,
  alignSelection,
  type DistributeAxis,
  distributeSelection,
} from './model/arrange';
import { autoLayout } from './model/auto-layout';
import { createBlock } from './model/block-factory';
import type { BlockKind, Point } from './model/blocks';
import {
  attachException,
  connectNewBlock,
  insertOnEdge,
} from './model/composite';
import { convertBlock } from './model/conversion';
import {
  addLane,
  assignLane,
  type LaneDirection,
  moveLane,
  renameLane,
} from './model/document';
import type { ProcessPath } from './model/subprocess';
import type { ProcessNode } from './process-graph';
import type { DocumentChange, GraphChange } from './use-document-history';

/** Posição provisória de um bloco que o modelo reposiciona (no meio da conexão ou na borda da tarefa). */
const ORIGIN: Point = { x: 0, y: 0 };

interface NewBlockParams {
  readonly kind: BlockKind;
  readonly position: Point;
}

export interface StructureCommandsParams {
  readonly change: (change: GraphChange) => void;
  readonly changeDocument: (change: DocumentChange) => void;
  readonly createId: () => string;
  readonly path: ProcessPath;
}

export interface InsertOnEdgeChange {
  readonly edgeId: string;
  readonly kind: BlockKind;
}

export interface ConnectedBlockChange {
  readonly source: string;
  readonly sourceHandle: string | null;
  readonly kind: BlockKind;
  readonly position: Point;
}

export interface ConvertChange {
  readonly nodeId: string;
  readonly to: BlockKind;
}

export interface RenameLaneChange {
  readonly laneId: string;
  readonly name: string;
}

export interface MoveLaneChange {
  readonly laneId: string;
  readonly direction: LaneDirection;
}

export interface MoveToLaneChange {
  readonly nodeId: string;
  readonly laneId: string;
}

/**
 * Operações que mexem em mais de um elemento de uma vez. Cada uma é um único passo do histórico, então desfazer volta
 * tudo de uma vez: a conexão dividida, o bloco criado e ligado, a conversão, a raia trocada e a organização.
 */
export function createStructureCommands(params: StructureCommandsParams) {
  const { change, changeDocument, createId, path } = params;

  function newBlock({ kind, position }: Readonly<NewBlockParams>) {
    const block: ProcessNode = createBlock({ kind, position, createId });
    return block;
  }

  function insertBlockOnEdge({ edgeId, kind }: Readonly<InsertOnEdgeChange>) {
    change({
      update: (current) =>
        insertOnEdge({
          graph: current,
          edgeId,
          block: newBlock({ kind, position: ORIGIN }),
          createId,
        }),
    });
  }

  function addConnectedBlock(request: Readonly<ConnectedBlockChange>) {
    const { source, sourceHandle, kind, position } = request;
    change({
      update: (current) =>
        connectNewBlock({
          graph: current,
          connection: { source, sourceHandle },
          block: newBlock({ kind, position }),
          createId,
        }),
    });
  }

  function convert({ nodeId, to }: Readonly<ConvertChange>) {
    change({
      update: (current) => convertBlock({ graph: current, nodeId, to }),
    });
  }

  function addException(taskId: string) {
    change({
      update: (current) =>
        attachException({
          graph: current,
          taskId,
          block: newBlock({ kind: 'exception', position: ORIGIN }),
        }),
    });
  }

  function align(mode: AlignMode) {
    change({ update: (current) => alignSelection({ graph: current, mode }) });
  }

  function distribute(axis: DistributeAxis) {
    change({
      update: (current) => distributeSelection({ graph: current, axis }),
    });
  }

  function arrangeAutomatically() {
    changeDocument({
      update: (document) => {
        const atRoot = path.length === 0;
        const lanes = atRoot ? document.lanes : [];
        let laidOutLanes = lanes;
        const laidOut = updateLevel({
          document,
          path,
          update: (graph) => {
            const result = autoLayout({ graph, lanes });
            laidOutLanes = result.lanes;
            return result.graph;
          },
        });
        return atRoot ? { ...laidOut, lanes: laidOutLanes } : laidOut;
      },
    });
  }

  function createLane() {
    changeDocument({ update: (document) => addLane({ document, createId }) });
  }

  function renameLaneTo({ laneId, name }: Readonly<RenameLaneChange>) {
    changeDocument({
      update: (document) => renameLane({ document, laneId, name }),
      key: `lane:${laneId}:name`,
    });
  }

  function reorderLane({ laneId, direction }: Readonly<MoveLaneChange>) {
    changeDocument({
      update: (document) => moveLane({ document, laneId, direction }),
    });
  }

  function moveToLane({ nodeId, laneId }: Readonly<MoveToLaneChange>) {
    changeDocument({
      update: (document) => assignLane({ document, nodeId, laneId }),
    });
  }

  return {
    insertOnEdge: insertBlockOnEdge,
    addConnectedBlock,
    convert,
    addException,
    align,
    distribute,
    autoLayout: arrangeAutomatically,
    addLane: createLane,
    renameLane: renameLaneTo,
    moveLane: reorderLane,
    moveToLane,
  };
}
