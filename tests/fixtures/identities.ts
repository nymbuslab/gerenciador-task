export type PapelTeste = "gestor" | "lider" | "funcionario";

export type LojaTeste = {
  id: string;
  nome: string;
};

export type SetorTeste = {
  id: string;
  lojaId: string;
  nome: string;
};

export type IdentidadeTeste = {
  authUserId: string;
  perfilId: string;
  lojaId: string;
  setorId: string | null;
  papel: PapelTeste;
  nome: string;
  email: string;
  usuario: string;
};

export type FixturesIdentidade = {
  loja: LojaTeste;
  setores: SetorTeste[];
  identidades: IdentidadeTeste[];
};

const loja: LojaTeste = {
  id: "10000000-0000-4000-8000-000000000001",
  nome: "Loja de teste",
};

const setores: SetorTeste[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    lojaId: loja.id,
    nome: "Mercearia",
  },
];

const identidades: IdentidadeTeste[] = [
  {
    authUserId: "30000000-0000-4000-8000-000000000001",
    perfilId: "40000000-0000-4000-8000-000000000001",
    lojaId: loja.id,
    setorId: null,
    papel: "gestor",
    nome: "Gestor Teste",
    email: "gestor@example.test",
    usuario: "gestor.teste",
  },
  {
    authUserId: "30000000-0000-4000-8000-000000000002",
    perfilId: "40000000-0000-4000-8000-000000000002",
    lojaId: loja.id,
    setorId: setores[0].id,
    papel: "lider",
    nome: "Lider Teste",
    email: "lider@example.test",
    usuario: "lider.teste",
  },
  {
    authUserId: "30000000-0000-4000-8000-000000000003",
    perfilId: "40000000-0000-4000-8000-000000000003",
    lojaId: loja.id,
    setorId: setores[0].id,
    papel: "funcionario",
    nome: "Funcionario Teste",
    email: "funcionario@example.test",
    usuario: "funcionario.teste",
  },
];

export function criarIdentidadesDeTeste(): FixturesIdentidade {
  return {
    loja: { ...loja },
    setores: setores.map((setor) => ({ ...setor })),
    identidades: identidades.map((identidade) => ({ ...identidade })),
  };
}
