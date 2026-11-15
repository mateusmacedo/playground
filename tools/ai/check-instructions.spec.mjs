import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os, { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkInstructions, runCli } from './check-instructions.mjs';

const SCRIPT = fileURLToPath(
  new URL('./check-instructions.mjs', import.meta.url),
);

const BASE_FRONT = 'name: skill-core-base\ndescription: Descrição\n';

function newDir(prefix) {
  return mkdtempSync(join(tmpdir(), `check-instructions-${prefix}-`));
}

// NOTE: um ~/.claude vazio compartilhado: sem skills nem agentes externos, o
// teste não depende da máquina em que roda.
const EMPTY_HOME = newDir('home-vazio');

function write(root, rel, content = '') {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

function link(root, rel, target) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  symlinkSync(target, join(root, rel));
}

function frontmatter(name, extra = '') {
  return `---\nname: ${name}\ndescription: Descrição de ${name}\n${extra}---\n`;
}

function baseRoot() {
  const root = newDir('raiz');
  write(root, 'AGENTS.md', '# Raiz\n');
  write(root, 'CLAUDE.md', '@AGENTS.md\n');
  return root;
}

function addWebScope(root) {
  write(root, 'apps/web/AGENTS.md', '# Web\n');
  write(root, 'apps/web/CLAUDE.md', '@AGENTS.md\n');
}

function addRule(root, name, content, scope = '') {
  write(root, join(scope, '.agents/rules', name), content);
  const claudeRules = join(scope, '.claude/rules');
  if (!existsSync(join(root, claudeRules))) {
    link(root, claudeRules, '../.agents/rules');
  }
}

function addAgent(root, file, content, scope = '') {
  write(root, join(scope, '.agents/agents', file), content);
  const claudeAgents = join(scope, '.claude/agents');
  if (!existsSync(join(root, claudeAgents))) {
    link(root, claudeAgents, '../.agents/agents');
  }
}

function addSkill(root, folder, content, { linked = true, scope = '' } = {}) {
  write(
    root,
    join(scope, '.agents/skills', folder, 'SKILL.md'),
    content ?? frontmatter(folder),
  );
  if (linked) {
    link(
      root,
      join(scope, '.claude/skills', folder),
      `../../.agents/skills/${folder}`,
    );
  }
}

function healthyRoot() {
  const root = baseRoot();
  addRule(root, 'geral.md', 'Regra geral.\n');
  addAgent(root, 'architecture.md', frontmatter('architecture'));
  addSkill(root, 'skill-core-base');
  addSkill(root, 'nx-workspace', undefined, { linked: false });
  addWebScope(root);
  addRule(
    root,
    'web.md',
    '---\npaths:\n  - "apps/web/**"\n---\nRegra do web.\n',
    'apps/web',
  );
  return root;
}

function errorsOf(root, claudeHome = EMPTY_HOME) {
  return checkInstructions({ root, claudeHome }).errors;
}

function skillErrors(frontBody) {
  const root = baseRoot();
  addSkill(root, 'skill-core-base', `---\n${frontBody}---\n`);
  return errorsOf(root);
}

