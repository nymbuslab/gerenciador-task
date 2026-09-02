"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { AppShell, CabecalhoDePagina, Estado } from "@/src/components/app-shell";
import { carregarSessao, type Sessao } from "@/src/features/identity/auth-service";
import { supabaseDoNavegador } from "@/src/lib/supabase-browser";

import {
  criarTarefa,
  executarComando,
  listarMinhasTarefas,
  listarTarefasDaLoja,
  listarTarefasDoSetor,
  type TarefaEmLista,
} from "../task-service";
import {
  LinhaDeTarefa,
  SeloDeEstado,
  TarefaEmFoco,
  formatarHora,
  type AcaoDeTarefa,
} from "./task-card";

/**
 * Painel comum das tres visoes.
 *
 * Meu dia e uma agenda: uma tarefa em foco e o resto na regua de tempo. Setor e
 * Operacao sao um quadro: quem lidera varre por pessoa e por situacao, nao pela
 * proxima acao. O que os tres compartilham e a sessao, os comandos e os estados
 * de tela, e nao o layout.
 */

export type Escopo = "meu-dia" | "setor" | "operacao";

type Situacao = "carregando" | "pronto" | "sem-sessao" | "sem-permissao" | "erro";

type Setor = { id: string; nome: string };

const ENCERRADAS: TarefaEmLista["estado"][] = ["concluida", "cancelada"];
const EM_CURSO: TarefaEmLista["estado"][] = ["em_execucao", "bloqueada"];

function estaAtrasada(tarefa: TarefaEmLista): boolean {
  if (!tarefa.prazo || ENCERRADAS.includes(tarefa.estado)) {
    return false;
  }

  return new Date(tarefa.prazo).getTime() < Date.now();
}

