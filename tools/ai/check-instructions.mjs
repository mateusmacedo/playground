#!/usr/bin/env node
// Fitness function das instruções de IA por escopo (ADR 0012). Só Node, sem
// dependência: roda no `pnpm lint` e no CI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const MAX_CHARS = 40_000;
// WHY: a doc do Claude Code pede menos de 200 linhas por CLAUDE.md (o mesmo
// vale para o AGENTS.md importado e para as rules) e menos de 500 por SKILL.md.
const MAX_LINES = { instructions: 200, rule: 200, skill: 500, agent: 500 };

const SKIPPED_DIRS = new Set([
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
]);

const SKILL_NAME = /^skill-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AGENT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// NOTE: agentes de plugin e embutidos conhecidos; os do usuário e os de
// plugins instalados são lidos de ~/.claude quando existem.
const RESERVED_AGENTS = [
  'angular-architect',
  'angular-reviewer',
  'claude',
  'claude-code-guide',
  'code-guardian',
  'code-simplifier',
  'codex-rescue',
  'debug',
  'dev-companion',
  'docs',
  'en-reviewer',
  'explore',
  'feature-pipeline',
  'general-purpose',
  'plan',
  'pr-guardian',
  'pr-review-reply',
  'product',
  'pt-reviewer',
  'review',
  'sonarqube-reviewer',
  'spec-manager',
  'statusline-setup',
  'test',
];

const errors = [];
const fail = (file, message) =>
  errors.push(`${path.relative(ROOT, file) || '.'}: ${message}`);

const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const lstat = (p) => {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
};

function walk(dir, found = { agentsMd: [], agentsDirs: [], claudeDirs: [] }) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      if (entry.name === '.agents') found.agentsDirs.push(full);
      if (entry.name === '.claude') found.claudeDirs.push(full);
      walk(full, found);
    } else if (entry.name === 'AGENTS.md') {
      found.agentsMd.push(full);
    }
  }
  return found;
}

function checkSize(file, kind) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (lines > MAX_LINES[kind]) {
    fail(file, `${lines} linhas (máximo ${MAX_LINES[kind]})`);
  }
  if (text.length > MAX_CHARS) {
    fail(file, `${text.length} caracteres (máximo ${MAX_CHARS})`);
  }
  return text;
}

// Valida o subconjunto de YAML usado no frontmatter: `chave: valor`, listas
// `- item` e blocos `>-`/`|`. Devolve null quando não há frontmatter.
function parseFrontmatter(file, text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    fail(file, 'frontmatter sem o `---` de fechamento');
    return {};
  }
  const data = {};
  let current = null;
  let block = false;
  for (const [index, line] of text.slice(4, end).split('\n').entries()) {
    const where = `frontmatter, linha ${index + 2}`;
    if (line.includes('\t')) fail(file, `${where}: tabulação não vale em YAML`);
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (/^\s/.test(line)) {
      if (current === null) {
        fail(file, `${where}: linha indentada sem chave`);
      } else if (item && !block) {
        const value = unquote(file, where, item[1]);
        data[current] = [
          ...(Array.isArray(data[current]) ? data[current] : []),
          value,
        ];
      } else if (block) {
        data[current] = `${data[current]} ${line.trim()}`.trim();
      } else {
        fail(file, `${where}: indentação inesperada`);
      }
      continue;
    }
    const pair = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!pair) {
      fail(file, `${where}: esperado \`chave: valor\``);
      continue;
    }
    const [, key, raw = ''] = pair;
    if (key in data) fail(file, `${where}: chave \`${key}\` repetida`);
    current = key;
    block = /^[>|][-+]?$/.test(raw);
    data[key] = block || raw === '' ? '' : unquote(file, where, raw);
  }
  return data;
}

function unquote(file, where, raw) {
  const value = raw.trim();
  const quote = value[0];
  if (quote === '"' || quote === "'") {
    if (value.length < 2 || value.at(-1) !== quote) {
      fail(file, `${where}: aspas sem fechamento`);
    }
    return value.slice(1, -1);
  }
  if (/^[`@%&*!|>{[]/.test(value)) {
    fail(file, `${where}: valor começa com caractere reservado; use aspas`);
  }
  if (/:\s|\s#/.test(value)) {
    fail(
      file,
      `${where}: \`: \` ou \` #\` em valor sem aspas; use aspas ou >-`,
    );
  }
  return value;
}

