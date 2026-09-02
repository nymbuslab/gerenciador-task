import Link from "next/link";

export default function HomePage() {
  return (
    <main className="portal">
      <div className="portal__topo">
        <div className="portal__interno">
          <p className="casca__marca">Gestor de tarefas</p>
          <h1 className="portal__titulo">A operação do dia, em um só lugar.</h1>
        </div>
      </div>

      <div className="portal__corpo">
        <p className="estado__texto">
          Distribua, execute e acompanhe as tarefas da loja. Cada pessoa vê o que é dela, com
          horário, evidência e histórico.
        </p>

        <div>
          <Link className="botao" href="/login">
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
