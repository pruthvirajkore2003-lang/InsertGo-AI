# Signs ONE file with Azure Artifact Signing (formerly Trusted Signing).
#
# Tauri invokes this once per binary it bundles AND once for the finished NSIS
# installer, via bundle.windows.signCommand in tauri.conf.json.
#
# The working directory during bundling is src-tauri (tauri-cli does
# set_current_dir(dirs.tauri) before bundling), which is why the config can
# reference this script by a plain relative name.
#
# Contract with the CI job (see .github/workflows/release-windows.yml):
#   IG_SIGN_METADATA - path to metadata.json (account/profile/endpoint). Unset => no-op.
#   IG_SIGN_DLIB     - path to x64\Azure.CodeSigning.Dlib.dll
#   IG_SIGNTOOL      - path to a Windows SDK signtool.exe >= 10.0.2261.755 (optional)
# Azure auth is handled inside the dlib by DefaultAzureCredential; metadata.json
# narrows the chain to AzureCliCredential, established by azure/login via OIDC.

[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Path)

$ErrorActionPreference = 'Stop'

# Local/dev builds are unsigned rather than broken.
if (-not $env:IG_SIGN_METADATA) {
  Write-Host "sign-windows: IG_SIGN_METADATA unset - leaving '$Path' unsigned."
  exit 0
}

if (-not (Test-Path -LiteralPath $Path)) {
  throw "sign-windows: file to sign does not exist: '$Path'"
}
if (-not (Test-Path -LiteralPath $env:IG_SIGN_METADATA)) {
  throw "sign-windows: IG_SIGN_METADATA points at a missing file: '$($env:IG_SIGN_METADATA)'"
}
if (-not $env:IG_SIGN_DLIB -or -not (Test-Path -LiteralPath $env:IG_SIGN_DLIB)) {
  throw "sign-windows: IG_SIGN_DLIB missing or not found: '$($env:IG_SIGN_DLIB)'"
}

$signtool = $env:IG_SIGNTOOL
if (-not $signtool) {
  $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.Directory.Parent.Name -as [version] } |
    Sort-Object { [version]$_.Directory.Parent.Name } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $signtool -or -not (Test-Path -LiteralPath $signtool)) {
  throw "sign-windows: signtool.exe not found. Install the Windows SDK (>= 10.0.2261.755) or set IG_SIGNTOOL."
}

$signArgs = @(
  'sign', '/v', '/debug', '/fd', 'SHA256',
  '/tr', 'http://timestamp.acs.microsoft.com', '/td', 'SHA256',
  '/dlib', $env:IG_SIGN_DLIB,
  '/dmdf', $env:IG_SIGN_METADATA,
  $Path
)

# ponytail: fixed 3-try backoff. Artifact Signing is a network call per file and
# 429/5xx are transient; a single blip should not throw away a 20-minute build.
# Swap for a real retry policy only if the failure rate justifies it.
foreach ($delay in 0, 5, 15) {
  if ($delay) { Start-Sleep -Seconds $delay }
  & $signtool @signArgs
  if ($LASTEXITCODE -eq 0) { exit 0 }
  Write-Host "sign-windows: signtool exited $LASTEXITCODE for '$Path'; retrying."
}

throw "sign-windows: signing failed for '$Path' after 3 attempts (last exit code $LASTEXITCODE)."
