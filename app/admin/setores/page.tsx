"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AppShell, CabecalhoDePagina, Estado } from "@/src/components/app-shell";
import { carregarSessao, type Sessao } from "@/src/features/identity/auth-service";
import { supabaseDoNavegador } from "@/src/lib/supabase-browser";

type Setor = { id: string; nome: string; archived_at: string | null };
type Estado = "carregando" | "pronto" | "sem-sessao" | "sem-permissao";

export default function AdminSetoresPage() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarSetores = useCallback(async () => {
    const { data } = await supabaseDoNavegador()
      .from("sectors")
      .select("id, nome, archived_at")
      .order("nome");

    setSetores(data ?? []);
  }, []);

  useEffect(() => {
    let ativo = true;

    carregarSessao(supabaseDoNavegador())
      .then(async (atual) => {
        if (!ativo) {
          return;
        }

        if (!atual) {
          setEstado("sem-sessao");
          return;
        }

        if (atual.papel !== "gestor") {
          setSessao(atual);
          setEstado("sem-permissao");
          return;
        }

        setSessao(atual);
        await carregarSetores();
        setEstado("pronto");
      })
      .catch(() => {
        if (ativo) {
          setEstado("sem-sessao");
        }
      });

    return () => {
      ativo = false;
    };
  }, [carregarSetores]);

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);

    const formulario = evento.currentTarget;
    const nome = String(new FormData(formulario).get("nome") ?? "").trim();

    const { error } = await supabaseDoNavegador()
      .from("sectors")
      .insert({ store_id: sessao!.lojaId, nome });

    if (error) {
      setErro("Não foi possível criar o setor. Verifique se o nome já existe.");
    } else {
      formulario.reset();
      await carregarSetores();
    }

    setSalvando(false);
  }

  async function arquivar(id: string) {
    await supabaseDoNavegador()
      .from("sectors")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);

    await carregarSetores();
  }

  if (estado === "carregando") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado titulo="Carregando" texto="Buscando os setores da loja." />
        </div>
      </div>
    );
  }

  if (estado === "sem-sessao") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado
            papelAria="alert"
            titulo="Entre para continuar"
            texto="Administrar setores exige uma conta de gestor."
            acao={
              <Link className="botao" href="/">
                Ir para a entrada
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <AppShell papel={sessao!.papel} rotaAtual="/admin/setores" nomeUsuario={sessao!.nome}>
      <CabecalhoDePagina rotulo="Administração" titulo="Setores" />

      {estado === "sem-permissao" ? (
        <Estado
          papelAria="alert"
          titulo="Esta visão é do gestor"
          texto="Somente o gestor cria e arquiva setores da loja."
          acao={
            <Link className="botao" href="/hoje">
              Ver meu dia
            </Link>
          }
        />
      ) : (
        <>
          <form className="formulario" onSubmit={criar} noValidate>
            {erro && (
              <ul className="formulario__erros" role="alert" aria-label="Erro ao salvar setor">
                <li>{erro}</li>
              </ul>
            )}

            <div className="campo">
              <label className="campo__rotulo" htmlFor="nome">
                Nome do setor
              </label>
              <input className="campo__entrada" id="nome" name="nome" type="text" required />
            </div>

            <button className="botao" type="submit" disabled={salvando}>
              {salvando ? "Criando" : "Criar setor"}
            </button>
          </form>

          {setores.length === 0 ? (
            <Estado
              titulo="Nenhum setor ainda"
              texto="O setor é o que separa a equipe e as tarefas. Comece criando o primeiro, por exemplo Mercearia."
            />
          ) : (
            <div className="quadro">
              <table className="tabela">
                <caption>Setores da loja</caption>
                <thead>
                  <tr>
                    <th scope="col">Setor</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {setores.map((setor) => (
                    <tr key={setor.id}>
                      <td>{setor.nome}</td>
                      <td>
                        <span className="selo">{setor.archived_at ? "Arquivado" : "Ativo"}</span>
                      </td>
                      <td>
                        {!setor.archived_at && (
                          <button
                            className="botao botao--discreto"
                            type="button"
                            onClick={() => arquivar(setor.id)}
                          >
                            Arquivar {setor.nome}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
