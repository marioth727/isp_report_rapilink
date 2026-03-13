$headers = @{"Authorization"="Api-Key xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj"; "Api-Key"="xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj"}
$body = '{"ticket": "66702", "comentario": "test_probe_api", "respuesta": "test_probe_api", "autor": "SISTEMA"}'
$endpoints = @(
    "https://api.wisphub.io/api/tickets/comentarios/",
    "https://api.wisphub.io/api/tickets/respuestas/",
    "https://api.wisphub.io/api/tickets/66702/comentarios/",
    "https://api.wisphub.io/api/comentarios-tickets/"
)

foreach ($url in $endpoints) {
    try {
        Write-Host "Testing POST $url"
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "SUCCESS: $url"
        Write-Host $response
    } catch {
        Write-Host "FAILED: $url"
        Write-Host "  Error: $($_.Exception.Message)"
        if ($_.Exception.Response) {
             $stream = $_.Exception.Response.GetResponseStream()
             if ($stream) {
                 $reader = New-Object System.IO.StreamReader($stream)
                 Write-Host "  Response Body: $($reader.ReadToEnd())"
             }
        }
    }
    Write-Host "--------------------------------"
}
