import type { ReactNode } from "react";

import { Navigation, nomeDoPapel, type Papel } from "./navigation";

export type AppShellProps = {
  papel: Papel;
  rotaAtual: string;
  nomeUsuario: string;
  /** Acao de sessao do cabecalho, por exemplo sair. Quem tem sessao decide. */
  acaoSessao?: ReactNode;
  children: ReactNode;
};

/**
 * Casca visual do produto. Recebe papel e rota ja resolvidos por quem tem
 * sessao; nao consulta banco, nao le variavel de ambiente e nao decide
 * autorizacao. Em telas estreitas a navegacao vira barra inferior, para manter
 * a proxima acao ao alcance do polegar.
 */
export function AppShell({
  papel,
  rotaAtual,
  nomeUsuario,
  acaoSessao,
  children,
}: AppShellProps) {
  return (
    <div className="casca">
      <header className="casca__topo">
        <div className="casca__faixa">
          <p className="casca__marca">Gestor de tarefas</p>

          <div className="casca__sessao">
            <span className="casca__nome">{nomeUsuario}</span>
            <span className="casca__papel">{nomeDoPapel(papel)}</span>
            {acaoSessao}
          </div>
        </div>

        <Navigation papel={papel} rotaAtual={rotaAtual} />
      </header>

      <main className="casca__conteudo">{children}</main>
    </div>
  );
}

/**
 * Cabecalho de pagina: rotulo em caixa alta pequena, titulo editorial e uma
 * unica acao preenchida a direita.
 */
export function CabecalhoDePagina({
  rotulo,
  titulo,
  acao,
}: {
  rotulo: string;
  titulo: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="pagina">
      <div className="pagina__texto">
        <p className="rotulo">{rotulo}</p>
        <h1 className="pagina__titulo">{titulo}</h1>
      </div>
      {acao}
    </div>
  );
}

/**
 * Tela vazia, de carregamento ou de erro. Sempre com um caminho de saida:
 * uma tela sem nada precisa dizer o que fazer, e nao so que esta vazia.
 */
export function Estado({
  titulo,
  texto,
  acao,
  papelAria = "status",
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
  papelAria?: "status" | "alert";
}) {
  return (
    <section className="estado" role={papelAria}>
      <h2 className="estado__titulo">{titulo}</h2>
      <p className="estado__texto">{texto}</p>
      {acao}
    </section>
  );
}
