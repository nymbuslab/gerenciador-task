"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import { supabaseDoNavegador } from "@/src/lib/supabase-browser";

type Modo = "funcionario" | "lideranca";

const CASAS_DO_PIN = 6;

function formatarHora(instante: string): string {
  return new Date(instante).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("funcionario");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pin, setPin] = useState<string[]>(Array(CASAS_DO_PIN).fill(""));
  const casas = useRef<(HTMLInputElement | null)[]>([]);

  function trocarModo(proximo: Modo) {
    setModo(proximo);
    setErro(null);
    setPin(Array(CASAS_DO_PIN).fill(""));
  }

  function digitar(posicao: number, valor: string) {
    const digito = valor.replace(/\D/g, "").slice(-1);

    setPin((antes) => {
      const proximo = [...antes];
      proximo[posicao] = digito;
      return proximo;
    });

    if (digito && posicao < CASAS_DO_PIN - 1) {
      casas.current[posicao + 1]?.focus();
    }
  }

  function apagar(posicao: number, evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Backspace" && pin[posicao] === "" && posicao > 0) {
      casas.current[posicao - 1]?.focus();
    }
  }

  // Colar o PIN inteiro numa casa só é o gesto natural de quem recebe o código
  // por mensagem; sem isto o texto cairia todo no primeiro campo.
  function colar(evento: ClipboardEvent<HTMLInputElement>) {
    const digitos = evento.clipboardData.getData("text").replace(/\D/g, "").slice(0, CASAS_DO_PIN);

    if (digitos.length === 0) {
      return;
    }

    evento.preventDefault();
    setPin(Array.from({ length: CASAS_DO_PIN }, (_, posicao) => digitos[posicao] ?? ""));
    casas.current[Math.min(digitos.length, CASAS_DO_PIN - 1)]?.focus();
  }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const identificador = String(dados.get("identificador") ?? "");
    const segredo = modo === "funcionario" ? pin.join("") : String(dados.get("segredo") ?? "");

    try {
      const resposta = await fetch("/auth/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identificador, segredo }),
      });

      const resultado = (await resposta.json().catch(() => null)) as
        | {
            situacao: string;
            destino?: string;
            motivo?: string;
            liberadoEm?: string | null;
            tokens?: { access_token: string; refresh_token: string };
          }
        | null;

      if (resposta.ok && resultado?.situacao === "autenticado" && resultado.destino && resultado.tokens) {
        await supabaseDoNavegador().auth.setSession(resultado.tokens);
        router.push(resultado.destino);
        return;
      }

      if (resultado?.situacao === "bloqueado") {
        setErro(
          resultado.liberadoEm
            ? `${resultado.motivo} Liberação prevista para ${formatarHora(resultado.liberadoEm)}.`
            : (resultado.motivo ?? "Acesso bloqueado por tentativas inválidas."),
        );
        setPin(Array(CASAS_DO_PIN).fill(""));
        return;
      }

      setErro(resultado?.motivo ?? "Usuário ou senha incorretos.");
      setPin(Array(CASAS_DO_PIN).fill(""));
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique a conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="portal">
      <div className="portal__topo">
        <div className="portal__interno">
          <p className="casca__marca">Gestor de tarefas</p>
          <h1 className="portal__titulo">A operação do dia, em um só lugar.</h1>
        </div>
      </div>

      <div className="portal__corpo">
        <div className="alternador" role="group" aria-label="Tipo de acesso">
          <button
            type="button"
            className="alternador__opcao"
            aria-pressed={modo === "funcionario"}
            onClick={() => trocarModo("funcionario")}
          >
            Funcionário
          </button>
          <button
            type="button"
            className="alternador__opcao"
            aria-pressed={modo === "lideranca"}
            onClick={() => trocarModo("lideranca")}
          >
            Liderança
          </button>
        </div>

        <form className="formulario" onSubmit={entrar} noValidate>
          {erro && (
            <ul className="formulario__erros" role="alert" aria-label="Erro de acesso">
              <li
                style={{ display: "flex", alignItems: "flex-start", gap: "var(--espaco-sm)" }}
              >
                <TriangleAlert
                  size={18}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  style={{ flexShrink: 0, color: "var(--cor-rubi)" }}
                />
                {erro}
              </li>
            </ul>
          )}

          <div className="campo">
            <label className="campo__rotulo" htmlFor="identificador">
              {modo === "funcionario" ? "Usuário" : "E-mail"}
            </label>
            <input
              className="campo__entrada"
              id="identificador"
              name="identificador"
              type={modo === "lideranca" ? "email" : "text"}
              inputMode={modo === "lideranca" ? "email" : "text"}
              autoComplete="username"
              required
            />
            <p className="campo__dica">
              {modo === "funcionario"
                ? "O usuário que a liderança cadastrou."
                : "Acesso de líder de setor e gestor."}
            </p>
          </div>

          {modo === "funcionario" ? (
            <fieldset className="campo" style={{ border: "none", margin: 0, padding: 0 }}>
              <legend className="campo__rotulo" style={{ padding: 0 }}>
                PIN
              </legend>
              <div className="pin">
                {pin.map((digito, posicao) => (
                  <input
                    key={posicao}
                    ref={(elemento) => {
                      casas.current[posicao] = elemento;
                    }}
                    className="pin__casa"
                    type="password"
                    inputMode="numeric"
                    autoComplete={posicao === 0 ? "current-password" : "off"}
                    maxLength={1}
                    aria-label={`Dígito ${posicao + 1} de ${CASAS_DO_PIN}`}
                    value={digito}
                    onChange={(evento) => digitar(posicao, evento.target.value)}
                    onKeyDown={(evento) => apagar(posicao, evento)}
                    onPaste={colar}
                  />
                ))}
              </div>
              <p className="campo__dica">
                Seis dígitos. Depois de cinco erros o acesso trava por 15 minutos.
              </p>
            </fieldset>
          ) : (
            <div className="campo">
              <label className="campo__rotulo" htmlFor="segredo">
                Senha
              </label>
              <input
                className="campo__entrada"
                id="segredo"
                name="segredo"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
          )}

          <button className="botao" type="submit" disabled={enviando}>
            {enviando ? "Entrando" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
