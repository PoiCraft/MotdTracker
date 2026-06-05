# ── Rust checks (only when Rust files have staged changes) ──────────
$rustChanged = & git diff --cached --name-only --diff-filter=ACMR -- '*.rs' 'Cargo.toml' 'Cargo.lock' '.cargo/' 2>&1
if ($rustChanged) {
    Write-Host "Rust changes detected, running Rust checks..."

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
} else {
    Write-Host "No Rust changes, skipping Rust checks."
}

# ── Frontend checks (only when frontend/ has staged changes) ─────────
$frontendChanged = & git diff --cached --name-only --diff-filter=ACMR -- frontend/ 2>&1
if ($frontendChanged) {
    Write-Host "Frontend changes detected, running frontend checks..."

    Write-Host "Running tsc --noEmit..."
    Push-Location frontend
    & npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "`nERROR: TypeScript check failed. Fix type errors before committing.`n"
        exit 1
    }

    Write-Host "Running eslint..."
    & npx eslint . 2>&1
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "`nERROR: ESLint check failed. Fix lint errors before committing.`n"
        exit 1
    }

    Write-Host "Running npm run build..."
    & npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "`nERROR: Frontend build failed. Fix build errors before committing.`n"
        exit 1
    }

    Pop-Location
} else {
    Write-Host "No frontend changes, skipping frontend checks."
}

Write-Host "Pre-commit checks passed."
