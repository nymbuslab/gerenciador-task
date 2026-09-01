$ErrorActionPreference = 'Stop'

$required = @(
  '.git',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'next.config.ts',
  'eslint.config.mjs',
  'app/layout.tsx',
  'app/page.tsx',
  'src/lib/env.ts',
  '.env.example',
  '.gitignore'
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Arquivo ou diretório obrigatório ausente: $path"
  }
}

$envExample = Get-Content -Raw -LiteralPath '.env.example'
foreach ($name in @(
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT'
)) {
  if ($envExample -notmatch "(?m)^$name=") {
    throw "Variável não documentada em .env.example: $name"
  }
}

corepack pnpm build
if ($LASTEXITCODE -ne 0) {
  throw 'corepack pnpm build falhou.'
}

Write-Output 'scaffold: passed'
