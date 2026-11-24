# Formulários, acessibilidade do CoreUI e testes

Complemento de [`../SKILL.md`](../SKILL.md). Os trechos marcados como "padrão a seguir" mostram o que ainda não existe no repo (não há Server Action, camada de dados nem `*.spec.tsx` hoje); os demais foram conferidos contra o código de `apps/backoffice`.

## Campo de formulário com CoreUI

Três pontos do `CFormInput` que não são óbvios (conferidos no código de `@coreui/react` e em teste):

- O `label` só se liga ao campo pelo `htmlFor={id}`. **Sem `id`, o rótulo não fica associado** (`getByLabelText` não encontra o campo). Gere o `id` com `useId()`.
- `invalid` só aplica a classe `is-invalid`. **Ele não define `aria-invalid`**: passe você.
- O `aria-describedby` que você passa vai para o `<input>` e vira o `id` do `text` e do `feedbackInvalid`. Se os dois existirem no mesmo campo, o `id` se repete: use só um deles por vez (por exemplo, `text` quando válido e `feedbackInvalid` quando inválido).

```tsx
'use client';

import { CFormInput } from '@coreui/react';
import { useId } from 'react';

interface EmailFieldProps {
  readonly value: string;
  readonly error?: string;
  readonly onChange: (value: string) => void;
}

export function EmailField({
  value,
  error,
  onChange,
}: Readonly<EmailFieldProps>) {
  const id = useId();
  return (
    <CFormInput
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={error ? true : undefined}
      feedbackInvalid={error}
      id={id}
      invalid={Boolean(error)}
      label="E-mail"
      onChange={(event) => onChange(event.target.value)}
      type="email"
      value={value}
    />
  );
}
```

Props e componentes do CoreUI: consulte o MCP `coreui-docs` (`get_component_api`, `get_doc_page`) ou o código em `apps/backoffice/node_modules/@coreui/react/src`. Não invente props. Não use componente PRO ([ADR 0003](../../../../../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md)).

## Formulário com Server Action (padrão a seguir)

Modelo da doc do Next (`02-guides/forms.md`): o formulário vira Client Component para mostrar o estado, a action roda no servidor e **devolve o erro esperado como valor**.

```ts
// actions.ts (padrão a seguir)
'use server';

export type FormState = { ok: boolean; message: string };

export async function createCustomer(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession('customers:write'); // autorização DENTRO da action
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    return { ok: false, message: 'Informe o nome do cliente.' };
  }
  // ... grava e, se for o caso, revalida o cache
  return { ok: true, message: 'Cliente criado.' };
}
```

```tsx
// customer-form.tsx (padrão a seguir)
'use client';

import { CButton, CFormInput } from '@coreui/react';
import { useActionState, useId } from 'react';
import { createCustomer, type FormState } from './actions';

const initialState: FormState = { ok: false, message: '' };

export function CustomerForm() {
  const id = useId();
  const [state, formAction, pending] = useActionState(
    createCustomer,
    initialState,
  );
  return (
    <form action={formAction}>
      <CFormInput id={id} label="Nome" name="name" required />
      <p aria-live="polite">{state.message}</p>
      <CButton disabled={pending} type="submit">
        Salvar
      </CButton>
    </form>
  );
}
```

Regras:

- **Cada action é um endpoint** acessível a quem enviar o POST. Autenticação e autorização ficam dentro dela, não só na página que a renderiza (`02-guides/server-actions.md`, `02-guides/data-security.md`). Valide a entrada no servidor.
- Erro esperado (validação, regra de negócio) volta no estado. `throw` fica para erro inesperado, que cai no `error.tsx`.
- Estado de envio: `pending` do `useActionState`; em botão filho de formulário, `useFormStatus` (de `react-dom`). Atualização otimista: `useOptimistic`.
- Deploy com mais de uma instância: a doc exige o mesmo `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` em todas (`02-guides/server-actions.md`). É segredo: vem do Secrets Manager, nunca de `NEXT_PUBLIC_*`.
- Ação que só muda a tela (abrir modal, trocar aba) não precisa de Server Action: use estado de cliente, como a lista do guia de página nova com o `ConfirmModal`.

## Testes de componente

O Vitest do `backoffice` roda em jsdom com `globals: true` e aceita `*.spec.tsx` (padrão do `include` em `vitest.config.mts`). O catálogo traz `@testing-library/react` e `@testing-library/dom`; **não há** `@testing-library/user-event` nem o pacote de matchers de DOM (`toBeInTheDocument` e afins). Use `fireEvent` e as asserções do Vitest (`toBe`, `toBeNull`, `toHaveBeenCalledOnce`). Se precisar desses pacotes, adicione ao catálogo primeiro (regra do `AGENTS.md`).

Exemplo conferido contra `src/shared/ui/states.tsx` (o arquivo ainda não existe no repo):

```tsx
// src/shared/ui/states.spec.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorState, LoadingState } from './states';

describe('ErrorState', () => {
  it('chama onRetry ao clicar no botão', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('anuncia a falha como alerta', () => {
    render(<ErrorState detail="Timeout" onRetry={() => undefined} />);
    expect(screen.getByRole('alert').textContent).toContain('Timeout');
  });
});

describe('LoadingState', () => {
  it('expõe o carregamento como status', () => {
    render(<LoadingState label="Carregando clientes…" />);
    expect(screen.getByRole('status').textContent).toContain(
      'Carregando clientes…',
    );
  });
});
```

Orientações:

- Consulte por **papel e nome acessível** (`getByRole`, `getByLabelText`), não por classe CSS nem `data-testid`. Se o teste não acha o elemento por papel, o problema costuma ser de acessibilidade do componente.
- O teste limpa o DOM entre casos sozinho (com `globals: true` o Testing Library registra o cleanup).
- Provider necessário (`SessionProvider`, `ToastProvider`): envolva no `render`, passando `value` quando o provider aceita (`SessionProvider` aceita).
- **Server Component assíncrono** (página que faz `await`): o Vitest não renderiza (`02-guides/testing/vitest.md`). Cubra no e2e de `apps/backoffice-e2e/src` (Playwright, consultas por papel e rótulo, como em `shell.spec.ts`) e extraia a regra para função pura testável sem DOM.
- Regra de negócio da tela vira função em arquivo próprio (como `nav.ts` e `breadcrumbs.ts`), com `*.spec.ts` ao lado.
