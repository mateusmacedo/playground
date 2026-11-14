import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="clearfix">
              <h1 className="float-start display-3 me-4">404</h1>
              <h2 className="h4 pt-3">Página não encontrada</h2>
              <p className="text-body-secondary float-start">
                O endereço não existe ou mudou de lugar.
              </p>
            </div>
            <Link className="btn btn-primary" href="/">
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
