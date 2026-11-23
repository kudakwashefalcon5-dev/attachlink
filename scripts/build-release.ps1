param([string]$Output, [string]$Verify)
$ErrorActionPreference='Stop'
$argsList=@()
if($Output){$argsList+=@('--output',$Output)}
if($Verify){$argsList+=@('--verify',$Verify)}
& python (Join-Path $PSScriptRoot 'build-release.py') @argsList
exit $LASTEXITCODE
