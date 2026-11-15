const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isKebabCase(value: string): boolean {
  return KEBAB_CASE.test(value);
}

export function normalizeServiceName(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (name.length === 0) {
    throw new Error('O nome do serviço não pode ser vazio.');
  }
  if (!isKebabCase(name)) {
    throw new Error(
      `Nome de serviço inválido "${raw}". Use kebab-case: letras minúsculas, números e hífens, começando por letra.`,
    );
  }
  return name;
}

export function normalizeProjectRoot(raw: string): string {
  const normalized = raw
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .replace(/\/+/g, '/');
  return normalized === '.' ? '' : normalized;
}

export function assertRelativeProjectRoot(projectRoot: string): void {
  const segments = projectRoot.split('/');
  if (
    projectRoot.length === 0 ||
    projectRoot.startsWith('/') ||
    /^[A-Za-z]:/.test(projectRoot) ||
    segments.includes('..')
  ) {
    throw new Error(
      `Diretório inválido "${projectRoot}". Use um caminho relativo dentro do workspace.`,
    );
  }
}
