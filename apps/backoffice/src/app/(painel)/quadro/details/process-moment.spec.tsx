import { render, screen } from '@testing-library/react';

import { formatMoment, ProcessMoment } from './process-moment';

const AT = '2026-11-26T10:00:00.000Z';

/** Data e hora curtas em português, sem depender do fuso de quem roda o teste. */
const SHORT_MOMENT = /^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/;

describe('formatMoment', () => {
  it('escreve a data e a hora curtas', () => {
    expect(formatMoment(AT)).toMatch(SHORT_MOMENT);
  });

  it('devolve vazio para o instante ilegível', () => {
    expect(formatMoment('ontem')).toBe('');
  });
});

describe('ProcessMoment', () => {
  it('mostra o instante legível e leva o original para as máquinas', () => {
    render(<ProcessMoment at={AT} className="text-body-secondary" />);

    const time = screen.getByText(SHORT_MOMENT);

    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe(AT);
    expect(time.className).toBe('text-body-secondary');
  });
});
