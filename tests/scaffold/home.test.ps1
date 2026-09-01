$ErrorActionPreference = 'Stop'

$port = 3101
$arguments = @(
  'node_modules/next/dist/bin/next',
  'start',
  '-p',
  $port
)

$server = Start-Process -FilePath 'node.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden

try {
  $response = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing
      break
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if ($null -eq $response) {
    throw 'Servidor não respondeu dentro do prazo do teste.'
  }

  if ($response.StatusCode -ne 200) {
    throw "Status inesperado: $($response.StatusCode)"
  }

  if ($response.Content -notmatch 'welcome-title') {
    throw 'O shell inicial não foi encontrado na resposta.'
  }

  Write-Output 'home: passed'
} finally {
  if (-not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
