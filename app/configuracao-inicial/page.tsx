"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Estado } from "@/src/components/app-shell";

type Situacao = "carregando" | "disponivel" | "indisponivel" | "concluido" | "erro";

const CAMPOS = [
  { nome: "lojaNome", rotulo: "Nome da loja", tipo: "text", dica: "Como a loja aparece para a equipe." },
  { nome: "gestorNome", rotulo: "Nome do gestor", tipo: "text", dica: "Nome completo de quem vai administrar." },
  { nome: "usuario", rotulo: "Usuário de acesso", tipo: "text", dica: "Letras minúsculas, números, ponto, hífen ou sublinhado." },
  { nome: "email", rotulo: "E-mail", tipo: "email", dica: "Usado para entrar e recuperar o acesso." },
  { nome: "senha", rotulo: "Senha", tipo: "password", dica: "No mínimo 12 caracteres, com letra e número." },
] as const;

export default function ConfiguracaoInicialPage() {
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [motivos, setMotivos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;

    fetch("/api/bootstrap", { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : Promise.reject(resposta.status)))
      .then((dados: { disponivel: boolean }) => {
        if (ativo) {
          setSituacao(dados.disponivel ? "disponivel" : "indisponivel");
        }
      })
      .catch(() => {
        if (ativo) {
          setSituacao("erro");
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setMotivos([]);

    const formulario = new FormData(evento.currentTarget);
    const corpo = Object.fromEntries(CAMPOS.map((campo) => [campo.nome, formulario.get(campo.nome)]));

    try {
      const resposta = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (resposta.status === 201) {
        setSituacao("concluido");
        return;
      }

      if (resposta.status === 409) {
        setSituacao("indisponivel");
        return;
      }

      const dados = (await resposta.json().catch(() => null)) as { motivos?: string[] } | null;
      setMotivos(dados?.motivos ?? ["Não foi possível concluir a configuração. Tente novamente."]);
    } catch {
      setMotivos(["Não foi possível falar com o servidor. Verifique a conexão."]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="portal">
      <div className="portal__topo">
        <div className="portal__interno">
          <p className="casca__marca">Gestor de tarefas</p>
          <h1 className="portal__titulo" id="assistente-titulo">
            Configuração inicial
          </h1>
        </div>
      </div>

      <section className="portal__corpo" aria-labelledby="assistente-titulo">

        {situacao === "carregando" && (
          <Estado titulo="Verificando" texto="Conferindo se esta loja já tem gestor." />
        )}

        {situacao === "erro" && (
          <Estado
            papelAria="alert"
            titulo="Não foi possível verificar"
            texto="A conexão com o servidor falhou. Recarregue a página em instantes."
          />
        )}

        {situacao === "indisponivel" && (
          <Estado
            titulo="Assistente encerrado"
            texto="Esta loja já tem gestor. O assistente roda uma única vez e não cria outra conta."
            acao={
              <Link className="botao" href="/login">
                Ir para a entrada
              </Link>
            }
          />
        )}

        {situacao === "concluido" && (
          <Estado
            titulo="Loja criada"
            texto="A conta de gestor está pronta. Entre com o e-mail e a senha que você acabou de cadastrar."
            acao={
              <Link className="botao" href="/login">
                Entrar como gestor
              </Link>
            }
          />
        )}

        {situacao === "disponivel" && (
          <form className="formulario" onSubmit={enviar} noValidate>
            <p>Crie a loja e a primeira conta de gestor. Este assistente roda uma única vez.</p>

            {motivos.length > 0 && (
              <ul className="formulario__erros" role="alert" aria-label="Erros do formulário">
                {motivos.map((motivo) => (
                  <li key={motivo}>{motivo}</li>
                ))}
              </ul>
            )}

            {CAMPOS.map((campo) => (
              <div className="campo" key={campo.nome}>
                <label className="campo__rotulo" htmlFor={campo.nome}>
                  {campo.rotulo}
                </label>
                <input
                  className="campo__entrada"
                  id={campo.nome}
                  name={campo.nome}
                  type={campo.tipo}
                  required
                  aria-describedby={`${campo.nome}-dica`}
                  autoComplete={campo.tipo === "password" ? "new-password" : "off"}
                />
                <p className="campo__dica" id={`${campo.nome}-dica`}>
                  {campo.dica}
                </p>
              </div>
            ))}

            <button className="botao" type="submit" disabled={enviando}>
              {enviando ? "Criando" : "Criar loja e gestor"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
