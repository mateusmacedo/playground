import Link from 'next/link';

export interface RunUnavailableProps {
  /** O que falta para mostrar o diagrama. */
  readonly message: string;
  /** Por que falta e o que fazer. */
  readonly detail: string;
  readonly backLabel: string;
  readonly backHref: string;
}

/** O diagrama não pode ser mostrado: diz o que falta e oferece a volta, que é uma navegação e por isso é um link. */
export function RunUnavailable({
  message,
  detail,
  backLabel,
  backHref,
}: Readonly<RunUnavailableProps>) {
  return (
    <div className="text-center py-5" role="alert">
      <p className="mb-1">{message}</p>
      <p className="small text-body-secondary mb-1">{detail}</p>
      <Link className="btn btn-outline-primary mt-2" href={backHref}>
        {backLabel}
      </Link>
    </div>
  );
}
