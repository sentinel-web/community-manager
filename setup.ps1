# Community Manager - Setup Script for Windows
# Run in PowerShell as Administrator

$ErrorActionPreference = "Stop"

# Node major the project targets. Keep in sync with Meteor's bundled Node
# (`meteor node -v`), the Dockerfile, CI, and setup.sh's NodeSource pin.
$NodeVersion = "22"

function Write-Header {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "  Community Manager - Setup Script" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[+] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[i] $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Update-SessionPath {
    # Pull the freshly-written Machine + User PATH into the current session so a
    # just-installed tool (nvm, the nvm Node symlink) resolves without a restart.
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Install-NodeWithNvm {
    Write-Step "Setting up Node.js $NodeVersion via nvm-windows..."

    # nvm-windows manages the active Node via a symlink; a non-nvm Node already on
    # PATH can shadow it, so existing standalone installs should be removed first.
    Write-Info "If a non-nvm Node.js is installed, uninstall it first so nvm can manage the active version."

    if (-not (Test-Command "nvm")) {
        Write-Info "nvm-windows not found. Installing it..."
        if (Test-Command "winget") {
            winget install CoreyButler.NVMforWindows --accept-package-agreements --accept-source-agreements
        }
        elseif (Test-Command "choco") {
            choco install nvm -y
        }
        else {
            Write-Error "No package manager found (winget or chocolatey) to install nvm-windows."
            Write-Info "Install it manually: https://github.com/coreybutler/nvm-windows/releases"
            Write-Info "Then re-run this script."
            exit 1
        }
        Update-SessionPath
    }
    else {
        Write-Success "nvm-windows is already installed."
    }

    # `nvm install 22` grabs the latest 22.x patch — floating within the major,
    # mirroring the NodeSource `setup_22.x` line used in setup.sh.
    Write-Info "Installing and activating Node.js $NodeVersion..."
    nvm install $NodeVersion
    nvm use $NodeVersion
    Update-SessionPath

    if (Test-Command "node") {
        Write-Success "Node.js $(node --version) active via nvm-windows."
    }
    else {
        Write-Info "Node was installed via nvm but isn't on PATH for this session yet."
        Write-Info "Open a new terminal (or run 'nvm use $NodeVersion') and re-run this script."
        exit 1
    }
}

function Install-Meteor {
    Write-Step "Installing Meteor.js..."

    if (Test-Command "choco") {
        Write-Info "Using Chocolatey..."
        choco install meteor -y
    }
    else {
        Write-Info "Using npx to install Meteor..."
        npx meteor --version
    }

    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Success "Meteor.js installed successfully!"
}

function Main {
    Write-Header

    Write-Info "Detected OS: Windows"

    # Check for administrator privileges for installations
    if (-not (Test-Administrator)) {
        Write-Info "Note: Running without administrator privileges."
        Write-Info "Some installations may require elevated permissions."
    }

    # Check Node.js — the project needs Node $NodeVersion.x (matches Meteor's bundled Node)
    Write-Step "Checking Node.js..."
    $nodeOk = $false
    if (Test-Command "node") {
        $nodeVersion = node --version
        if ($nodeVersion -match "^v$NodeVersion\.") {
            Write-Success "Node.js $nodeVersion is active (matches required major $NodeVersion)."
            $nodeOk = $true
        }
        else {
            Write-Info "Node.js $nodeVersion is active, but the project needs Node $NodeVersion.x."
        }
    }
    if (-not $nodeOk) {
        Install-NodeWithNvm
    }

    # Check npm
    Write-Step "Checking for npm..."
    if (Test-Command "npm") {
        $npmVersion = npm --version
        Write-Success "npm is already installed: $npmVersion"
    }
    else {
        Write-Error "npm not found. It should be installed with Node.js."
        Write-Info "Please restart your terminal and run this script again."
        exit 1
    }

    # Check and install Meteor
    Write-Step "Checking for Meteor.js..."
    $meteorInstalled = $false
    try {
        $meteorVersion = meteor --version 2>$null | Select-Object -First 1
        if ($meteorVersion) {
            $meteorInstalled = $true
            Write-Success "Meteor.js is already installed: $meteorVersion"
        }
    }
    catch {
        $meteorInstalled = $false
    }

    if (-not $meteorInstalled) {
        Install-Meteor
    }

    # Install project dependencies
    Write-Step "Installing project dependencies..."
    if (Test-Path "package.json") {
        & meteor npm install
        Write-Success "Dependencies installed successfully!"
    }
    else {
        Write-Error "package.json not found. Are you in the project directory?"
        exit 1
    }

    # Setup complete
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    Write-Info "To start the development server, run:"
    Write-Host "    npm start" -ForegroundColor Yellow
    Write-Host ""

    Write-Info "Access the application at:"
    Write-Host "    http://localhost:3000" -ForegroundColor Yellow
    Write-Host ""

    Write-Info "Development login credentials:"
    Write-Host "    Username: admin" -ForegroundColor Yellow
    Write-Host "    Password: admin" -ForegroundColor Yellow
    Write-Host ""
}

# Run main function
Main
