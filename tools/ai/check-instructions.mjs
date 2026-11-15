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

const PLUGIN_SCAN_MAX_DEPTH = 6;
const PLUGIN_SCAN_SKIPPED_DIRS = new Set([
  'generated',
  'artifacts',
  'node_modules',
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

const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const lstat = (p) => {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
};

function fail(ctx, file, message) {
  ctx.errors.push(`${path.relative(ctx.root, file) || '.'}: ${message}`);
}

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

function walkMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function checkSize(ctx, file, kind) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (lines > MAX_LINES[kind]) {
    fail(ctx, file, `${lines} linhas (máximo ${MAX_LINES[kind]})`);
  }
  if (text.length > MAX_CHARS) {
    fail(ctx, file, `${text.length} caracteres (máximo ${MAX_CHARS})`);
  }
  return text;
}

// Valida o subconjunto de YAML usado no frontmatter: `chave: valor`, listas
// `- item` e blocos `>-`/`|`. Devolve null quando não há frontmatter.
function parseFrontmatter(ctx, file, text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    fail(ctx, file, 'frontmatter sem o `---` de fechamento');
    return {};
  }
  const data = {};
  let current = null;
  let block = false;
  for (const [index, line] of text.slice(4, end).split('\n').entries()) {
    const where = `frontmatter, linha ${index + 2}`;
    if (line.includes('\t'))
      fail(ctx, file, `${where}: tabulação não vale em YAML`);
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (/^\s/.test(line)) {
      if (current === null) {
        fail(ctx, file, `${where}: linha indentada sem chave`);
      } else if (item && !block) {
        const value = unquote(ctx, file, where, item[1]);
        data[current] = [
          ...(Array.isArray(data[current]) ? data[current] : []),
          value,
        ];
      } else if (block) {
        data[current] = `${data[current]} ${line.trim()}`.trim();
      } else {
        fail(ctx, file, `${where}: indentação inesperada`);
      }
      continue;
    }
    const pair = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!pair) {
      fail(ctx, file, `${where}: esperado \`chave: valor\``);
      continue;
    }
    const [, key, raw = ''] = pair;
    if (key in data) fail(ctx, file, `${where}: chave \`${key}\` repetida`);
    current = key;
    block = /^[>|][-+]?$/.test(raw);
    data[key] = block || raw === '' ? '' : unquote(ctx, file, where, raw);
  }
  return data;
}

function unquote(ctx, file, where, raw) {
  const value = raw.trim();
  const quote = value[0];
  if (quote === '"' || quote === "'") {
    if (value.length < 2 || value.at(-1) !== quote) {
      fail(ctx, file, `${where}: aspas sem fechamento`);
    }
    return value.slice(1, -1);
  }
  if (/^[`@%&*!|>{[]/.test(value)) {
    fail(
      ctx,
      file,
      `${where}: valor começa com caractere reservado; use aspas`,
    );
  }
  if (/:\s|\s#/.test(value)) {
    fail(
      ctx,
      file,
      `${where}: \`: \` ou \` #\` em valor sem aspas; use aspas ou >-`,
    );
  }
  return value;
}

function expectSymlink(ctx, link, target, label) {
  const stat = lstat(link);
  if (!stat) return fail(ctx, link, `falta o symlink para ${label}`);
  if (!stat.isSymbolicLink())
    return fail(ctx, link, `deveria ser symlink para ${label}`);
  if (path.isAbsolute(fs.readlinkSync(link)))
    fail(ctx, link, 'symlink absoluto; use caminho relativo');
  if (!fs.existsSync(link)) return fail(ctx, link, 'symlink quebrado');
  if (fs.realpathSync(link) !== fs.realpathSync(target)) {
    fail(
      ctx,
      link,
      `aponta para ${fs.readlinkSync(link)}, e não para ${label}`,
    );
  }
}

function checkLinks(ctx, file, text) {
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const [, href] of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(?:[a-z]+:|#)/i.test(href)) continue;
    const target = path.resolve(
      path.dirname(file),
      decodeURI(href.split('#')[0]),
    );
    if (!fs.existsSync(target)) fail(ctx, file, `link quebrado: ${href}`);
  }
}

