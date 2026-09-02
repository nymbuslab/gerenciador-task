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
  senha: string;
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
  {
    id: "20000000-0000-4000-8000-000000000002",
    lojaId: loja.id,
    nome: "Acougue",
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
    senha: "SenhaGestor#2026",
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
    senha: "SenhaLider#2026",
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
    senha: "SenhaFuncionario#2026",
  },
  {
    authUserId: "30000000-0000-4000-8000-000000000004",
    perfilId: "40000000-0000-4000-8000-000000000004",
    lojaId: loja.id,
    setorId: setores[1].id,
    papel: "funcionario",
    nome: "Funcionario Outro Setor",
    email: "funcionario.outro@example.test",
    usuario: "funcionario.outro",
    senha: "SenhaOutroSetor#2026",
  },
];

export function criarIdentidadesDeTeste(): FixturesIdentidade {
  return {
    loja: { ...loja },
    setores: setores.map((setor) => ({ ...setor })),
    identidades: identidades.map((identidade) => ({ ...identidade })),
  };
}

export function identidadePorUsuario(usuario: string): IdentidadeTeste {
  const identidade = identidades.find((candidata) => candidata.usuario === usuario);

  if (!identidade) {
    throw new Error(`Identidade de teste desconhecida: ${usuario}`);
  }

  return { ...identidade };
}
