#!/bin/bash

# Supercode Release Script
# This script creates a new release for the Supercode fork
# Usage: ./script/release-supercode.sh <version>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION=$1

# Validate version format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo -e "${RED}Error: Invalid version format${NC}"
    echo "Version should be in format: X.Y.Z or X.Y.Z-prerelease"
    exit 1
fi

echo -e "${GREEN}🚀 Starting Supercode release process for version ${VERSION}${NC}"

# Check if we're on the dev branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo -e "${YELLOW}Warning: Not on dev branch (currently on $CURRENT_BRANCH)${NC}"
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: You have uncommitted changes${NC}"
    echo "Please commit or stash your changes before releasing"
    exit 1
fi

# Update version in package.json files
echo -e "${YELLOW}📝 Updating version in package.json files...${NC}"
find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*" | while read file; do
    if grep -q '"version":' "$file"; then
        sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$file"
        rm "${file}.bak"
        echo "  Updated: $file"
    fi
done

# Update version in installation script if it exists
if [ -f "install" ]; then
    echo -e "${YELLOW}📝 Updating version in install script...${NC}"
    sed -i.bak "s/VERSION=\"[^\"]*\"/VERSION=\"$VERSION\"/" install
    rm install.bak
fi

# Commit version changes
echo -e "${YELLOW}📝 Committing version changes...${NC}"
git add -A
git commit -m "release: v${VERSION}" || {
    echo -e "${YELLOW}No changes to commit${NC}"
}

# Create and push tag
echo -e "${YELLOW}🏷️  Creating tag v${VERSION}...${NC}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"

# Push changes and tag
echo -e "${YELLOW}📤 Pushing to remote...${NC}"
git push origin "$CURRENT_BRANCH"
git push origin "v${VERSION}"

echo -e "${GREEN}✅ Release tag v${VERSION} created and pushed!${NC}"
echo ""
echo "Next steps:"
echo "1. Go to https://github.com/kirmad/supercode/actions"
echo "2. The release workflow should trigger automatically"
echo "3. If not, you can manually trigger it from the Actions tab"
echo ""
echo "Alternatively, create a release manually:"
echo "  gh release create v${VERSION} --title \"v${VERSION}\" --generate-notes"