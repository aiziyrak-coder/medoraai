# AiDoktor Rebranding Script - PowerShell Version
# MEDORA AI -> AiDoktor (Farg'ona Jamoat Salomatligi Tibbiyot Instituti)

Write-Host "🏥 AiDoktor Rebranding boshlandi..." -ForegroundColor Cyan
Write-Host ""

$files = Get-ChildItem -Recurse -Include *.py,*.tsx,*.ts,*.css,*.md,*.sh,*.json,.env* | 
         Where-Object { $_.FullName -notmatch 'node_modules|venv|__pycache__|\.git' }

$count = 0
foreach ($file in $files) {
   try {
        $content = Get-Content $file.FullName -Raw
        
        # Replacements
        $content = $content-replace 'MEDORA AI', 'AiDoktor'
        $content = $content-replace 'MEDORA', 'AiDoktor'
        $content = $content -replace 'medoraai', 'aidoktor'
        $content = $content-replace'Medora', 'AiDoktor'
        $content = $content-replace'medora\.', 'aidoktor.'
        $content = $content -replace'cdcgroup\.uz', 'fargana.uz'
        $content = $content-replace 'CDC Group', "Farg`'ona Jamoat Salomatligi Tibbiyot Instituti"
        
        # Save changes
        Set-Content $file.FullName $content-NoNewline
        $count++
    }
    catch {
        Write-Warning "Error processing $($file.FullName): $_"
    }
}

Write-Host ""
Write-Host "✅ Rebranding yakunlandi! $count files updated." -ForegroundColor Green
Write-Host ""
Write-Host "Keyingi qadam:" -ForegroundColor Yellow
Write-Host "1. git add ."
Write-Host "2. git commit -m `"Rebrand: MEDORA AI -> AiDoktor`""
Write-Host "3. git push origin main"
Write-Host "4. Serverga deploy qilish"