function dataPorExtenso(): string {
  const texto = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function TaskBoard({
  escopo,
  rota,
  titulo,
}: {
  escopo: Escopo;
  rota: string;
  titulo: string;
}) {
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [tarefas, setTarefas] = useState<TarefaEmLista[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [recado, setRecado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const [criando, setCriando] = useState(false);
  const [pedido, setPedido] = useState<{ tarefa: TarefaEmLista; acao: AcaoDeTarefa } | null>(null);

  const buscar = useCallback(
    async (atual: Sessao) => {
      const cliente = supabaseDoNavegador();

      if (escopo === "meu-dia") {
        return listarMinhasTarefas(cliente, atual.perfilId);
      }

      if (escopo === "setor") {
        return atual.setorId ? listarTarefasDoSetor(cliente, atual.setorId) : [];
      }

      return listarTarefasDaLoja(cliente);
    },
    [escopo],
  );

  const atualizar = useCallback(
    async (atual: Sessao) => {
      setTarefas(await buscar(atual));
    },
    [buscar],
  );

  useEffect(() => {
    let ativo = true;

    carregarSessao(supabaseDoNavegador())
      .then(async (atual) => {
        if (!ativo) {
          return;
        }

        if (!atual) {
          setSituacao("sem-sessao");
          return;
        }

        setSessao(atual);

        if (escopo === "operacao" && atual.papel !== "gestor") {
          setSituacao("sem-permissao");
          return;
        }

        if (escopo === "setor" && atual.papel === "funcionario") {
          setSituacao("sem-permissao");
          return;
        }

        const { data } = await supabaseDoNavegador()
          .from("sectors")
          .select("id, nome")
          .is("archived_at", null)
          .order("nome");

        if (!ativo) {
          return;
        }

        setSetores(data ?? []);
        await atualizar(atual);
        setSituacao("pronto");
      })
      .catch(() => {
        if (ativo) {
          setSituacao("erro");
        }
      });

    return () => {
      ativo = false;
    };
  }, [atualizar, escopo]);

  async function comandar(tarefa: TarefaEmLista, acao: AcaoDeTarefa, motivo?: string) {
    if (!sessao) {
      return;
    }

    setOcupada(true);
    setErro(null);
    setRecado(null);

    const resultado = await executarComando(supabaseDoNavegador(), {
      execucaoId: tarefa.execucaoId,
      comando: acao.comando,
      motivo,
    });

    if (resultado.situacao === "ok") {
      setRecado(`${tarefa.titulo}: ${acao.rotulo.toLowerCase()} feito.`);
    } else {
      setErro(resultado.motivo);
    }

    await atualizar(sessao);
    setOcupada(false);
  }

  function pedirComando(tarefa: TarefaEmLista, acao: AcaoDeTarefa) {
    if (acao.pedeMotivo) {
      setPedido({ tarefa, acao });
      return;
    }

    void comandar(tarefa, acao);
  }

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!sessao) {
      return;
    }

    setOcupada(true);
    setErro(null);
    setRecado(null);

    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);

    const resultado = await criarTarefa(supabaseDoNavegador(), {
      titulo: String(dados.get("titulo") ?? ""),
      publico: "setor",
      setorId: String(dados.get("setorId") ?? "") || sessao.setorId,
      modo: "individual",
      instrucoes: String(dados.get("instrucoes") ?? "") || null,
      prioridade: (dados.get("prioridade") as TarefaEmLista["prioridade"]) ?? "normal",
      exigeAprovacao: dados.get("exigeAprovacao") === "on",
    });

    if (resultado.situacao === "ok") {
      formulario.reset();
      setCriando(false);
      setRecado(`Tarefa criada para ${resultado.execucoes} pessoa(s).`);
      await atualizar(sessao);
    } else {
      setErro(resultado.motivo);
    }

    setOcupada(false);
  }

  if (situacao === "carregando") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado titulo="Carregando" texto="Buscando as tarefas desta visão." />
        </div>
      </div>
    );
  }

  if (situacao === "sem-sessao" || situacao === "erro") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado
            papelAria="alert"
            titulo={situacao === "erro" ? "Não foi possível carregar" : "Entre para continuar"}
            texto={
              situacao === "erro"
                ? "A conexão com o servidor falhou. Recarregue a página em instantes."
                : "Esta tela mostra as tarefas da sua conta. Entre com seu acesso."
            }
            acao={
              <a className="botao" href="/login">
                Ir para a entrada
              </a>
            }
          />
        </div>
      </div>
    );
  }

  const atual = sessao!;
  const podeCriar = escopo !== "meu-dia" && atual.papel !== "funcionario";

  return (
    <AppShell papel={atual.papel} rotaAtual={rota} nomeUsuario={atual.nome}>
      {situacao === "sem-permissao" ? (
        <Estado
          papelAria="alert"
          titulo="Esta visão é de outro papel"
          texto="Seu acesso não administra esta tela. Volte para as suas tarefas do dia."
          acao={
            <a className="botao" href="/hoje">
              Ver meu dia
            </a>
          }
        />
      ) : (
        <>
          {escopo === "meu-dia" ? (
            <Agenda
              titulo={titulo}
              tarefas={tarefas}
              papel={atual.papel}
              ocupada={ocupada}
              recado={recado}
              erro={erro}
              aoComandar={pedirComando}
            />
          ) : (
            <Quadro
              titulo={titulo}
              tarefas={tarefas}
              setores={setores}
              papel={atual.papel}
              mostrarSetor={escopo === "operacao"}
              ocupada={ocupada}
              recado={recado}
              erro={erro}
              podeCriar={podeCriar}
              criando={criando}
              aoAlternarCriacao={() => setCriando((antes) => !antes)}
              aoCriar={criar}
              aoComandar={pedirComando}
            />
          )}

          {pedido && (
            <DialogoDeMotivo
              rotulo={pedido.acao.rotulo}
              titulo={pedido.tarefa.titulo}
              aoCancelar={() => setPedido(null)}
              aoConfirmar={(motivo) => {
                const alvo = pedido;
                setPedido(null);
                void comandar(alvo.tarefa, alvo.acao, motivo);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function Recados({ recado, erro }: { recado: string | null; erro: string | null }) {
  return (
    <>
      {recado && (
        <p className="recado" role="status">
          {recado}
        </p>
      )}
      {erro && (
        <ul className="formulario__erros" role="alert" aria-label="Erro na tarefa">
          <li>{erro}</li>
        </ul>
      )}
    </>
  );
}

function Agenda({
  titulo,
  tarefas,
  papel,
  ocupada,
  recado,
  erro,
  aoComandar,
}: {
  titulo: string;
  tarefas: TarefaEmLista[];
  papel: Sessao["papel"];
  ocupada: boolean;
  recado: string | null;
  erro: string | null;
  aoComandar: (tarefa: TarefaEmLista, acao: AcaoDeTarefa) => void;
}) {
  const abertas = tarefas.filter((tarefa) => !ENCERRADAS.includes(tarefa.estado));
  const encerradas = tarefas.filter((tarefa) => ENCERRADAS.includes(tarefa.estado));
  const feitas = tarefas.filter((tarefa) => tarefa.estado === "concluida").length;
  const foco = abertas.find((tarefa) => EM_CURSO.includes(tarefa.estado)) ?? abertas[0];
  const depois = abertas.filter((tarefa) => tarefa.execucaoId !== foco?.execucaoId);
  const proporcao = tarefas.length > 0 ? Math.round((feitas / tarefas.length) * 100) : 0;

  return (
    <>
      <CabecalhoDePagina
        rotulo={dataPorExtenso()}
        titulo={tarefas.length > 0 ? `${feitas} de ${tarefas.length} feitas` : titulo}
      />

      {tarefas.length > 0 && (
        <div
          className="progresso"
          role="img"
          aria-label={`${feitas} de ${tarefas.length} tarefas concluídas`}
          style={{ marginBottom: "var(--espaco-xxl)", maxWidth: "740px" }}
        >
          <div className="progresso__feito" style={{ width: `${proporcao}%` }} />
        </div>
      )}

      <Recados recado={recado} erro={erro} />

      <div className="dia">
        <div className="agenda">
          {foco ? (
            <section className="agenda__secao" aria-labelledby="secao-agora">
              <h2 className="rotulo" id="secao-agora">
                Agora
              </h2>
              <TarefaEmFoco
                tarefa={foco}
                papel={papel}
                ocupada={ocupada}
                aoComandar={aoComandar}
              />
            </section>
          ) : (
            <Estado
              titulo="Nada em aberto"
              texto="Quando a liderança atribuir uma tarefa a você, ela aparece aqui, com o horário e o que precisa ser feito."
            />
          )}

          {depois.length > 0 && (
            <section className="agenda__secao" aria-labelledby="secao-depois">
              <h2 className="rotulo" id="secao-depois">
                Depois
              </h2>
              <div className="linhas">
                {depois.map((tarefa) => (
                  <LinhaDeTarefa
                    key={tarefa.execucaoId}
                    tarefa={tarefa}
                    papel={papel}
                    ocupada={ocupada}
                    aoComandar={aoComandar}
                  />
                ))}
              </div>
            </section>
          )}

          {encerradas.length > 0 && (
            <section className="agenda__secao" aria-labelledby="secao-encerradas">
              <h2 className="rotulo" id="secao-encerradas">
                Encerradas
              </h2>
              <div className="linhas">
                {encerradas.map((tarefa) => (
                  <LinhaDeTarefa
                    key={tarefa.execucaoId}
                    tarefa={tarefa}
                    papel={papel}
                    ocupada={ocupada}
                    aoComandar={aoComandar}
                    feita
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="painel" aria-label="Resumo do dia">
          <div className="cartao">
            <p className="rotulo">Seu tempo hoje</p>
            <div className="numeros">
              <div className="numero">
                <span className="numero__valor">
                  {Math.floor(
                    tarefas.reduce((total, tarefa) => total + tarefa.segundosAtivos, 0) / 60,
                  )}
                  min
                </span>
                <span className="numero__rotulo">Trabalho ativo</span>
              </div>
              <div className="numero">
                <span className="numero__valor">{abertas.length}</span>
                <span className="numero__rotulo">Ainda em aberto</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Quadro({
  titulo,
  tarefas,
  setores,
  papel,
  mostrarSetor,
  ocupada,
  recado,
  erro,
  podeCriar,
  criando,
  aoAlternarCriacao,
  aoCriar,
  aoComandar,
}: {
  titulo: string;
  tarefas: TarefaEmLista[];
  setores: Setor[];
  papel: Sessao["papel"];
  mostrarSetor: boolean;
  ocupada: boolean;
  recado: string | null;
  erro: string | null;
  podeCriar: boolean;
  criando: boolean;
  aoAlternarCriacao: () => void;
  aoCriar: (evento: FormEvent<HTMLFormElement>) => void;
  aoComandar: (tarefa: TarefaEmLista, acao: AcaoDeTarefa) => void;
}) {
  const nomeDoSetor = new Map(setores.map((setor) => [setor.id, setor.nome]));
  const emAndamento = tarefas.filter((tarefa) => tarefa.estado === "em_execucao").length;
  const aguardando = tarefas.filter(
    (tarefa) => tarefa.estado === "aguardando_validacao",
  ).length;
  const atrasadas = tarefas.filter(estaAtrasada).length;
  // Uma coluna sempre vazia rouba largura das que carregam informacao.
  const temAcao =
    papel !== "funcionario" &&
    tarefas.some((tarefa) => tarefa.estado === "aguardando_validacao");

  return (
    <>
      <CabecalhoDePagina
        rotulo={dataPorExtenso()}
        titulo={titulo}
        acao={
          podeCriar ? (
            <button
              className="botao"
              type="button"
              onClick={aoAlternarCriacao}
              aria-expanded={criando}
            >
              {criando ? "Fechar" : "Criar tarefa"}
            </button>
          ) : undefined
        }
      />

      <Recados recado={recado} erro={erro} />

      <div className="indicadores">
        <div className="indicador">
          <span className="numero__valor">{tarefas.length}</span>
          <span className="numero__rotulo">Previstas</span>
        </div>
        <div className="indicador">
          <span className="numero__valor">{emAndamento}</span>
          <span className="numero__rotulo">Em andamento</span>
        </div>
        <div className="indicador">
          <span className="numero__valor">{aguardando}</span>
          <span className="numero__rotulo">Aguardando validação</span>
        </div>
        <div className="indicador" data-tom={atrasadas > 0 ? "atencao" : undefined}>
          <span className="numero__valor">{atrasadas}</span>
          <span className="numero__rotulo">Atrasadas</span>
        </div>
      </div>

      {criando && (
        <form
          className="formulario"
          onSubmit={aoCriar}
          noValidate
          style={{ marginBottom: "var(--espaco-xxl)" }}
        >
          <div className="campo">
            <label className="campo__rotulo" htmlFor="titulo">
              Título da tarefa
            </label>
            <input className="campo__entrada" id="titulo" name="titulo" type="text" required />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="instrucoes">
              Instruções
            </label>
            <input className="campo__entrada" id="instrucoes" name="instrucoes" type="text" />
            <p className="campo__dica">O que a pessoa precisa saber antes de começar.</p>
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="prioridade">
              Prioridade
            </label>
            <select className="campo__entrada" id="prioridade" name="prioridade">
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          {mostrarSetor && (
            <div className="campo">
              <label className="campo__rotulo" htmlFor="setorId">
                Setor
              </label>
              <select className="campo__entrada" id="setorId" name="setorId" required>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="campo__opcao">
            <input type="checkbox" name="exigeAprovacao" />
            Exigir validação da liderança
          </label>

          <button className="botao" type="submit" disabled={ocupada}>
            {ocupada ? "Salvando" : "Criar tarefa"}
          </button>
        </form>
      )}

      {tarefas.length === 0 ? (
        <Estado
          titulo="Nenhuma tarefa nesta visão"
          texto="Assim que houver tarefa distribuída, ela aparece aqui com responsável, situação e prazo."
          acao={
            podeCriar ? (
              <button className="botao" type="button" onClick={aoAlternarCriacao}>
                Criar a primeira tarefa
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="quadro">
          <table className="tabela">
            <caption>Tarefas por situação e prazo</caption>
            <thead>
              <tr>
                <th scope="col">Tarefa</th>
                {mostrarSetor && <th scope="col">Setor</th>}
                <th scope="col">Responsável</th>
                <th scope="col">Situação</th>
                <th scope="col">Prazo</th>
                {temAcao && <th scope="col">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {tarefas.map((tarefa) => (
                <tr key={tarefa.execucaoId}>
                  <td>
                    {tarefa.titulo}
                    {tarefa.prioridade === "alta" && (
                      <span className="tabela__apoio">Prioridade alta</span>
                    )}
                  </td>
                  {mostrarSetor && (
                    <td>{tarefa.setorId ? (nomeDoSetor.get(tarefa.setorId) ?? "Loja inteira") : "Loja inteira"}</td>
                  )}
                  <td>
                    {tarefa.compartilhada
                      ? "Tarefa do setor"
                      : (tarefa.responsavelNome ?? "Sem responsável")}
                  </td>
                  <td>
                    <SeloDeEstado estado={tarefa.estado} />
                  </td>
                  <td className="tabela__hora">
                    {formatarHora(tarefa.prazo)}
                    {estaAtrasada(tarefa) && <span className="tabela__apoio">Atrasada</span>}
                  </td>
                  {temAcao && (
                    <td>
                      <div className="tabela__acoes">
                        {tarefa.estado === "aguardando_validacao" && (
                          <>
                            <button
                              className="botao botao--discreto"
                              type="button"
                              disabled={ocupada}
                              aria-label={`Aprovar ${tarefa.titulo}`}
                              onClick={() =>
                                aoComandar(tarefa, { comando: "aprovar", rotulo: "Aprovar" })
                              }
                            >
                              Aprovar
                            </button>
                            <button
                              className="botao botao--discreto"
                              type="button"
                              disabled={ocupada}
                              aria-label={`Reprovar ${tarefa.titulo}`}
                              onClick={() =>
                                aoComandar(tarefa, {
                                  comando: "reprovar",
                                  rotulo: "Reprovar",
                                  pedeMotivo: true,
                                })
                              }
                            >
                              Reprovar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * Bloquear e reprovar exigem motivo escrito. O dialogo nativo traz foco preso,
 * Esc e leitura por tecnologia assistiva sem reimplementar nada disso.
 */
function DialogoDeMotivo({
  rotulo,
  titulo,
  aoConfirmar,
  aoCancelar,
}: {
  rotulo: string;
  titulo: string;
  aoConfirmar: (motivo: string) => void;
  aoCancelar: () => void;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    referencia.current?.showModal();
  }, []);

  return (
    <dialog
      ref={referencia}
      className="cartao"
      aria-labelledby="motivo-titulo"
      onCancel={(evento) => {
        evento.preventDefault();
        aoCancelar();
      }}
      style={{ border: "1px solid var(--cor-fio)", borderRadius: "var(--raio-lg)" }}
    >
      <h2 className="estado__titulo" id="motivo-titulo">
        {rotulo}: {titulo}
      </h2>

      {erro && (
        <ul className="formulario__erros" role="alert" aria-label="Erro no motivo">
          <li>{erro}</li>
        </ul>
      )}

      <div className="campo">
        <label className="campo__rotulo" htmlFor="motivo">
          Motivo
        </label>
        <input
          className="campo__entrada"
          id="motivo"
          type="text"
          autoFocus
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
        <p className="campo__dica">Quem receber este aviso precisa entender o que travou.</p>
      </div>

      <div className="tarefa__acoes">
        <button
          className="botao"
          type="button"
          onClick={() => {
            if (motivo.trim().length === 0) {
              setErro("Escreva o motivo antes de confirmar.");
              return;
            }

            aoConfirmar(motivo);
          }}
        >
          Confirmar
        </button>
        <button className="botao botao--discreto" type="button" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
