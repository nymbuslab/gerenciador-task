$ErrorActionPreference = 'Stop'

$port = 3100
$server = Start-Process `
  -FilePath 'node.exe' `
  -ArgumentList @('tests/e2e/server.mjs') `
  -PassThru `
  -WindowStyle Hidden

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $ready) {
    throw 'Servidor E2E não ficou pronto dentro do prazo.'
  }

  corepack pnpm exec playwright test
  if ($LASTEXITCODE -ne 0) {
    throw "Playwright terminou com código $LASTEXITCODE."
  }
} finally {
  if (-not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