const SKILL_FILE = '.agents/skills/skill-core-base/SKILL.md';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('checkInstructions', () => {
  describe('árvore saudável', () => {
    it('não aponta problema e conta escopos, rules, skills e agentes', () => {
      const result = checkInstructions({
        root: healthyRoot(),
        claudeHome: EMPTY_HOME,
      });

      expect(result).toEqual({
        errors: [],
        counts: { scopes: 2, rules: 2, skills: 2, agents: 1 },
      });
    });

    it('devolve o resultado sem imprimir nem encerrar o processo', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
      const root = baseRoot();
      write(root, 'apps/api/AGENTS.md', '# Api\n');

      const { errors } = checkInstructions({ root, claudeHome: EMPTY_HOME });

      expect(errors).toHaveLength(1);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    });

    it('lê os nomes externos do ~/.claude do usuário quando o caminho não é informado', () => {
      const home = newDir('home');
      write(home, '.claude/skills/skill-core-base/SKILL.md');
      vi.spyOn(os, 'homedir').mockReturnValue(home);
      const root = baseRoot();
      addSkill(root, 'skill-core-base');

      const { errors } = checkInstructions({ root });

      expect(errors).toEqual([
        '.agents/skills/skill-core-base: skill `skill-core-base` colide com uma do usuário ou de plugin',
      ]);
    });
  });

  describe('AGENTS.md e CLAUDE.md', () => {
    it('exige o CLAUDE.md irmão do AGENTS.md', () => {
      const root = baseRoot();
      write(root, 'apps/api/AGENTS.md', '# Api\n');

      expect(errorsOf(root)).toEqual([
        'apps/api/AGENTS.md: falta o CLAUDE.md irmão com `@AGENTS.md`',
      ]);
    });

    it('exige que o CLAUDE.md importe o AGENTS.md', () => {
      const root = baseRoot();
      write(root, 'CLAUDE.md', 'Sem importação.\n');

      expect(errorsOf(root)).toEqual([
        'CLAUDE.md: não importa o AGENTS.md (`@AGENTS.md`)',
      ]);
    });

    it('aceita a importação em linha com espaços ao redor', () => {
      const root = baseRoot();
      write(root, 'CLAUDE.md', '# Raiz\n\n  @AGENTS.md  \n');

      expect(errorsOf(root)).toEqual([]);
    });

    it('exige o AGENTS.md no escopo que tem .agents/', () => {
      const root = baseRoot();
      mkdirSync(join(root, 'apps/api/.agents'), { recursive: true });

      expect(errorsOf(root)).toEqual([
        'apps/api/.agents: escopo com .agents/ precisa de AGENTS.md e CLAUDE.md',
      ]);
    });
  });

  describe('tamanho', () => {
    it.each([
      ['com quebra de linha final', 'a\n'.repeat(201)],
      ['sem quebra de linha final', `${'a\n'.repeat(200)}a`],
    ])('limita o AGENTS.md a 200 linhas (%s)', (_caso, text) => {
      const root = baseRoot();
      write(root, 'AGENTS.md', text);

      expect(errorsOf(root)).toEqual(['AGENTS.md: 201 linhas (máximo 200)']);
    });

    it('aceita o AGENTS.md com exatamente 200 linhas', () => {
      const root = baseRoot();
      write(root, 'AGENTS.md', 'a\n'.repeat(200));

      expect(errorsOf(root)).toEqual([]);
    });

    it('limita o CLAUDE.md a 200 linhas', () => {
      const root = baseRoot();
      write(root, 'CLAUDE.md', `@AGENTS.md\n${'a\n'.repeat(200)}`);

      expect(errorsOf(root)).toEqual(['CLAUDE.md: 201 linhas (máximo 200)']);
    });

    it('limita o arquivo a 40000 caracteres', () => {
      const root = baseRoot();
      write(root, 'AGENTS.md', 'a'.repeat(40_001));

      expect(errorsOf(root)).toEqual([
        'AGENTS.md: 40001 caracteres (máximo 40000)',
      ]);
    });

    it('aceita o arquivo com exatamente 40000 caracteres', () => {
      const root = baseRoot();
      write(root, 'AGENTS.md', 'a'.repeat(40_000));

      expect(errorsOf(root)).toEqual([]);
    });

    it('limita a rule a 200 linhas', () => {
      const root = baseRoot();
      addRule(root, 'geral.md', 'a\n'.repeat(201));

      expect(errorsOf(root)).toEqual([
        '.agents/rules/geral.md: 201 linhas (máximo 200)',
      ]);
    });

    it('limita a skill a 500 linhas', () => {
      const front = frontmatter('skill-core-base');
      const aceita = baseRoot();
      addSkill(aceita, 'skill-core-base', `${front}${'x\n'.repeat(496)}`);
      const excedida = baseRoot();
      addSkill(excedida, 'skill-core-base', `${front}${'x\n'.repeat(497)}`);

      expect(errorsOf(aceita)).toEqual([]);
      expect(errorsOf(excedida)).toEqual([
        `${SKILL_FILE}: 501 linhas (máximo 500)`,
      ]);
    });

    it('limita o agente a 500 linhas', () => {
      const root = baseRoot();
      addAgent(
        root,
        'architecture.md',
        `${frontmatter('architecture')}${'a\n'.repeat(497)}`,
      );

      expect(errorsOf(root)).toEqual([
        '.agents/agents/architecture.md: 501 linhas (máximo 500)',
      ]);
    });
  });

  describe('links relativos', () => {
    it('aponta o link quebrado no AGENTS.md', () => {
      const root = baseRoot();
      write(root, 'AGENTS.md', '# Raiz\n[guia](./docs/nao-existe.md)\n');

      expect(errorsOf(root)).toEqual([
        'AGENTS.md: link quebrado: ./docs/nao-existe.md',
      ]);
    });

    it('ignora link externo, âncora, código e link que resolve', () => {
      const root = baseRoot();
      write(root, 'docs/guia com espaço.md');
      write(
        root,
        'AGENTS.md',
        [
          '# Raiz',
          '[site](https://exemplo.com) [mail](mailto:a@b.c) [topo](#topo)',
          '[guia](./docs/guia%20com%20espa%C3%A7o.md#secao)',
          '`[inline](./inexistente.md)`',
          '```text',
          '[bloco](./inexistente.md)',
          '```',
          '',
        ].join('\n'),
      );

      expect(errorsOf(root)).toEqual([]);
    });

    it('confere os links dos arquivos de dentro da skill', () => {
      const root = baseRoot();
      addSkill(root, 'skill-core-base');
      write(
        root,
        '.agents/skills/skill-core-base/references/guia.md',
        '[x](../nada.md)\n',
      );
      write(root, '.agents/skills/skill-core-base/references/dados.json', '{}');

      expect(errorsOf(root)).toEqual([
        '.agents/skills/skill-core-base/references/guia.md: link quebrado: ../nada.md',
      ]);
    });

    it('confere os links da rule', () => {
      const root = baseRoot();
      addRule(root, 'geral.md', '[x](./nada.md)\n');

      expect(errorsOf(root)).toEqual([
        '.agents/rules/geral.md: link quebrado: ./nada.md',
      ]);
    });
  });

  describe('frontmatter', () => {
    it.each([
      [
        'linha indentada sem chave',
        `  - item\n${BASE_FRONT}`,
        'frontmatter, linha 2: linha indentada sem chave',
      ],
      [
        'indentação sem lista nem bloco',
        `${BASE_FRONT}  extra: y\n`,
        'frontmatter, linha 4: indentação inesperada',
      ],
      [
        'linha que não é chave e valor',
        `${BASE_FRONT}isso não é chave\n`,
        'frontmatter, linha 4: esperado `chave: valor`',
      ],
      [
        'chave repetida',
        `${BASE_FRONT}description: outra\n`,
        'frontmatter, linha 4: chave `description` repetida',
      ],
      [
        'tabulação',
        `${BASE_FRONT}extra:\tvalor\n`,
        'frontmatter, linha 4: tabulação não vale em YAML',
      ],
      [
        'aspas sem fechamento',
        `${BASE_FRONT}extra: "sem fim\n`,
        'frontmatter, linha 4: aspas sem fechamento',
      ],
      [
        'aspas soltas',
        `${BASE_FRONT}extra: "\n`,
        'frontmatter, linha 4: aspas sem fechamento',
      ],
      [
        'dois pontos em valor sem aspas',
        `${BASE_FRONT}extra: a: b\n`,
        'frontmatter, linha 4: `: ` ou ` #` em valor sem aspas; use aspas ou >-',
      ],
      [
        'cerquilha em valor sem aspas',
        `${BASE_FRONT}extra: a #b\n`,
        'frontmatter, linha 4: `: ` ou ` #` em valor sem aspas; use aspas ou >-',
      ],
      [
        'item de lista sem aspas com dois pontos',
        `${BASE_FRONT}extra:\n  - a: b\n`,
        'frontmatter, linha 5: `: ` ou ` #` em valor sem aspas; use aspas ou >-',
      ],
    ])('aponta %s', (_caso, body, message) => {
      expect(skillErrors(body)).toEqual([`${SKILL_FILE}: ${message}`]);
    });

    it.each(['@a', '%a', '&a', '*a', '!a', '`a', '{a', '[a', '>a', '|a'])(
      'aponta valor que começa com o caractere reservado em %s',
      (value) => {
        expect(skillErrors(`${BASE_FRONT}extra: ${value}\n`)).toEqual([
          `${SKILL_FILE}: frontmatter, linha 4: valor começa com caractere reservado; use aspas`,
        ]);
      },
    );

    it.each([
      ['valor entre aspas duplas com símbolos', 'extra: "a: b # c"\n'],
      ['valor entre aspas simples com símbolos', "extra: 'a: b'\n"],
      ['bloco dobrado', 'extra: >-\n  linha um\n  linha dois\n'],
      ['bloco literal', 'extra: |\n  texto\n'],
      ['bloco com traço no início da linha', 'extra: >-\n  - texto\n'],
      ['lista de itens', 'extra:\n  - a\n  - "b: c"\n'],
      ['chave sem valor', 'extra:\n'],
      ['comentário e linha em branco', '# comentário\n\nextra: ok\n'],
    ])('aceita %s', (_caso, extra) => {
      expect(skillErrors(`${BASE_FRONT}${extra}`)).toEqual([]);
    });

    it('junta as linhas do bloco numa só descrição', () => {
      const root = baseRoot();
      addAgent(
        root,
        'architecture.md',
        '---\nname: architecture\ndescription: >-\n  primeira parte\n  segunda parte\n---\n',
      );

      expect(errorsOf(root)).toEqual([]);
    });

    it('aponta o frontmatter sem o --- de fechamento', () => {
      const root = baseRoot();
      addSkill(root, 'skill-core-base', `---\n${BASE_FRONT}`);

      expect(errorsOf(root)).toEqual([
        `${SKILL_FILE}: frontmatter sem o \`---\` de fechamento`,
        `${SKILL_FILE}: frontmatter precisa de \`name\` e \`description\``,
      ]);
    });

    it('exige frontmatter na skill', () => {
      const root = baseRoot();
      addSkill(root, 'skill-core-base', 'Sem frontmatter.\n');

      expect(errorsOf(root)).toEqual([
        `${SKILL_FILE}: frontmatter precisa de \`name\` e \`description\``,
      ]);
    });

    it('exige a descrição preenchida', () => {
      expect(skillErrors('name: skill-core-base\ndescription:\n')).toEqual([
        `${SKILL_FILE}: frontmatter precisa de \`name\` e \`description\``,
      ]);
    });

    describe('bordas do item de lista e do par chave: valor', () => {
      const NBSP = String.fromCharCode(0xa0);
      const LINE_SEPARATOR = String.fromCharCode(0x2028);

      it.each([
        ['item com vários espaços depois do traço', 'extra:\n  -    valor\n'],
        ['item só com espaços depois do traço', 'extra:\n  -  \n'],
        ['chave com só espaços depois dos dois pontos', 'extra:   \n'],
        ['chave com hífen e sublinhado', 'x-y_z: ok\n'],
        ['espaço sem quebra depois dos dois pontos', `extra:${NBSP}valor\n`],
      ])('aceita %s', (_caso, extra) => {
        expect(skillErrors(`${BASE_FRONT}${extra}`)).toEqual([]);
      });

      it.each([
        [
          'item com um espaço só depois do traço',
          'extra:\n  - \n',
          'linha 5: indentação inesperada',
        ],
        [
          'item colado no traço',
          'extra:\n  -valor\n',
          'linha 5: indentação inesperada',
        ],
        [
          'item com retorno de carro no fim',
          'extra:\n  - valor\r\n',
          'linha 5: indentação inesperada',
        ],
        [
          'item sem indentação',
          '- valor\n',
          'linha 4: esperado `chave: valor`',
        ],
        [
          'chave colada no valor',
          'extra:valor\n',
          'linha 4: esperado `chave: valor`',
        ],
        [
          'chave com retorno de carro no fim',
          'extra: valor\r\n',
          'linha 4: esperado `chave: valor`',
        ],
        [
          'chave com separador de linha no valor',
          `extra: va${LINE_SEPARATOR}lor\n`,
          'linha 4: esperado `chave: valor`',
        ],
        [
          'chave que começa por dígito',
          '1extra: x\n',
          'linha 4: esperado `chave: valor`',
        ],
        ['chave com ponto', 'a.b: x\n', 'linha 4: esperado `chave: valor`'],
        ['chave vazia', ': x\n', 'linha 4: esperado `chave: valor`'],
      ])('recusa %s', (_caso, extra, message) => {
        expect(skillErrors(`${BASE_FRONT}${extra}`)).toEqual([
          `${SKILL_FILE}: frontmatter, ${message}`,
        ]);
      });
    });

    describe('linhas longas', () => {
      const LONG = 100_000;

      // WHY: a linha passa de 40000 caracteres, então o tamanho do arquivo
      // também é apontado; o que se confere aqui é o frontmatter.
      function oversized(frontBody) {
        const size = `---\n${frontBody}---\n`.length;
        return `${SKILL_FILE}: ${size} caracteres (máximo 40000)`;
      }

      // WHY: o teste espera o resultado em até 2 segundos. As regex antigas
      // levavam mais de 10 segundos já com 40000 espaços, então um retorno ao
      // tempo quadrático faz o teste estourar o tempo.
      it('recusa em tempo linear a chave com espaços e retorno de carro no fim', {
        timeout: 2000,
      }, () => {
        const body = `${BASE_FRONT}extra:${' '.repeat(LONG)}x\r\n`;

        expect(skillErrors(body)).toEqual([
          oversized(body),
          `${SKILL_FILE}: frontmatter, linha 4: esperado \`chave: valor\``,
        ]);
      });

      it('recusa em tempo linear o item com espaços e retorno de carro no fim', {
        timeout: 2000,
      }, () => {
        const body = `${BASE_FRONT}extra:\n  -${' '.repeat(LONG)}x\r\n`;

        expect(skillErrors(body)).toEqual([
          oversized(body),
          `${SKILL_FILE}: frontmatter, linha 5: indentação inesperada`,
        ]);
      });

      it('aceita a chave com valor longo', { timeout: 2000 }, () => {
        const body = `${BASE_FRONT}extra: ${'a'.repeat(LONG)}\n`;

        expect(skillErrors(body)).toEqual([oversized(body)]);
      });

      it('aceita o item com traços e espaços alternados', {
        timeout: 2000,
      }, () => {
        const body = `${BASE_FRONT}extra:\n  -${' -'.repeat(LONG / 2)}\n`;

        expect(skillErrors(body)).toEqual([oversized(body)]);
      });
    });
  });

  describe('rules', () => {
    it('aceita rule sem paths na raiz', () => {
      const root = baseRoot();
      addRule(root, 'geral.md', 'Regra geral.\n');

      expect(errorsOf(root)).toEqual([]);
    });

    it('aponta chave do frontmatter diferente de paths', () => {
      const root = baseRoot();
      addRule(root, 'geral.md', '---\nname: x\npaths:\n  - "a/**"\n---\n');

      expect(errorsOf(root)).toEqual([
        '.agents/rules/geral.md: chave `name` ignorada: rule só lê `paths`',
      ]);
    });

    it.each([
      ['sem itens', '---\npaths:\n---\n'],
      ['com um texto no lugar da lista', '---\npaths: a/**\n---\n'],
    ])('exige que paths seja uma lista de globs (%s)', (_caso, content) => {
      const root = baseRoot();
      addRule(root, 'geral.md', content);

      expect(errorsOf(root)).toEqual([
        '.agents/rules/geral.md: `paths:` precisa ser uma lista de globs',
      ]);
    });

    it('só permite rule sem paths na raiz', () => {
      const root = baseRoot();
      addWebScope(root);
      addRule(root, 'web.md', 'Sem paths.\n', 'apps/web');

      expect(errorsOf(root)).toEqual([
        'apps/web/.agents/rules/web.md: rule sem `paths:` só é permitida na raiz',
      ]);
    });

    it('conta só os arquivos .md da pasta de rules', () => {
      const root = baseRoot();
      addRule(root, 'geral.md', 'Regra geral.\n');
      write(root, '.agents/rules/notas.txt', 'fora da conta');

      expect(
        checkInstructions({ root, claudeHome: EMPTY_HOME }).counts.rules,
      ).toBe(1);
    });
  });

  describe('agentes', () => {
    it('exige name e description', () => {
      const root = baseRoot();
      addAgent(root, 'architecture.md', 'Sem frontmatter.\n');

      expect(errorsOf(root)).toEqual([
        '.agents/agents/architecture.md: frontmatter precisa de `name` e `description`',
      ]);
    });

    it('exige que o name seja o do arquivo', () => {
      const root = baseRoot();
      addAgent(root, 'architecture.md', frontmatter('diferente'));

      expect(errorsOf(root)).toEqual([
        '.agents/agents/architecture.md: name `diferente` difere do arquivo',
      ]);
    });

    it('exige name em kebab-case', () => {
      const root = baseRoot();
      addAgent(root, 'Bad_Name.md', frontmatter('Bad_Name'));

      expect(errorsOf(root)).toEqual([
        '.agents/agents/Bad_Name.md: name `Bad_Name` fora do padrão kebab-case',
      ]);
    });

    it('recusa nome de agente embutido ou de plugin conhecido', () => {
      const root = baseRoot();
      addAgent(root, 'review.md', frontmatter('review'));

      expect(errorsOf(root)).toEqual([
        '.agents/agents/review.md: agente `review` colide com um do usuário ou de plugin',
      ]);
    });

    it('recusa nome de agente do usuário e de plugin instalado', () => {
      const home = newDir('home');
      write(home, '.claude/agents/meu-agente.md');
      write(home, '.claude/plugins/cache/mkt/plug/1.0.0/agents/plug-agente.md');
      const root = baseRoot();
      addAgent(root, 'meu-agente.md', frontmatter('meu-agente'));
      addAgent(root, 'plug-agente.md', frontmatter('plug-agente'));

      expect([...errorsOf(root, join(home, '.claude'))].sort()).toEqual([
        '.agents/agents/meu-agente.md: agente `meu-agente` colide com um do usuário ou de plugin',
        '.agents/agents/plug-agente.md: agente `plug-agente` colide com um do usuário ou de plugin',
      ]);
    });

    it('recusa agente em subpasta', () => {
      const root = baseRoot();
      addWebScope(root);
      addAgent(root, 'agente-web.md', frontmatter('agente-web'), 'apps/web');

      expect(errorsOf(root)).toEqual([
        'apps/web/.agents/agents: o Claude Code não descobre agentes em subpasta: mova para a raiz com prefixo do projeto',
      ]);
    });

    it('recusa agente repetido em dois escopos', () => {
      const root = baseRoot();
      addWebScope(root);
      addAgent(root, 'architecture.md', frontmatter('architecture'));
      addAgent(
        root,
        'architecture.md',
        frontmatter('architecture'),
        'apps/web',
      );

      const repeated = errorsOf(root).filter((e) => e.includes('repetida em'));

      expect(repeated).toHaveLength(1);
      expect(repeated[0]).toContain('agente `architecture` repetida em:');
      expect(repeated[0]).toContain('.agents/agents/architecture.md');
      expect(repeated[0]).toContain('apps/web/.agents/agents/architecture.md');
    });

    it('conta só os arquivos .md da pasta de agentes', () => {
      const root = baseRoot();
      addAgent(root, 'architecture.md', frontmatter('architecture'));
      write(root, '.agents/agents/notas.txt', 'fora da conta');

      expect(
        checkInstructions({ root, claudeHome: EMPTY_HOME }).counts.agents,
      ).toBe(1);
    });
  });

  describe('skills', () => {
    it('aponta a pasta de skill sem SKILL.md', () => {
      const root = baseRoot();
      write(root, '.agents/skills/skill-vazia/nada.txt', 'x');

      expect(errorsOf(root)).toEqual([
        '.agents/skills/skill-vazia: skill sem SKILL.md',
      ]);
    });

    it('ignora arquivo solto na pasta de skills', () => {
      const root = baseRoot();
      write(root, '.agents/skills/LEIA-ME.md', 'texto');

      expect(errorsOf(root)).toEqual([]);
    });

    it('exige que o name seja o da pasta', () => {
      const root = baseRoot();
      addSkill(root, 'skill-core-base', frontmatter('skill-outro'));

      expect(errorsOf(root)).toEqual([
        `${SKILL_FILE}: name \`skill-outro\` difere da pasta \`skill-core-base\``,
      ]);
    });

    it('exige o padrão skill-<domínio>-<tema>', () => {
      const root = baseRoot();
      addSkill(root, 'skill-Bad_X');

      expect(errorsOf(root)).toEqual([
        '.agents/skills/skill-Bad_X: nome fora do padrão `skill-<domínio>-<tema>`',
      ]);
    });

    it('aceita na raiz a skill gerada, sem prefixo e sem symlink', () => {
      const root = baseRoot();
      addSkill(root, 'nx-workspace', undefined, { linked: false });

      expect(errorsOf(root)).toEqual([]);
    });

    it('recusa skill sem prefixo fora da raiz', () => {
      const root = baseRoot();
      addWebScope(root);
      addSkill(root, 'gerada-web', undefined, {
        scope: 'apps/web',
        linked: false,
      });

      expect(errorsOf(root)).toEqual([
        'apps/web/.agents/skills/gerada-web: skill de repositório usa o prefixo `skill-`',
      ]);
    });

    it('recusa nome de skill do usuário e de plugin instalado', () => {
      const home = newDir('home');
      write(home, '.claude/skills/skill-do-usuario/SKILL.md');
      write(
        home,
        '.claude/plugins/cache/mkt/plug/1.0.0/skills/skill-do-plugin/SKILL.md',
      );
      const root = baseRoot();
      addSkill(root, 'skill-do-usuario');
      addSkill(root, 'skill-do-plugin');

      expect([...errorsOf(root, join(home, '.claude'))].sort()).toEqual([
        '.agents/skills/skill-do-plugin: skill `skill-do-plugin` colide com uma do usuário ou de plugin',
        '.agents/skills/skill-do-usuario: skill `skill-do-usuario` colide com uma do usuário ou de plugin',
      ]);
    });

    it('recusa skill repetida em dois escopos', () => {
      const root = baseRoot();
      addWebScope(root);
      addSkill(root, 'skill-core-base');
      addSkill(root, 'skill-core-base', undefined, { scope: 'apps/web' });

      const errors = errorsOf(root);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('skill `skill-core-base` repetida em:');
      expect(errors[0]).toContain(SKILL_FILE);
      expect(errors[0]).toContain(`apps/web/${SKILL_FILE}`);
    });
  });

  describe('symlinks', () => {
    function rootWithRulesOnly() {
      const root = baseRoot();
      write(root, '.agents/rules/geral.md', 'Regra geral.\n');
      return root;
    }

    it('aponta o symlink ausente', () => {
      expect(errorsOf(rootWithRulesOnly())).toEqual([
        '.claude/rules: falta o symlink para .agents/rules',
      ]);
    });

    it('aponta o diretório que deveria ser symlink, nos dois lados da varredura', () => {
      const root = rootWithRulesOnly();
      mkdirSync(join(root, '.claude/rules'), { recursive: true });

      expect(errorsOf(root)).toEqual([
        '.claude/rules: deveria ser symlink para .agents/rules',
        '.claude/rules: deveria ser symlink para ../.agents/rules',
      ]);
    });

    it('recusa symlink absoluto', () => {
      const root = rootWithRulesOnly();
      link(root, '.claude/rules', join(root, '.agents/rules'));

      expect(errorsOf(root)).toEqual([
        '.claude/rules: symlink absoluto; use caminho relativo',
      ]);
    });

    it('aponta o symlink quebrado, nos dois lados da varredura', () => {
      const root = rootWithRulesOnly();
      link(root, '.claude/rules', '../.agents/regras');

      expect(errorsOf(root)).toEqual([
        '.claude/rules: symlink quebrado',
        '.claude/rules: symlink quebrado',
      ]);
    });

    it('aponta o symlink que leva a outra pasta', () => {
      const root = rootWithRulesOnly();
      write(root, '.agents/outras/x.md');
      link(root, '.claude/rules', '../.agents/outras');

      expect(errorsOf(root)).toEqual([
        '.claude/rules: aponta para ../.agents/outras, e não para .agents/rules',
      ]);
    });

    it('aponta o symlink de agentes ausente', () => {
      const root = baseRoot();
      write(
        root,
        '.agents/agents/architecture.md',
        frontmatter('architecture'),
      );

      expect(errorsOf(root)).toEqual([
        '.claude/agents: falta o symlink para .agents/agents',
      ]);
    });

    it('aponta o symlink de skill ausente', () => {
      const root = baseRoot();
      addSkill(root, 'skill-core-base', undefined, { linked: false });

      expect(errorsOf(root)).toEqual([
        '.claude/skills/skill-core-base: falta o symlink para .agents/skills/skill-core-base',
      ]);
    });
  });

  describe('pasta .claude', () => {
    it('não aponta problema numa .claude sem rules, agents nem skills', () => {
      const root = baseRoot();
      write(root, '.claude/settings.json', '{}');

      expect(errorsOf(root)).toEqual([]);
    });

    it('aponta rules que é pasta de verdade', () => {
      const root = baseRoot();
      mkdirSync(join(root, '.claude/rules'), { recursive: true });

      expect(errorsOf(root)).toEqual([
        '.claude/rules: deveria ser symlink para ../.agents/rules',
      ]);
    });

    it('aponta agents que é symlink quebrado', () => {
      const root = baseRoot();
      link(root, '.claude/agents', '../.agents/agents');

      expect(errorsOf(root)).toEqual(['.claude/agents: symlink quebrado']);
    });

    it('aponta skill que é pasta de verdade', () => {
      const root = baseRoot();
      mkdirSync(join(root, '.claude/skills/skill-real'), { recursive: true });

      expect(errorsOf(root)).toEqual([
        '.claude/skills/skill-real: skill deve viver em .agents/skills, com symlink aqui',
      ]);
    });

    it('aponta symlink de skill quebrado', () => {
      const root = baseRoot();
      link(root, '.claude/skills/skill-fantasma', '../../nao-existe');

      expect(errorsOf(root)).toEqual([
        '.claude/skills/skill-fantasma: symlink quebrado',
      ]);
    });

    it('aponta symlink de skill sem a skill correspondente em .agents', () => {
      const root = baseRoot();
      mkdirSync(join(root, 'apps'), { recursive: true });
      link(root, '.claude/skills/skill-fantasma', '../../apps');

      expect(errorsOf(root)).toEqual([
        '.claude/skills/skill-fantasma: symlink sem skill correspondente no .agents/ do mesmo escopo',
      ]);
    });
  });

  describe('varredura da árvore', () => {
    it.each([
      '.git',
      '.gradle',
      '.next',
      '.nx',
      '.remember',
      '.serverless',
      '.terraform',
      'build',
      'coverage',
      'dist',
      'node_modules',
      'out-tsc',
      'test-output',
      'tmp',
    ])('ignora o que está dentro de %s', (dir) => {
      const root = baseRoot();
      write(root, `${dir}/pacote/AGENTS.md`, '# Sem CLAUDE.md\n');

      const { errors, counts } = checkInstructions({
        root,
        claudeHome: EMPTY_HOME,
      });

      expect(errors).toEqual([]);
      expect(counts.scopes).toBe(1);
    });

    it('não segue symlink de diretório', () => {
      const root = baseRoot();
      addWebScope(root);
      link(root, 'atalho', 'apps/web');

      const { errors, counts } = checkInstructions({
        root,
        claudeHome: EMPTY_HOME,
      });

      expect(errors).toEqual([]);
      expect(counts.scopes).toBe(2);
    });

    it('lê no cache de plugins até a profundidade 6', () => {
      const home = newDir('home');
      write(
        home,
        '.claude/plugins/cache/a/b/c/d/e/f/skills/skill-fundo/SKILL.md',
      );
      write(
        home,
        '.claude/plugins/cache/a/b/c/d/e/f/g/skills/skill-fundo-demais/SKILL.md',
      );
      const root = baseRoot();
      addSkill(root, 'skill-fundo');
      addSkill(root, 'skill-fundo-demais');

      expect(errorsOf(root, join(home, '.claude'))).toEqual([
        '.agents/skills/skill-fundo: skill `skill-fundo` colide com uma do usuário ou de plugin',
      ]);
    });

    it('ignora no cache de plugins pastas ocultas, geradas e arquivos soltos', () => {
      const home = newDir('home');
      const cache = '.claude/plugins/cache';
      const ignored = [
        ['.oculta', 'skill-oculta'],
        ['generated', 'skill-gerada'],
        ['artifacts', 'skill-artefatos'],
        ['node_modules', 'skill-modulos'],
      ];
      const root = baseRoot();
      for (const [dir, skill] of ignored) {
        write(home, `${cache}/${dir}/skills/${skill}/SKILL.md`);
        addSkill(root, skill);
      }
      write(home, `${cache}/arquivo-solto.txt`, 'x');

      expect(errorsOf(root, join(home, '.claude'))).toEqual([]);
    });

    it('só lê agentes .md do usuário e de plugin', () => {
      const home = newDir('home');
      write(home, '.claude/agents/architecture.txt');
      write(
        home,
        '.claude/plugins/cache/mkt/plug/1.0.0/agents/architecture.json',
      );
      const root = baseRoot();
      addAgent(root, 'architecture.md', frontmatter('architecture'));

      expect(errorsOf(root, join(home, '.claude'))).toEqual([]);
    });
  });
});

