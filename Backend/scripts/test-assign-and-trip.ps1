Param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$CeoEmail = "ezequielgrasso24@gmail.com",
  [string]$CeoPassword = "eze123"
)

Write-Host "BaseUrl:" $BaseUrl

function Invoke-Login {
  param([string]$Email, [string]$Password)
  try {
    return Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -Body (@{ email = $Email; password = $Password } | ConvertTo-Json) -ContentType "application/json"
  } catch {
    return $null
  }
}

$login = Invoke-Login -Email $CeoEmail -Password $CeoPassword
if (-not $login) {
  $login = Invoke-Login -Email "ceo@example.com" -Password "ceo123"
}
if (-not $login) { throw "Login failed" }
Write-Host "Login OK:" $login.usuario.nombre
$headers = @{ Authorization = "Bearer $($login.token)" }

# Ensure Camion
$camResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/camiones?limit=100" -Headers $headers
if ($camResp.total -eq 0) {
  $body = @{ patente = "AAA123"; marca = "Volvo"; modelo = "FH"; anio = 2020 } | ConvertTo-Json
  $cNew = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/camiones" -Headers $headers -Body $body -ContentType "application/json"
  $camionId = $cNew.id
  Write-Host "Camión creado id:" $camionId
} else {
  $camionId = $camResp.data[0].id
  Write-Host "Camión elegido id:" $camionId
}

# Ensure Camionero
$usuarios = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/usuarios" -Headers $headers
$camionero = ($usuarios | Where-Object { $_.rol -eq "camionero" } | Select-Object -First 1)
if (-not $camionero) {
  $uBody = @{ nombre = "Juan Perez"; email = "camionero@example.com"; password = "camio123"; rol = "camionero" } | ConvertTo-Json
  $camionero = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/usuarios" -Headers $headers -Body $uBody -ContentType "application/json"
  Write-Host "Camionero creado id:" $camionero.id
} else {
  Write-Host "Camionero existente id:" $camionero.id
}
$camioneroId = $camionero.id

# Assign camionero to camion
$asig = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/camiones/$camionId/asignarCamionero" -Headers $headers -Body (@{ camioneroId = $camioneroId } | ConvertTo-Json) -ContentType "application/json"
Write-Host "Asignación OK" ($asig.mensaje)

# Ensure Acoplado
$acoplados = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/acoplados" -Headers $headers
if ($acoplados.Count -eq 0) {
  $aBody = @{ patente = "AB 123 CD" } | ConvertTo-Json
  $aNew = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/acoplados" -Headers $headers -Body $aBody -ContentType "application/json"
  $acopladoId = $aNew.id
  Write-Host "Acoplado creado id:" $acopladoId
} else {
  $acopladoId = $acoplados[0].id
  Write-Host "Acoplado elegido id:" $acopladoId
}

# Create Viaje
$viajeBody = @{ origen = "Base"; destino = "Cliente"; fecha = (Get-Date).ToString("yyyy-MM-dd"); camionId = $camionId; acopladoId = $acopladoId; cliente = "ACME"; tipoMercaderia = "General" } | ConvertTo-Json
$viaje = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/viajes" -Headers $headers -Body $viajeBody -ContentType "application/json"
Write-Host "Viaje creado id:" $viaje.id
$viaje | ConvertTo-Json

# Notificaciones
$notis = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/notificaciones" -Headers $headers
$notis | ConvertTo-Json
