import { Bell, CalendarDays, ChartColumn, LayoutList, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type Papel = "gestor" | "lider" | "funcionario";

export type Destino = {
  rota: string;
  rotulo: string;
  Icone: LucideIcon;
};

/**
 * Destinos por papel, conforme PRD secao 4 e decisoes D-03 e D-22.
 * A navegacao esconde o que o papel nao opera, mas nao e a barreira de
 * autorizacao: quem decide o acesso real e a RLS do banco.
 */
const DESTINOS: Record<Papel, Destino[]> = {
  funcionario: [
    { rota: "/hoje", rotulo: "Meu dia", Icone: CalendarDays },
    { rota: "/avisos", rotulo: "Avisos", Icone: Bell },
  ],
  lider: [
    { rota: "/hoje", rotulo: "Meu dia", Icone: CalendarDays },
    { rota: "/setor", rotulo: "Setor", Icone: Users },
    { rota: "/avisos", rotulo: "Avisos", Icone: Bell },
  ],
  gestor: [
    { rota: "/operacao", rotulo: "Operação", Icone: ChartColumn },
    { rota: "/admin/funcionarios", rotulo: "Equipe", Icone: Users },
    { rota: "/admin/setores", rotulo: "Setores", Icone: LayoutList },
    { rota: "/avisos", rotulo: "Avisos", Icone: Bell },
  ],
};

const NOME_DO_PAPEL: Record<Papel, string> = {
  funcionario: "Funcionário",
  lider: "Líder de setor",
  gestor: "Gestor",
};

export function destinosDoPapel(papel: Papel): Destino[] {
  return DESTINOS[papel].map((destino) => ({ ...destino }));
}

export function nomeDoPapel(papel: Papel): string {
  return NOME_DO_PAPEL[papel];
}

export function Navigation({ papel, rotaAtual }: { papel: Papel; rotaAtual: string }) {
  const destinos = destinosDoPapel(papel);

  return (
    <nav className="navegacao" aria-label="Navegação principal">
      <ul className="navegacao__lista">
        {destinos.map(({ rota, rotulo, Icone }) => {
          const atual = rota === rotaAtual;

          return (
            <li key={rota}>
              <Link
                className="navegacao__destino"
                href={rota}
                aria-current={atual ? "page" : undefined}
                data-atual={atual ? "sim" : undefined}
              >
                <Icone size={18} strokeWidth={1.5} aria-hidden="true" />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
