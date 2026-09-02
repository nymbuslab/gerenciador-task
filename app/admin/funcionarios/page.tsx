"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AppShell, CabecalhoDePagina, Estado } from "@/src/components/app-shell";
import { carregarSessao, type Sessao } from "@/src/features/identity/auth-service";
import { supabaseDoNavegador } from "@/src/lib/supabase-browser";

type Setor = { id: string; nome: string };

type Pessoa = {
  id: string;
  nome: string;
  usuario: string;
  archived_at: string | null;
  memberships: { papel: string; sector_id: string | null; ativo: boolean }[];
};

type Estado = "carregando" | "pronto" | "sem-sessao" | "sem-permissao";

const NOME_DO_PAPEL: Record<string, string> = {
  gestor: "Gestor",
  lider: "Líder de setor",
  funcionario: "Funcionário",
};

export default function AdminFuncionariosPage() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async () => {
    const cliente = supabaseDoNavegador();

    const [{ data: listaSetores }, { data: listaPessoas }] = await Promise.all([
      cliente.from("sectors").select("id, nome").is("archived_at", null).order("nome"),
      cliente
        .from("profiles")
        .select("id, nome, usuario, archived_at, memberships(papel, sector_id, ativo)")
        .order("nome"),
    ]);

    setSetores(listaSetores ?? []);
    setPessoas((listaPessoas as Pessoa[] | null) ?? []);
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

        setSessao(atual);

        if (atual.papel !== "gestor") {
          setEstado("sem-permissao");
          return;
        }

        await carregarDados();
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
  }, [carregarDados]);

  async function tokenDeAcesso(): Promise<string | null> {
    const { data } = await supabaseDoNavegador().auth.getSession();

    return data.session?.access_token ?? null;
  }

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setAviso(null);

    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    const token = await tokenDeAcesso();

    const resposta = await fetch("/api/admin/pessoas", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nome: String(dados.get("nome") ?? ""),
        usuario: String(dados.get("usuario") ?? ""),
        setorId: String(dados.get("setorId") ?? ""),
        pin: String(dados.get("pin") ?? ""),
      }),
    });

    if (resposta.ok) {
      formulario.reset();
      setAviso("Funcionário cadastrado.");
      await carregarDados();
    } else {
      setErro("Não foi possível cadastrar. Confira usuário, setor e PIN de seis dígitos.");
    }

    setSalvando(false);
  }

  async function promover(perfilId: string) {
    await supabaseDoNavegador()
      .from("memberships")
      .update({ papel: "lider" })
      .eq("profile_id", perfilId)
      .eq("ativo", true);

    setAviso("Vínculo promovido a líder de setor.");
    await carregarDados();
  }

  async function transferir(perfilId: string, setorId: string) {
    await supabaseDoNavegador()
      .from("memberships")
      .update({ sector_id: setorId })
      .eq("profile_id", perfilId)
      .eq("ativo", true);

    setAviso("Vínculo transferido de setor.");
    await carregarDados();
  }

  async function redefinir(perfilId: string, pin: string) {
    const token = await tokenDeAcesso();

    const resposta = await fetch("/api/admin/pessoas", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ perfilId, pin }),
    });

    if (resposta.ok) {
      setAviso("PIN redefinido.");
      setErro(null);
    } else {
      setErro("Não foi possível redefinir o PIN. Use seis dígitos.");
    }
  }

  if (estado === "carregando") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado titulo="Carregando" texto="Buscando a equipe da loja." />
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
            texto="Administrar a equipe exige uma conta de gestor."
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

  return (
    <AppShell papel={sessao!.papel} rotaAtual="/admin/funcionarios" nomeUsuario={sessao!.nome}>
      <CabecalhoDePagina rotulo="Administração" titulo="Equipe" />

      {estado === "sem-permissao" ? (
        <Estado
          papelAria="alert"
          titulo="Esta visão é do gestor"
          texto="Somente o gestor cadastra pessoas, promove líder e redefine acesso."
          acao={
            <a className="botao" href="/hoje">
              Ver meu dia
            </a>
          }
        />
      ) : (
        <>
          {aviso && (
            <p role="status" className="recado">
              {aviso}
            </p>
          )}

          <form className="formulario" onSubmit={cadastrar} noValidate>
            {erro && (
              <ul className="formulario__erros" role="alert" aria-label="Erro na equipe">
                <li>{erro}</li>
              </ul>
            )}

            <div className="campo">
              <label className="campo__rotulo" htmlFor="nome">
                Nome
              </label>
              <input className="campo__entrada" id="nome" name="nome" type="text" required />
            </div>

            <div className="campo">
              <label className="campo__rotulo" htmlFor="usuario">
                Usuário
              </label>
              <input className="campo__entrada" id="usuario" name="usuario" type="text" required />
            </div>

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

            <div className="campo">
              <label className="campo__rotulo" htmlFor="pin">
                PIN de seis dígitos
              </label>
              <input
                className="campo__entrada"
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                required
              />
            </div>

            <button className="botao" type="submit" disabled={salvando}>
              {salvando ? "Cadastrando" : "Cadastrar funcionário"}
            </button>
          </form>

          <table className="tabela">
            <caption>Pessoas da loja</caption>
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Papel</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((pessoa) => {
                const vinculo = pessoa.memberships.find((item) => item.ativo);

                return (
                  <tr key={pessoa.id}>
                    <td>
                      {pessoa.nome}
                      <span className="tabela__apoio">{pessoa.usuario}</span>
                    </td>
                    <td>{vinculo ? NOME_DO_PAPEL[vinculo.papel] : "Sem vínculo ativo"}</td>
                    <td className="tabela__acoes">
                      {vinculo?.papel === "funcionario" && (
                        <button
                          className="botao botao--discreto"
                          type="button"
                          onClick={() => promover(pessoa.id)}
                        >
                          Promover {pessoa.nome} a líder
                        </button>
                      )}

                      {vinculo?.sector_id && (
                        <label className="campo__rotulo">
                          Setor de {pessoa.nome}
                          <select
                            className="campo__entrada"
                            value={vinculo.sector_id}
                            onChange={(evento) => transferir(pessoa.id, evento.target.value)}
                          >
                            {setores.map((setor) => (
                              <option key={setor.id} value={setor.id}>
                                {setor.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {vinculo && vinculo.papel !== "gestor" && (
                        <FormularioPin pessoa={pessoa} aoRedefinir={redefinir} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </AppShell>
  );
}

function FormularioPin({
  pessoa,
  aoRedefinir,
}: {
  pessoa: Pessoa;
  aoRedefinir: (perfilId: string, pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={`pin-${pessoa.id}`}>
        Novo PIN de {pessoa.nome}
      </label>
      <input
        className="campo__entrada"
        id={`pin-${pessoa.id}`}
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        value={pin}
        onChange={(evento) => setPin(evento.target.value)}
      />
      <button
        className="botao botao--discreto"
        type="button"
        onClick={async () => {
          await aoRedefinir(pessoa.id, pin);
          setPin("");
        }}
      >
        Redefinir PIN de {pessoa.nome}
      </button>
    </div>
  );
}