function expectSymlink(link, target, label) {
  const stat = lstat(link);
  if (!stat) return fail(link, `falta o symlink para ${label}`);
  if (!stat.isSymbolicLink())
    return fail(link, `deveria ser symlink para ${label}`);
  if (path.isAbsolute(fs.readlinkSync(link)))
    fail(link, 'symlink absoluto; use caminho relativo');
  if (!fs.existsSync(link)) return fail(link, 'symlink quebrado');
  if (fs.realpathSync(link) !== fs.realpathSync(target)) {
    fail(link, `aponta para ${fs.readlinkSync(link)}, e não para ${label}`);
  }
}

function checkLinks(file, text) {
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const [, href] of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(?:[a-z]+:|#)/i.test(href)) continue;
    const target = path.resolve(
      path.dirname(file),
      decodeURI(href.split('#')[0]),
    );
    if (!fs.existsSync(target)) fail(file, `link quebrado: ${href}`);
  }
}

function readExternalNames() {
  const home = path.join(os.homedir(), '.claude');
  const skills = new Set();
  const agents = new Set(RESERVED_AGENTS);
  const userSkills = path.join(home, 'skills');
  if (isDir(userSkills)) {
    for (const name of fs.readdirSync(userSkills)) skills.add(name);
  }
  const userAgents = path.join(home, 'agents');
  if (isDir(userAgents)) {
    for (const name of fs.readdirSync(userAgents)) {
      if (name.endsWith('.md')) agents.add(name.slice(0, -3));
    }
  }
  const cache = path.join(home, 'plugins/cache');
  const scan = (dir, depth) => {
    if (depth > 6 || !isDir(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      if (['generated', 'artifacts', 'node_modules'].includes(entry.name))
        continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'agents') {
        for (const f of fs.readdirSync(full))
          if (f.endsWith('.md')) agents.add(f.slice(0, -3));
      } else if (entry.name === 'skills') {
        for (const f of fs.readdirSync(full)) skills.add(f);
      } else {
        scan(full, depth + 1);
      }
    }
  };
  scan(cache, 0);
  return { skills, agents };
}

const { agentsMd, agentsDirs, claudeDirs } = walk(ROOT);
const skillOwners = new Map();
const agentOwners = new Map();
const counts = { scopes: new Set(), rules: 0, skills: 0, agents: 0 };
const external = readExternalNames();

for (const file of agentsMd) {
  const scope = path.dirname(file);
  counts.scopes.add(scope);
  checkLinks(file, checkSize(file, 'instructions'));
  const claude = path.join(scope, 'CLAUDE.md');
  if (!fs.existsSync(claude)) {
    fail(file, 'falta o CLAUDE.md irmão com `@AGENTS.md`');
    continue;
  }
  const claudeText = checkSize(claude, 'instructions');
  if (!claudeText.split('\n').some((line) => line.trim() === '@AGENTS.md')) {
    fail(claude, 'não importa o AGENTS.md (`@AGENTS.md`)');
  }
}

