#!/bin/bash

# Community Manager - Setup Script
# Works on Linux, macOS, and Windows (Git Bash/WSL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  Community Manager - Setup Script${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_step() {
    echo -e "${YELLOW}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_error() {
    echo -e "${RED}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="linux";;
        Darwin*)    OS="macos";;
        CYGWIN*|MINGW*|MSYS*) OS="windows";;
        *)          OS="unknown";;
    esac
    echo "$OS"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Node.js
install_node() {
    print_step "Installing Node.js..."

    case "$OS" in
        linux)
            if command_exists apt-get; then
                print_info "Using apt package manager..."
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command_exists dnf; then
                print_info "Using dnf package manager..."
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                sudo dnf install -y nodejs
            elif command_exists yum; then
                print_info "Using yum package manager..."
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                sudo yum install -y nodejs
            elif command_exists pacman; then
                print_info "Using pacman package manager..."
                sudo pacman -S --noconfirm nodejs npm
            else
                print_error "Could not detect package manager. Please install Node.js manually."
                print_info "Visit: https://nodejs.org/en/download/"
                exit 1
            fi
            ;;
        macos)
            if command_exists brew; then
                print_info "Using Homebrew..."
                brew install node
            else
                print_info "Homebrew not found. Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                brew install node
            fi
            ;;
        windows)
            print_error "Please install Node.js manually on Windows."
            print_info "Visit: https://nodejs.org/en/download/"
            print_info "Or use: winget install OpenJS.NodeJS.LTS"
            exit 1
            ;;
    esac

    print_success "Node.js installed successfully!"
}

# Install Meteor
install_meteor() {
    print_step "Installing Meteor.js..."

    case "$OS" in
        linux|macos)
            curl https://install.meteor.com/ | sh
            ;;
        windows)
            print_info "Installing Meteor via npx..."
            npx meteor
            ;;
    esac

    print_success "Meteor.js installed successfully!"
}

# Main setup function
main() {
    print_header

    OS=$(detect_os)
    print_info "Detected OS: $OS"

    if [ "$OS" = "unknown" ]; then
        print_error "Unknown operating system. Please install dependencies manually."
        exit 1
    fi

    # Check and install Node.js
    print_step "Checking for Node.js..."
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is already installed: $NODE_VERSION"
    else
        install_node
    fi

    # Check and install npm
    print_step "Checking for npm..."
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm is already installed: $NPM_VERSION"
    else
        print_error "npm not found. It should be installed with Node.js."
        exit 1
    fi

    # Check and install Meteor
    print_step "Checking for Meteor.js..."
    if command_exists meteor; then
        METEOR_VERSION=$(meteor --version 2>/dev/null | head -n1)
        print_success "Meteor.js is already installed: $METEOR_VERSION"
    else
        install_meteor
    fi

    # Install project dependencies
    print_step "Installing project dependencies..."
    if [ -f "package.json" ]; then
        meteor npm install
        print_success "Dependencies installed successfully!"
    else
        print_error "package.json not found. Are you in the project directory?"
        exit 1
    fi

    # Setup complete
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}\n"

    print_info "To start the development server, run:"
    echo -e "    ${YELLOW}npm start${NC}\n"

    print_info "Access the application at:"
    echo -e "    ${YELLOW}http://localhost:3000${NC}\n"

    print_info "Development login credentials:"
    echo -e "    Username: ${YELLOW}admin${NC}"
    echo -e "    Password: ${YELLOW}admin${NC}\n"
}

# Run main function
main
