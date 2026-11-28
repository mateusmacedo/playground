import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  type LevelMarks,
  RunMarksProvider,
  useEdgeTaken,
  useNodeMark,
} from './run-marks-context';

const marks: LevelMarks = {
  nodes: new Map([['review', 'active']]),
  takenEdges: new Set(['start-out-review']),
};

function withMarks({ children }: Readonly<{ children: ReactNode }>) {
  return <RunMarksProvider value={marks}>{children}</RunMarksProvider>;
}

describe('marcas da execução', () => {
  it('entregam a marca do bloco e dizem se a conexão foi percorrida', () => {
    const { result } = renderHook(
      () => ({
        mark: useNodeMark('review'),
        taken: useEdgeTaken('start-out-review'),
        notTaken: useEdgeTaken('review-out-end'),
      }),
      { wrapper: withMarks },
    );

    expect(result.current).toEqual({
      mark: 'active',
      taken: true,
      notTaken: false,
    });
  });

  it('recusam o uso fora do RunMarksProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useNodeMark('review'))).toThrow(
      'As marcas da execução precisam do RunMarksProvider.',
    );

    vi.restoreAllMocks();
  });
});
