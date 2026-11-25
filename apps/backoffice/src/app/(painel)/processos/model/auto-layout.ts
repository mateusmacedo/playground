import {
  type Graph,
  type GraphEdge,
  type GraphNode,
  kindOf,
  type Point,
} from './blocks';
import { LANE_WIDTH, type Lane, laneBands } from './document';
import { BLOCK_SIZE, GRID_STEP, snapToGrid } from './geometry';

const ROW_STEP = BLOCK_SIZE.height + 4 * GRID_STEP;
const COLUMN_GAP = 3 * GRID_STEP;
const COLUMN_STEP = BLOCK_SIZE.width + COLUMN_GAP;
/** Espaço no topo das raias para o nome delas. */
const LANE_HEADER = 4 * GRID_STEP;
/** Grupo dos blocos sem raia quando o processo tem raias: eles ficam numa coluna depois da última. */
const NO_LANE = '';

type Links = Map<string, string[]>;

interface FlowLinks {
  readonly forward: Links;
  readonly backward: Links;
}

/** Ligações entre os blocos organizáveis; a conexão que sai de uma exceção conta como saindo da tarefa dela. */
interface LayoutLinksParams {
  readonly ids: ReadonlySet<string>;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

function layoutLinks(params: LayoutLinksParams): Links {
  const { ids, nodes, edges } = params;
  const ownerOf = new Map<string, string>();
  for (const node of nodes) {
    if (node.parentId !== undefined) {
      ownerOf.set(node.id, node.parentId);
    }
  }
  const links: Links = new Map();
  for (const id of ids) {
    links.set(id, []);
  }
  for (const edge of edges) {
    const source = ownerOf.get(edge.source) ?? edge.source;
    if (ids.has(source) && ids.has(edge.target) && source !== edge.target) {
      links.get(source)?.push(edge.target);
    }
  }
  return links;
}

/** Separa as ligações que voltam para trás (os retornos do processo), para as camadas não entrarem em ciclo. */
interface SplitBackLinksParams {
  readonly order: readonly string[];
  readonly links: Links;
}

function splitBackLinks(params: SplitBackLinksParams): FlowLinks {
  const { order, links } = params;
  const forward: Links = new Map();
  const backward: Links = new Map();
  for (const id of order) {
    forward.set(id, []);
    backward.set(id, []);
  }
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'open');
    for (const next of links.get(id) ?? []) {
      const nextState = state.get(next);
      if (nextState === 'open') {
        backward.get(id)?.push(next);
        continue;
      }
      forward.get(id)?.push(next);
      if (nextState === undefined) {
        visit(next);
      }
    }
    state.set(id, 'done');
  };
  for (const id of order) {
    if (!state.has(id)) {
      visit(id);
    }
  }
  return { forward, backward };
}

/** Camada de cada bloco: o caminho mais longo desde um bloco sem antecessor, sem contar os retornos. */
interface LayersOfParams {
  readonly order: readonly string[];
  readonly forward: Links;
}

function layersOf(params: LayersOfParams): Map<string, number> {
  const { order, forward } = params;
  const incoming = new Map<string, number>();
  for (const id of order) {
    incoming.set(id, 0);
  }
  for (const targets of forward.values()) {
    for (const target of targets) {
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }
  const layer = new Map<string, number>();
  const ready = order.filter((id) => incoming.get(id) === 0);
  for (const id of ready) {
    layer.set(id, 0);
  }
  let current = ready.shift();
  while (current !== undefined) {
    const currentLayer = layer.get(current) ?? 0;
    for (const target of forward.get(current) ?? []) {
      layer.set(target, Math.max(layer.get(target) ?? 0, currentLayer + 1));
      const remaining = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, remaining);
      if (remaining === 0) {
        ready.push(target);
      }
    }
    current = ready.shift();
  }
  return layer;
}

/** Ordem de visita: o Início primeiro, depois os blocos na ordem em que aparecem na tela, de cima para baixo. */
function visitOrder(nodes: readonly GraphNode[]): string[] {
  const sorted = [...nodes].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
  const starts = sorted.filter((node) => kindOf(node) === 'start');
  const others = sorted.filter((node) => kindOf(node) !== 'start');
  return [...starts, ...others].map((node) => node.id);
}

interface Placement {
  readonly layer: number;
  readonly group: string;
}

/** Ordena cada camada pela média da posição dos antecessores na camada de cima, para cruzar menos linhas. */
interface OrderRowsParams {
  readonly order: readonly string[];
  readonly placement: ReadonlyMap<string, Placement>;
  readonly forward: Links;
}

