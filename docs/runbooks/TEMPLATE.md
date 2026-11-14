# Runbook: título da operação

> Copie este arquivo para `docs/runbooks/<assunto>.md` (kebab-case) e apague as instruções em itálico. Um runbook descreve **uma** operação que alguém vai executar sob pressão: escreva para quem nunca a fez.

- **Responsável**: quem mantém este documento
- **Última revisão**: AAAA-MM-DD
- **Ambiente**: `local` | `dev` | `homolog` | `prod`
- **Duração estimada**: X minutos

## Quando usar

_O sintoma ou o gatilho que leva alguém a abrir este runbook. Um alerta, uma mensagem de erro, uma rotina periódica._

## Impacto

_O que o usuário ou o sistema sente enquanto a operação roda e depois dela. Há indisponibilidade? Perda de dados possível?_

## Pré-requisitos

- [ ] Acesso necessário (conta AWS, perfil, permissão no repositório).
- [ ] Ferramentas instaladas, com a versão mínima.
- [ ] Informações em mãos (stage, região, identificadores).

## Passos

_Um comando por bloco, na ordem, com o resultado esperado logo abaixo. Sem "depois é só ajustar": se existe um ajuste, ele é um passo._

1. Descrição do passo.

   ```bash
   comando --com --flags
   ```

   Esperado: o que deve aparecer na saída.

2. Próximo passo.

## Verificação

_Como confirmar que a operação deu certo: comando, tela ou métrica, e o valor esperado._

## Rollback

_Como desfazer cada passo, na ordem inversa. Se um passo não tem volta, diga isso explicitamente e onde ele aparece._

## Problemas conhecidos

| Sintoma | Causa provável | O que fazer |
| ------- | -------------- | ----------- |
|         |                |             |

## Escalonamento

_Quem chamar quando o runbook não resolve, e por qual canal. Inclua o que levar na mensagem (saída dos comandos, horário, stage)._

## Histórico

| Data       | Quem | O que mudou |
| ---------- | ---- | ----------- |
| AAAA-MM-DD |      | Criação.    |
