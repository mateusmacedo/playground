export const CASCADE_STEP = 24;
export const CASCADE_LENGTH = 5;

/**
 * Deslocamento do bloco inserido pelo `+`, para os blocos novos não caírem um em cima do outro. `insertions` conta as
 * inserções pelo botão desde que o editor abriu: a primeira cai no centro e a sexta volta a ele.
 */
export function cascadeOffset(insertions: number): number {
  return (insertions % CASCADE_LENGTH) * CASCADE_STEP;
}
