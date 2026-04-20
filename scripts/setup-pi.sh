#!/bin/bash
# Setup Agent Skills API with pi

echo "🤖 Agent Skills API + pi Setup"
echo "================================"
echo ""

# Check if Agent Skills API is running
echo "1. Checking Agent Skills API..."

if curl -s -f http://localhost:8004/health > /dev/null 2>&1; then
    echo "   ✅ Agent Skills API is running on port 8004"
else
    echo "   ⚠️  Agent Skills API is NOT running"
    echo ""
    echo "   To start it, run:"
    echo "   cd /home/aajcr/PROYECTOS/agent-skills-api"
    echo "   pnpm run start:dev"
    echo ""
    read -p "Start now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd /home/aajcr/PROYECTOS/agent-skills-api
        pnpm run start:dev &
        sleep 5
    fi
fi

echo ""
echo "2. Configuration files:"
echo "   MCP Config: ~/.pi/agent/pi-mcp-config.json"
echo "   Extension: ~/.pi/agent/extensions/agent-skills-ext.ts"

echo ""
echo "3. To use with pi, run:"
echo ""
echo "   Option A - MCP (using SSE):"
echo "   pi --mcp"
echo ""
echo "   Option B - Extension (custom tools):"
echo "   pi -e ~/.pi/agent/extensions/agent-skills-ext.ts"
echo ""

# Test connection
echo "4. Testing connection..."
response=$(curl -s http://localhost:8004/rules?limit=1)
if echo "$response" | grep -q "rules"; then
    echo "   ✅ API responding correctly"
    echo ""
    echo "   Available tools:"
    echo "   • search_rules  - Search code rules"
    echo "   • get_rule    - Get rule by ID"
    echo "   • list_rules  - List all rules"
    echo "   • context7_docs - Fetch library docs"
    echo "   • register_project - Register project"
    echo "   • agent_query - Main agent query"
else
    echo "   ⚠️  API responded but format unexpected"
fi

echo ""
echo "Setup complete! 🎉"
echo ""
echo "Quick test with pi:"
echo '  pi "search rules for clean architecture"'