for (const dir of agentsDirs) {
  const scope = path.dirname(dir);
  const isRoot = scope === ROOT;
  counts.scopes.add(scope);
  if (!fs.existsSync(path.join(scope, 'AGENTS.md'))) {
    fail(dir, 'escopo com .agents/ precisa de AGENTS.md e CLAUDE.md');
  }

  const rulesDir = path.join(dir, 'rules');
  if (isDir(rulesDir)) {
    expectSymlink(path.join(scope, '.claude/rules'), rulesDir, '.agents/rules');
    for (const name of fs
      .readdirSync(rulesDir)
      .filter((f) => f.endsWith('.md'))) {
      const file = path.join(rulesDir, name);
      counts.rules += 1;
      const text = checkSize(file, 'rule');
      checkLinks(file, text);
      const front = parseFrontmatter(file, text);
      const paths = front?.paths;
      if (front) {
        for (const key of Object.keys(front)) {
          if (key !== 'paths')
            fail(file, `chave \`${key}\` ignorada: rule só lê \`paths\``);
        }
      }
      if (front && 'paths' in front) {
        if (!Array.isArray(paths) || paths.length === 0) {
          fail(file, '`paths:` precisa ser uma lista de globs');
        }
      } else if (!isRoot) {
        fail(file, 'rule sem `paths:` só é permitida na raiz');
      }
    }
  }

  const agentDir = path.join(dir, 'agents');
  if (isDir(agentDir)) {
    if (!isRoot) {
      fail(
        agentDir,
        'o Claude Code não descobre agentes em subpasta: mova para a raiz com prefixo do projeto',
      );
    }
    expectSymlink(
      path.join(scope, '.claude/agents'),
      agentDir,
      '.agents/agents',
    );
    for (const name of fs
      .readdirSync(agentDir)
      .filter((f) => f.endsWith('.md'))) {
      const file = path.join(agentDir, name);
      counts.agents += 1;
      const text = checkSize(file, 'agent');
      const front = parseFrontmatter(file, text) ?? {};
      const agent = front.name;
      if (!agent || !front.description)
        fail(file, 'frontmatter precisa de `name` e `description`');
      if (agent && agent !== name.slice(0, -3))
        fail(file, `name \`${agent}\` difere do arquivo`);
      if (agent && !AGENT_NAME.test(agent))
        fail(file, `name \`${agent}\` fora do padrão kebab-case`);
      if (agent && external.agents.has(agent))
        fail(file, `agente \`${agent}\` colide com um do usuário ou de plugin`);
      if (agent)
        agentOwners.set(agent, [...(agentOwners.get(agent) ?? []), file]);
    }
  }

  const skillsDir = path.join(dir, 'skills');
  if (!isDir(skillsDir)) continue;
  for (const name of fs.readdirSync(skillsDir)) {
    const skillDir = path.join(skillsDir, name);
    if (!isDir(skillDir)) continue;
    const file = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(file)) {
      fail(skillDir, 'skill sem SKILL.md');
      continue;
    }
    counts.skills += 1;
    const generated = !name.startsWith('skill-');
    const text = checkSize(file, 'skill');
    const front = parseFrontmatter(file, text) ?? {};
    if (!front.name || !front.description)
      fail(file, 'frontmatter precisa de `name` e `description`');
    if (front.name && front.name !== name)
      fail(file, `name \`${front.name}\` difere da pasta \`${name}\``);
    skillOwners.set(name, [...(skillOwners.get(name) ?? []), file]);
    // NOTE: as skills do Nx (sem o prefixo `skill-`) são geradas pelo
    // `nx configure-ai-agents`, só existem na raiz e chegam pelo plugin do Nx.
    if (generated) {
      if (!isRoot)
        fail(skillDir, 'skill de repositório usa o prefixo `skill-`');
      continue;
    }
    if (!SKILL_NAME.test(name))
      fail(skillDir, 'nome fora do padrão `skill-<domínio>-<tema>`');
    if (external.skills.has(name))
      fail(
        skillDir,
        `skill \`${name}\` colide com uma do usuário ou de plugin`,
      );
    for (const md of walkMarkdown(skillDir))
      checkLinks(md, fs.readFileSync(md, 'utf8'));
    expectSymlink(
      path.join(scope, '.claude/skills', name),
      skillDir,
      `.agents/skills/${name}`,
    );
  }
}

function walkMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

for (const dir of claudeDirs) {
  const scope = path.dirname(dir);
  for (const sub of ['rules', 'agents']) {
    const link = path.join(dir, sub);
    const stat = lstat(link);
    if (stat && !stat.isSymbolicLink())
      fail(link, `deveria ser symlink para ../.agents/${sub}`);
    if (stat?.isSymbolicLink() && !fs.existsSync(link))
      fail(link, 'symlink quebrado');
  }
  const skills = path.join(dir, 'skills');
  if (!isDir(skills)) continue;
  for (const name of fs.readdirSync(skills)) {
    const link = path.join(skills, name);
    if (!lstat(link).isSymbolicLink()) {
      fail(link, 'skill deve viver em .agents/skills, com symlink aqui');
    } else if (!fs.existsSync(link)) {
      fail(link, 'symlink quebrado');
    } else if (!fs.existsSync(path.join(scope, '.agents/skills', name))) {
      fail(
        link,
        'symlink sem skill correspondente no .agents/ do mesmo escopo',
      );
    }
  }
}

for (const [owners, kind] of [
  [skillOwners, 'skill'],
  [agentOwners, 'agente'],
]) {
  for (const [name, files] of owners) {
    if (files.length > 1) {
      fail(
        files[0],
        `${kind} \`${name}\` repetida em: ${files.map((f) => path.relative(ROOT, f)).join(', ')}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`check-instructions: ${errors.length} problema(s)\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(
  `check-instructions: ok (${counts.scopes.size} escopos, ${counts.rules} rules, ${counts.skills} skills, ${counts.agents} agentes)`,
);
