import {
  allPlaces,
  innerStart,
  locate,
  placeIn,
  stepIdOf,
} from './engine-places';
import { end, placeAt, planOf, step, subprocess } from './engine-test-kit';

const check = step({ id: 'check', to: 'close' });
const close = end({ id: 'close' });
const review = subprocess({ id: 'review', inner: [check, close] });
const billing = subprocess({ id: 'billing', to: 'end', inner: [review] });
const broken = subprocess({
  id: 'broken',
  inner: [],
  data: { inner: { startId: 'ghost', steps: [check] } },
});
const open = step({ id: 'open', to: 'billing' });
const plan = planOf([open, billing, broken, end({ id: 'end' })]);

describe('stepIdOf', () => {
  it('devolve o último trecho do endereço', () => {
    expect(stepIdOf('billing/review/check')).toBe('check');
    expect(stepIdOf('open')).toBe('open');
  });
});

describe('placeIn', () => {
  it('localiza a etapa da raiz pelo id', () => {
    expect(placeIn({ level: plan, id: 'open' })).toEqual({
      stepRef: 'open',
      step: open,
      level: plan,
      scope: undefined,
    });
  });

  it('prefixa o endereço com o do subprocesso dono do nível', () => {
    const level = review.inner ?? plan;

    expect(placeIn({ level, scope: 'billing/review', id: 'check' })).toEqual({
      stepRef: 'billing/review/check',
      step: check,
      level,
      scope: 'billing/review',
    });
  });

  it('não localiza o id que o nível não tem nem a falta de id', () => {
    expect(placeIn({ level: plan, id: 'check' })).toBeUndefined();
    expect(placeIn({ level: plan, id: undefined })).toBeUndefined();
  });
});

describe('locate', () => {
  it('localiza a etapa da raiz e a de dentro de subprocessos', () => {
    expect(locate({ plan, stepRef: 'billing' })).toMatchObject({
      step: billing,
      level: plan,
    });
    expect(locate({ plan, stepRef: 'billing/review/check' })).toEqual({
      stepRef: 'billing/review/check',
      step: check,
      level: review.inner,
      scope: 'billing/review',
    });
  });

  it('não localiza a etapa que o nível não tem', () => {
    expect(locate({ plan, stepRef: 'ghost' })).toBeUndefined();
    expect(locate({ plan, stepRef: 'billing/ghost' })).toBeUndefined();
  });

  it('não localiza o endereço que entra numa etapa sem processo interno', () => {
    expect(locate({ plan, stepRef: 'open/check' })).toBeUndefined();
    expect(locate({ plan, stepRef: 'ghost/check' })).toBeUndefined();
  });
});

describe('innerStart', () => {
  it('devolve o início do processo interno, com o endereço prefixado', () => {
    const place = placeAt({ plan, stepRef: 'billing/review' });

    expect(innerStart(place)).toEqual({
      stepRef: 'billing/review/check',
      step: check,
      level: review.inner,
      scope: 'billing/review',
    });
  });

  it('não devolve início para a etapa em que não dá para entrar', () => {
    const task = placeAt({ plan, stepRef: 'open' });
    const invalid = placeAt({ plan, stepRef: 'broken' });

    expect(innerStart(task)).toBeUndefined();
    expect(innerStart(invalid)).toBeUndefined();
  });
});

describe('allPlaces', () => {
  it('lista as etapas de todos os níveis em que a execução consegue entrar', () => {
    const refs = allPlaces(plan).map((place) => place.stepRef);

    expect(refs).toEqual([
      'open',
      'billing',
      'billing/review',
      'billing/review/check',
      'billing/review/close',
      'broken',
      'end',
    ]);
  });

  it('cada etapa vem com o nível e o subprocesso dela', () => {
    const place = allPlaces(plan).find(
      (item) => item.stepRef === 'billing/review',
    );

    expect(place).toEqual({
      stepRef: 'billing/review',
      step: review,
      level: billing.inner,
      scope: 'billing',
    });
  });
});
