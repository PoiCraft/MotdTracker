Write-Host "Running cargo fmt check..."
$fmt = & cargo fmt --all -- --check 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $fmt
    Write-Host "`nERROR: cargo fmt check failed. Run 'cargo fmt --all' to format the code.`n"
    exit 1
}

Write-Host "Running cargo check..."
$check = & cargo check --all 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $check
    Write-Host "`nERROR: cargo check failed. Fix compilation errors before committing.`n"
    exit 1
}

Write-Host "Running cargo clippy..."
$clippy = & cargo clippy --all-targets -- -D warnings 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $clippy
    Write-Host "`nERROR: cargo clippy failed. Fix clippy warnings before committing.`n"
    exit 1
}

Write-Host "Pre-commit checks passed."