describe('runCli', () => {
  it('imprime o resumo e devolve 0 quando não há problema', () => {
    const log = vi.fn();
    const logError = vi.fn();

    const code = runCli({
      root: healthyRoot(),
      claudeHome: EMPTY_HOME,
      log,
      logError,
    });

    expect(code).toBe(0);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'check-instructions: ok (2 escopos, 2 rules, 2 skills, 1 agentes)',
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it('imprime o cabeçalho e um item por problema e devolve 1', () => {
    const root = baseRoot();
    write(root, 'apps/api/AGENTS.md', '# Api\n');
    write(root, 'CLAUDE.md', 'Sem importação.\n');
    const log = vi.fn();
    const logError = vi.fn();

    const code = runCli({ root, claudeHome: EMPTY_HOME, log, logError });

    expect(code).toBe(1);
    expect(logError.mock.calls).toEqual([
      ['check-instructions: 2 problema(s)\n'],
      ['- CLAUDE.md: não importa o AGENTS.md (`@AGENTS.md`)'],
      ['- apps/api/AGENTS.md: falta o CLAUDE.md irmão com `@AGENTS.md`'],
    ]);
    expect(log).not.toHaveBeenCalled();
  });

  it('escreve no console quando nenhuma saída é injetada', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = baseRoot();
    write(bad, 'CLAUDE.md', 'Sem importação.\n');

    expect(runCli({ root: healthyRoot(), claudeHome: EMPTY_HOME })).toBe(0);
    expect(runCli({ root: bad, claudeHome: EMPTY_HOME })).toBe(1);

    expect(log).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);
  });
});