function scanPluginCache(dir, depth, names) {
  if (depth > PLUGIN_SCAN_MAX_DEPTH || !isDir(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (PLUGIN_SCAN_SKIPPED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === 'agents') {
      for (const f of fs.readdirSync(full))
        if (f.endsWith('.md')) names.agents.add(f.slice(0, -3));
    } else if (entry.name === 'skills') {
      for (const f of fs.readdirSync(full)) names.skills.add(f);
    } else {
      scanPluginCache(full, depth + 1, names);
    }
  }
}

function readExternalNames(claudeHome) {
  const skills = new Set();
  const agents = new Set(RESERVED_AGENTS);
  const userSkills = path.join(claudeHome, 'skills');
  if (isDir(userSkills)) {
    for (const name of fs.readdirSync(userSkills)) skills.add(name);
  }
  const userAgents = path.join(claudeHome, 'agents');
  if (isDir(userAgents)) {
    for (const name of fs.readdirSync(userAgents)) {
      if (name.endsWith('.md')) agents.add(name.slice(0, -3));
    }
  }
  const cache = path.join(claudeHome, 'plugins/cache');
  scanPluginCache(cache, 0, { skills, agents });
  return { skills, agents };
}

function createContext(root, claudeHome) {
  return {
    root,
    errors: [],
    counts: { scopes: new Set(), rules: 0, skills: 0, agents: 0 },
    skillOwners: new Map(),
    agentOwners: new Map(),
    external: readExternalNames(claudeHome),
  };
}

function checkInstructionFile(ctx, file) {
  const scope = path.dirname(file);
  ctx.counts.scopes.add(scope);
  checkLinks(ctx, file, checkSize(ctx, file, 'instructions'));
  const claude = path.join(scope, 'CLAUDE.md');
  if (!fs.existsSync(claude)) {
    fail(ctx, file, 'falta o CLAUDE.md irmão com `@AGENTS.md`');
    return;
  }
  const claudeText = checkSize(ctx, claude, 'instructions');
  if (!claudeText.split('\n').some((line) => line.trim() === '@AGENTS.md')) {
    fail(ctx, claude, 'não importa o AGENTS.md (`@AGENTS.md`)');
  }
}

function checkRule(ctx, file, isRoot) {
  ctx.counts.rules += 1;
  const text = checkSize(ctx, file, 'rule');
  checkLinks(ctx, file, text);
  const front = parseFrontmatter(ctx, file, text);
  const paths = front?.paths;
  if (front) {
    for (const key of Object.keys(front)) {
      if (key !== 'paths')
        fail(ctx, file, `chave \`${key}\` ignorada: rule só lê \`paths\``);
    }
  }
  if (front && 'paths' in front) {
    if (!Array.isArray(paths) || paths.length === 0) {
      fail(ctx, file, '`paths:` precisa ser uma lista de globs');
    }
  } else if (!isRoot) {
    fail(ctx, file, 'rule sem `paths:` só é permitida na raiz');
  }
}

function checkRules(ctx, scope) {
  const rulesDir = path.join(scope.agentsDir, 'rules');
  if (!isDir(rulesDir)) return;
  expectSymlink(
    ctx,
    path.join(scope.dir, '.claude/rules'),
    rulesDir,
    '.agents/rules',
  );
  for (const name of fs
    .readdirSync(rulesDir)
    .filter((f) => f.endsWith('.md'))) {
    checkRule(ctx, path.join(rulesDir, name), scope.isRoot);
  }
}

function checkAgentFile(ctx, file, name) {
  ctx.counts.agents += 1;
  const text = checkSize(ctx, file, 'agent');
  const front = parseFrontmatter(ctx, file, text) ?? {};
  const agent = front.name;
  if (!agent || !front.description)
    fail(ctx, file, 'frontmatter precisa de `name` e `description`');
  if (agent && agent !== name.slice(0, -3))
    fail(ctx, file, `name \`${agent}\` difere do arquivo`);
  if (agent && !AGENT_NAME.test(agent))
    fail(ctx, file, `name \`${agent}\` fora do padrão kebab-case`);
  if (agent && ctx.external.agents.has(agent))
    fail(
      ctx,
      file,
      `agente \`${agent}\` colide com um do usuário ou de plugin`,
    );
  if (agent)
    ctx.agentOwners.set(agent, [...(ctx.agentOwners.get(agent) ?? []), file]);
}

function checkAgents(ctx, scope) {
  const agentDir = path.join(scope.agentsDir, 'agents');
  if (!isDir(agentDir)) return;
  if (!scope.isRoot) {
    fail(
      ctx,
      agentDir,
      'o Claude Code não descobre agentes em subpasta: mova para a raiz com prefixo do projeto',
    );
  }
  expectSymlink(
    ctx,
    path.join(scope.dir, '.claude/agents'),
    agentDir,
    '.agents/agents',
  );
  for (const name of fs
    .readdirSync(agentDir)
    .filter((f) => f.endsWith('.md'))) {
    checkAgentFile(ctx, path.join(agentDir, name), name);
  }
}

function checkSkill(ctx, scope, skillDir) {
  const name = path.basename(skillDir);
  const file = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(file)) {
    fail(ctx, skillDir, 'skill sem SKILL.md');
    return;
  }
  ctx.counts.skills += 1;
  const generated = !name.startsWith('skill-');
  const text = checkSize(ctx, file, 'skill');
  const front = parseFrontmatter(ctx, file, text) ?? {};
  if (!front.name || !front.description)
    fail(ctx, file, 'frontmatter precisa de `name` e `description`');
  if (front.name && front.name !== name)
    fail(ctx, file, `name \`${front.name}\` difere da pasta \`${name}\``);
  ctx.skillOwners.set(name, [...(ctx.skillOwners.get(name) ?? []), file]);
  // NOTE: as skills do Nx (sem o prefixo `skill-`) são geradas pelo
  // `nx configure-ai-agents`, só existem na raiz e chegam pelo plugin do Nx.
  if (generated) {
    if (!scope.isRoot)
      fail(ctx, skillDir, 'skill de repositório usa o prefixo `skill-`');
    return;
  }
  if (!SKILL_NAME.test(name))
    fail(ctx, skillDir, 'nome fora do padrão `skill-<domínio>-<tema>`');
  if (ctx.external.skills.has(name))
    fail(
      ctx,
      skillDir,
      `skill \`${name}\` colide com uma do usuário ou de plugin`,
    );
  for (const md of walkMarkdown(skillDir))
    checkLinks(ctx, md, fs.readFileSync(md, 'utf8'));
  expectSymlink(
    ctx,
    path.join(scope.dir, '.claude/skills', name),
    skillDir,
    `.agents/skills/${name}`,
  );
}

