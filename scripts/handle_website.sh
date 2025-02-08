#!/bin/bash
# Usage: ./handle_website.sh <artifact> <repository>
artifact="$1"
REPO="$2"

# Extract the domain from the URL.
DOMAIN=$(echo "$artifact" | awk -F/ '{print $3}')
TARGET_DIR="archive/${DOMAIN}"

# Check if the URL returns a 404.
status=$(curl -o /dev/null -s -w "%{http_code}" "$artifact")
if [ "$status" -eq 404 ]; then
  readme_snippet=" - **$artifact**: Returned 404 and was skipped.\n"
  index_snippet="<li>$artifact (404 Not Found)</li>\n"
  echo -e "${readme_snippet}|||${index_snippet}"
  exit 0
fi

# Remove previous downloads and prepare the target directory.
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Download the website using wget with your preferred options.
wget -mkpKEH --limit-rate 10m --random-wait --user-agent="github.com/${REPO}" --domains="$DOMAIN" "$artifact" || true

# Clean up any unwanted backup files.
find "$TARGET_DIR" -name "*.orig" -type f -delete

# Generate output snippets.
readme_snippet=" - **$artifact** archived in \`$TARGET_DIR\`\n"
index_snippet="<li><a href='$TARGET_DIR/index.html'>$artifact</a></li>\n"

echo -e "${readme_snippet}|||${index_snippet}"