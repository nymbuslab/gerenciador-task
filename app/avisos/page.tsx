"use client";

import Link from "next/link";
import { Bell, Check, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppShell, CabecalhoDePagina, Estado } from "@/src/components/app-shell";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  type Notificacao,
} from "@/src/features/collaboration/service";
import { carregarSessao, type Sessao } from "@/src/features/identity/auth-service";
import { supabaseDoNavegador } from "@/src/lib/supabase-browser";

type Situacao = "carregando" | "pronto" | "sem-sessao" | "erro";

/** Avisos que pedem ação de quem recebeu ganham o tom de atenção. */
const TIPOS_DE_ATENCAO = ["validacao_reprovar"];

function formatarQuando(instante: string): string {
  return new Date(instante).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AvisosPage() {
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [avisos, setAvisos] = useState<Notificacao[]>([]);
  const [ocupada, setOcupada] = useState(false);

  const atualizar = useCallback(async () => {
    setAvisos(await listarNotificacoes(supabaseDoNavegador()));
  }, []);

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
        await atualizar();
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
  }, [atualizar]);

  async function marcarLido(aviso: Notificacao) {
    setOcupada(true);
    await marcarNotificacaoLida(supabaseDoNavegador(), aviso.id);
    await atualizar();
    setOcupada(false);
  }

  if (situacao === "carregando") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado titulo="Carregando" texto="Buscando seus avisos." />
        </div>
      </div>
    );
  }

  if (situacao !== "pronto") {
    return (
      <div className="portal">
        <div className="portal__corpo">
          <Estado
            papelAria="alert"
            titulo={situacao === "erro" ? "Não foi possível carregar" : "Entre para continuar"}
            texto={
              situacao === "erro"
                ? "A conexão com o servidor falhou. Recarregue a página em instantes."
                : "Os avisos são da sua conta. Entre com seu acesso."
            }
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

  const naoLidos = avisos.filter((aviso) => aviso.lidaEm === null).length;

  return (
    <AppShell papel={sessao!.papel} rotaAtual="/avisos" nomeUsuario={sessao!.nome}>
      <CabecalhoDePagina
        rotulo="Caixa de entrada"
        titulo={naoLidos > 0 ? `${naoLidos} por ler` : "Avisos"}
      />

      {avisos.length === 0 ? (
        <Estado
          titulo="Nenhum aviso"
          texto="Atribuição de tarefa, menção em comentário e decisão de validação aparecem aqui."
          acao={
            <Link className="botao" href="/hoje">
              Ver meu dia
            </Link>
          }
        />
      ) : (
        <div className="avisos">
          {avisos.map((aviso) => {
            const atencao = TIPOS_DE_ATENCAO.includes(aviso.tipo);

            return (
              <article
                key={aviso.id}
                className={aviso.lidaEm ? "aviso aviso--lido" : "aviso"}
                aria-labelledby={`aviso-${aviso.id}`}
              >
                <span className="aviso__icone" data-tom={atencao ? "atencao" : undefined}>
                  {atencao ? (
                    <TriangleAlert size={18} strokeWidth={1.5} aria-hidden="true" />
                  ) : aviso.lidaEm ? (
                    <Check size={18} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Bell size={18} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </span>

                <div className="aviso__texto">
                  <p className="aviso__titulo" id={`aviso-${aviso.id}`}>
                    {aviso.titulo}
                  </p>
                  {aviso.corpo && <p className="aviso__corpo">{aviso.corpo}</p>}
                  <p className="aviso__corpo">{formatarQuando(aviso.criadaEm)}</p>
                </div>

                {aviso.lidaEm === null && (
                  <button
                    className="botao botao--discreto"
                    type="button"
                    disabled={ocupada}
                    onClick={() => marcarLido(aviso)}
                  >
                    Marcar como lido
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