function orderRows(params: OrderRowsParams): Map<string, string[]> {
  const { order, placement, forward } = params;
  const predecessors: Links = new Map();
  for (const [source, targets] of forward) {
    for (const target of targets) {
      const list = predecessors.get(target) ?? [];
      list.push(source);
      predecessors.set(target, list);
    }
  }
  const rows = new Map<string, string[]>();
  const indexOf = new Map<string, number>();
  const deepest = Math.max(0, ...[...placement.values()].map((p) => p.layer));
  for (let layer = 0; layer <= deepest; layer += 1) {
    const inLayer = order.filter((id) => placement.get(id)?.layer === layer);
    const weight = (id: string) => {
      const parents = predecessors.get(id) ?? [];
      if (parents.length === 0) {
        return order.indexOf(id);
      }
      let sum = 0;
      for (const parent of parents) {
        sum += indexOf.get(parent) ?? 0;
      }
      return sum / parents.length;
    };
    const sorted = [...inLayer].sort((a, b) => weight(a) - weight(b));
    for (const id of sorted) {
      const group = placement.get(id)?.group ?? NO_LANE;
      const key = `${group}:${layer}`;
      const row = rows.get(key) ?? [];
      indexOf.set(id, row.length);
      row.push(id);
      rows.set(key, row);
    }
  }
  return rows;
}

export interface AutoLayoutParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly lanes: readonly Lane[];
}

export interface AutoLayoutResult<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly lanes: readonly Lane[];
}

interface WidestRowParams {
  readonly rows: ReadonlyMap<string, readonly string[]>;
  readonly group: string;
}

function widestRow(params: WidestRowParams): number {
  let widest = 0;
  for (const [key, row] of params.rows) {
    if (key.startsWith(`${params.group}:`)) {
      widest = Math.max(widest, row.length);
    }
  }
  return widest;
}

/** Largura das raias depois do layout: cabe a linha mais larga de cada uma. */
interface FittedLanesParams {
  readonly lanes: readonly Lane[];
  readonly rows: ReadonlyMap<string, readonly string[]>;
}

function fittedLanes(params: FittedLanesParams): Lane[] {
  const { lanes, rows } = params;
  return lanes.map((lane) => {
    const needed =
      widestRow({ rows, group: lane.id }) * COLUMN_STEP + COLUMN_GAP;
    return { ...lane, width: Math.max(LANE_WIDTH, snapToGrid(needed)) };
  });
}

/** Esquerda e largura de cada grupo: a raia, ou uma coluna livre depois delas para os blocos sem raia. */
interface Area {
  readonly left: number;
  readonly width: number;
}

interface GroupAreasParams {
  readonly lanes: readonly Lane[];
  readonly rows: ReadonlyMap<string, readonly string[]>;
}

function groupAreas(params: GroupAreasParams): Map<string, Area> {
  const { lanes, rows } = params;
  const areas = new Map<string, Area>();
  let right = 0;
  for (const band of laneBands(lanes)) {
    areas.set(band.lane.id, { left: band.left, width: band.lane.width });
    right = band.left + band.lane.width;
  }
  const looseWidth =
    widestRow({ rows, group: NO_LANE }) * COLUMN_STEP + COLUMN_GAP;
  areas.set(NO_LANE, { left: right, width: looseWidth });
  return areas;
}

/**
 * Organiza o processo de cima para baixo em camadas, sem mudar conexões nem raias: cada bloco fica na raia dele, as
 * raias mantêm a ordem e só a largura delas cresce se uma linha não couber. Exceções seguem a tarefa; anotações ficam.
 */
export function autoLayout<N extends GraphNode, E extends GraphEdge>(
  params: AutoLayoutParams<N, E>,
): AutoLayoutResult<N, E> {
  const { graph, lanes } = params;
  const layoutNodes = graph.nodes.filter(
    (node) => node.parentId === undefined && kindOf(node) !== 'annotation',
  );
  if (layoutNodes.length === 0) {
    return { graph, lanes };
  }
  const ids = new Set(layoutNodes.map((node) => node.id));
  const order = visitOrder(layoutNodes);
  const links = layoutLinks({ ids, nodes: graph.nodes, edges: graph.edges });
  const { forward } = splitBackLinks({ order, links });
  const layers = layersOf({ order, forward });
  const laneIds = new Set(lanes.map((lane) => lane.id));
  const placement = new Map<string, Placement>();
  for (const node of layoutNodes) {
    const laneId = node.data.laneId;
    const group =
      laneId !== undefined && laneIds.has(laneId) ? laneId : NO_LANE;
    placement.set(node.id, { layer: layers.get(node.id) ?? 0, group });
  }
  const rows = orderRows({ order, placement, forward });
  const newLanes = lanes.length > 0 ? fittedLanes({ lanes, rows }) : [...lanes];
  const areas = groupAreas({ lanes: newLanes, rows });
  const top = newLanes.length > 0 ? LANE_HEADER : 0;
  const positions = new Map<string, Point>();
  for (const [key, row] of rows) {
    const [group = NO_LANE, layerText = '0'] = key.split(':');
    const area = areas.get(group) ?? { left: 0, width: 0 };
    const rowWidth = row.length * COLUMN_STEP - COLUMN_GAP;
    const start = area.left + (area.width - rowWidth) / 2;
    for (let index = 0; index < row.length; index += 1) {
      const id = row[index];
      if (id === undefined) {
        continue;
      }
      positions.set(id, {
        x: snapToGrid(start + index * COLUMN_STEP),
        y: top + Number(layerText) * ROW_STEP,
      });
    }
  }
  const nodes = graph.nodes.map((node) => {
    const position = positions.get(node.id);
    return position === undefined ? node : { ...node, position };
  });
  return { graph: { nodes, edges: graph.edges }, lanes: newLanes };
}