function checkSkills(ctx, scope) {
  const skillsDir = path.join(scope.agentsDir, 'skills');
  if (!isDir(skillsDir)) return;
  for (const name of fs.readdirSync(skillsDir)) {
    const skillDir = path.join(skillsDir, name);
    if (!isDir(skillDir)) continue;
    checkSkill(ctx, scope, skillDir);
  }
}

function checkAgentsDir(ctx, agentsDir) {
  const dir = path.dirname(agentsDir);
  const scope = { dir, agentsDir, isRoot: dir === ctx.root };
  ctx.counts.scopes.add(dir);
  if (!fs.existsSync(path.join(dir, 'AGENTS.md'))) {
    fail(
      ctx,
      agentsDir,
      'escopo com .agents/ precisa de AGENTS.md e CLAUDE.md',
    );
  }
  checkRules(ctx, scope);
  checkAgents(ctx, scope);
  checkSkills(ctx, scope);
}

function checkClaudeDir(ctx, claudeDir) {
  const scope = path.dirname(claudeDir);
  for (const sub of ['rules', 'agents']) {
    const link = path.join(claudeDir, sub);
    const stat = lstat(link);
    if (stat && !stat.isSymbolicLink())
      fail(ctx, link, `deveria ser symlink para ../.agents/${sub}`);
    if (stat?.isSymbolicLink() && !fs.existsSync(link))
      fail(ctx, link, 'symlink quebrado');
  }
  const skills = path.join(claudeDir, 'skills');
  if (!isDir(skills)) return;
  for (const name of fs.readdirSync(skills)) {
    const link = path.join(skills, name);
    if (!lstat(link).isSymbolicLink()) {
      fail(ctx, link, 'skill deve viver em .agents/skills, com symlink aqui');
    } else if (!fs.existsSync(link)) {
      fail(ctx, link, 'symlink quebrado');
    } else if (!fs.existsSync(path.join(scope, '.agents/skills', name))) {
      fail(
        ctx,
        link,
        'symlink sem skill correspondente no .agents/ do mesmo escopo',
      );
    }
  }
}

function checkDuplicates(ctx) {
  for (const [owners, kind] of [
    [ctx.skillOwners, 'skill'],
    [ctx.agentOwners, 'agente'],
  ]) {
    for (const [name, files] of owners) {
      if (files.length > 1) {
        fail(
          ctx,
          files[0],
          `${kind} \`${name}\` repetida em: ${files.map((f) => path.relative(ctx.root, f)).join(', ')}`,
        );
      }
    }
  }
}

// WHY: `claudeHome` é injetável para o teste não ler o ~/.claude da máquina;
// o padrão é o do usuário, de onde vêm os nomes de skills e agentes externos.
export function checkInstructions({
  root,
  claudeHome = path.join(os.homedir(), '.claude'),
}) {
  const ctx = createContext(path.resolve(root), claudeHome);
  const { agentsMd, agentsDirs, claudeDirs } = walk(ctx.root);
  for (const file of agentsMd) checkInstructionFile(ctx, file);
  for (const dir of agentsDirs) checkAgentsDir(ctx, dir);
  for (const dir of claudeDirs) checkClaudeDir(ctx, dir);
  checkDuplicates(ctx);
  const { counts } = ctx;
  return {
    errors: ctx.errors,
    counts: {
      scopes: counts.scopes.size,
      rules: counts.rules,
      skills: counts.skills,
      agents: counts.agents,
    },
  };
}

// Imprime o relatório e devolve o código de saída; quem sai do processo é a
// entrada de linha de comando, abaixo.
export function runCli({
  root,
  claudeHome,
  log = console.log,
  logError = console.error,
}) {
  const { errors, counts } = checkInstructions({ root, claudeHome });
  if (errors.length > 0) {
    logError(`check-instructions: ${errors.length} problema(s)\n`);
    for (const error of errors) logError(`- ${error}`);
    return 1;
  }
  log(
    `check-instructions: ok (${counts.scopes} escopos, ${counts.rules} rules, ${counts.skills} skills, ${counts.agents} agentes)`,
  );
  return 0;
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  const code = runCli({ root: ROOT });
  if (code !== 0) process.exit(code);
}