describe('entrada de linha de comando', () => {
  // WHY: o script calcula a raiz a partir do próprio caminho (`../..`), então o
  // teste copia o arquivo para `<raiz>/tools/ai` de uma árvore temporária.
  function installScript(root) {
    const target = join(root, 'tools/ai/check-instructions.mjs');
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(SCRIPT, target);
    return target;
  }

  function runScript(script) {
    vi.stubEnv('HOME', EMPTY_HOME);
    return spawnSync(process.execPath, [script], { encoding: 'utf8' });
  }

  it('imprime o resumo no stdout e sai com 0 quando não há problema', () => {
    const root = healthyRoot();

    const result = runScript(installScript(root));

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'check-instructions: ok (2 escopos, 2 rules, 2 skills, 1 agentes)\n',
    );
    expect(result.stderr).toBe('');
  });

  it('imprime os problemas no stderr e sai com 1', () => {
    const root = healthyRoot();
    write(root, 'CLAUDE.md', 'Sem importação.\n');

    const result = runScript(installScript(root));

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'check-instructions: 1 problema(s)\n\n- CLAUDE.md: não importa o AGENTS.md (`@AGENTS.md`)\n',
    );
  });

  it('não varre nem imprime nada quando o módulo é só importado', () => {
    const code = `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)})`;

    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', code],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
