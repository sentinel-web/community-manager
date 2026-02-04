# Community Manager - Setup Script for Windows
# Run in PowerShell as Administrator

$ErrorActionPreference = "Stop"

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

function Install-NodeJS {
    Write-Step "Installing Node.js..."

    if (Test-Command "winget") {
        Write-Info "Using winget..."
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    }
    elseif (Test-Command "choco") {
        Write-Info "Using Chocolatey..."
        choco install nodejs-lts -y
    }
    else {
        Write-Error "No package manager found (winget or chocolatey)."
        Write-Info "Please install Node.js manually from: https://nodejs.org/en/download/"
        Write-Info "Or install winget: https://aka.ms/getwinget"
        Write-Info "Or install Chocolatey: https://chocolatey.org/install"
        exit 1
    }

    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Success "Node.js installed successfully!"
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

    # Check and install Node.js
    Write-Step "Checking for Node.js..."
    if (Test-Command "node") {
        $nodeVersion = node --version
        Write-Success "Node.js is already installed: $nodeVersion"
    }
    else {
        Install-NodeJS
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
