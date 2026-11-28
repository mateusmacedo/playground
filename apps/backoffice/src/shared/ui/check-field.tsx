import type { ReactNode } from 'react';

export interface CheckFieldProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  /** A caixa precisa ser marcada para a ação seguir. */
  readonly required?: boolean;
  /** Id do texto que explica a caixa. */
  readonly describedBy?: string;
  /** Nome para leitor de tela, quando o rótulo sozinho se repete na mesma tela. */
  readonly accessibleName?: string;
  readonly className?: string;
}

/**
 * Caixa de marcação com o rótulo, nas classes do tema.
 *
 * WHY: o `CFormCheck` do CoreUI recria o `<input>` a cada renderização, e quem marca pelo teclado fica sem o foco a
 * cada marca. Com o elemento nativo, a caixa é sempre a mesma e o foco continua nela.
 */
export function CheckField({
  id,
  label,
  checked,
  onChange,
  disabled,
  required,
  describedBy,
  accessibleName,
  className,
}: Readonly<CheckFieldProps>) {
  return (
    <div className={className ? `form-check ${className}` : 'form-check'}>
      <input
        id={id}
        type="checkbox"
        className="form-check-input"
        checked={checked}
        disabled={disabled}
        aria-label={accessibleName}
        aria-required={required}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="form-check-label">
        {label}
      </label>
    </div>
  );
}
