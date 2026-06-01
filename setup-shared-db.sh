#!/bin/bash
# Script to configure A-Pictures with shared database
# Usage: ./setup-shared-db.sh /mnt/network/shared/folder

if [ -z "$1" ]; then
    echo ""
    echo "Usage: ./setup-shared-db.sh /path/to/shared/folder"
    echo ""
    echo "Example:"
    echo "./setup-shared-db.sh /mnt/network/shared/apictures"
    echo ""
    exit 1
fi

SHARED_PATH="$1"

# Verify folder exists
if [ ! -d "$SHARED_PATH" ]; then
    echo "Error: Folder $SHARED_PATH does not exist or is not accessible"
    exit 1
fi

# Create .env with configuration
cat > .env << EOF
# Database Path Configuration
DATABASE_PATH=$SHARED_PATH/database.db

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
EOF

echo ""
echo "✓ Configuration saved to .env"
echo "✓ Database: $SHARED_PATH/database.db"
echo ""
echo "Now run: node server.js"
echo ""
