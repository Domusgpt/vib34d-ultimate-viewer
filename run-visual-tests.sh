#!/bin/bash

# VIB34D Visual Testing Framework - Quick Start Script
# Sophisticated visual testing system for VIB34D holographic interface

echo "🧪 VIB34D VISUAL TESTING FRAMEWORK"
echo "Sophisticated browser automation agents for holographic interface testing"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed or not in PATH"
    exit 1
fi

print_status "Environment checks passed"

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    print_warning "Playwright not found, installing..."
    npm install
    npx playwright install
fi

# Start the server in background if not already running
SERVER_PID=""
if ! curl -s http://localhost:8146 > /dev/null 2>&1; then
    print_info "Starting VIB34D server on localhost:8146..."
    python3 -m http.server 8146 > server.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 3
    
    if curl -s http://localhost:8146 > /dev/null 2>&1; then
        print_status "VIB34D server started successfully"
    else
        print_error "Failed to start VIB34D server"
        exit 1
    fi
else
    print_status "VIB34D server is already running"
fi

# Parse command line arguments
PARALLEL=false
HEADED=false
DEBUG=false
BROWSER="chromium"
SPECIFIC_AGENT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --parallel)
            PARALLEL=true
            shift
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --browser=*)
            BROWSER="${1#*=}"
            shift
            ;;
        --agent=*)
            SPECIFIC_AGENT="${1#*=}"
            shift
            ;;
        --help)
            echo ""
            echo "VIB34D Visual Testing Framework - Command Line Options"
            echo "====================================================="
            echo ""
            echo "Usage: ./run-visual-tests.sh [options]"
            echo ""
            echo "Options:"
            echo "  --parallel          Run all agents in parallel (faster, more resource intensive)"
            echo "  --headed            Run tests with visible browser windows"
            echo "  --debug             Run tests in debug mode with step-by-step execution"
            echo "  --browser=NAME      Specify browser: chromium, firefox, or webkit"
            echo "  --agent=NAME        Run specific agent only:"
            echo "                        speed    = Visual Holographic Speed Test Agent"
            echo "                        density  = Visual Mouse Density Test Agent"
            echo "                        system   = Visual System Integration Agent"
            echo "                        override = Visual Parameter Override Agent"
            echo "  --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run-visual-tests.sh                    # Run all agents sequentially"
            echo "  ./run-visual-tests.sh --parallel         # Run all agents in parallel"
            echo "  ./run-visual-tests.sh --headed           # Run with visible browsers"
            echo "  ./run-visual-tests.sh --agent=speed      # Run only speed test agent"
            echo "  ./run-visual-tests.sh --browser=firefox  # Use Firefox browser"
            echo ""
            exit 0
            ;;
        *)
            print_warning "Unknown option: $1"
            shift
            ;;
    esac
done

print_info "Configuration:"
print_info "  Parallel: $PARALLEL"
print_info "  Headed: $HEADED"  
print_info "  Debug: $DEBUG"
print_info "  Browser: $BROWSER"
if [ -n "$SPECIFIC_AGENT" ]; then
    print_info "  Specific Agent: $SPECIFIC_AGENT"
fi

echo ""

# Run specific agent if requested
if [ -n "$SPECIFIC_AGENT" ]; then
    case $SPECIFIC_AGENT in
        speed)
            TEST_FILE="tests/visual-holographic-speed-test.spec.js"
            AGENT_NAME="Visual Holographic Speed Test Agent"
            ;;
        density)
            TEST_FILE="tests/visual-mouse-density-test.spec.js"
            AGENT_NAME="Visual Mouse Density Test Agent"
            ;;
        system)
            TEST_FILE="tests/visual-system-integration-test.spec.js"
            AGENT_NAME="Visual System Integration Agent"
            ;;
        override)
            TEST_FILE="tests/visual-parameter-override-test.spec.js"
            AGENT_NAME="Visual Parameter Override Agent"
            ;;
        *)
            print_error "Unknown agent: $SPECIFIC_AGENT"
            print_info "Available agents: speed, density, system, override"
            exit 1
            ;;
    esac
    
    print_info "Running $AGENT_NAME..."
    
    # Build command
    CMD="npx playwright test $TEST_FILE --project=$BROWSER"
    if [ "$HEADED" = true ]; then
        CMD="$CMD --headed"
    fi
    if [ "$DEBUG" = true ]; then
        CMD="$CMD --debug"
    fi
    
    print_info "Executing: $CMD"
    $CMD
    
else
    # Run all agents using the Node.js runner
    print_info "Running all visual testing agents..."
    
    # Build Node.js runner command
    NODE_CMD="node visual-test-runner.js"
    if [ "$PARALLEL" = true ]; then
        NODE_CMD="$NODE_CMD --parallel"
    fi
    if [ "$HEADED" = true ]; then
        NODE_CMD="$NODE_CMD --headed"
    fi
    if [ "$DEBUG" = true ]; then
        NODE_CMD="$NODE_CMD --debug"
    fi
    NODE_CMD="$NODE_CMD --browser=$BROWSER"
    
    print_info "Executing: $NODE_CMD"
    $NODE_CMD
fi

TEST_EXIT_CODE=$?

# Cleanup: stop server if we started it
if [ -n "$SERVER_PID" ]; then
    print_info "Stopping VIB34D server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null || true
fi

# Final status
echo ""
echo "=========================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status "All visual tests completed successfully!"
    print_info "Check the test-results/ directory for screenshots"
    print_info "Check the visual-test-reports/ directory for detailed reports"
else
    print_error "Some visual tests failed (exit code: $TEST_EXIT_CODE)"
    print_info "Check the test-results/ directory for screenshots and debugging info"
fi

echo ""
print_info "Visual Testing Framework Summary:"
print_info "• Screenshots saved in: test-results/"
print_info "• HTML report available in: visual-test-reports/visual-test-report.html"
print_info "• Playwright HTML report: npx playwright show-report"

exit $TEST_EXIT_CODE