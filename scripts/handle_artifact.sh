#!/bin/bash
# Usage: ./handle_artifact.sh <artifact> <repository>
artifact="$1"
REPO="$2"

if [[ "$artifact" =~ ^https?:// ]]; then
  # Delegate processing to the website handler.
  ./scripts/handle_website.sh "$artifact" "$REPO"
elif [[ "$artifact" =~ ^r/ ]]; then
  # Delegate processing to the subreddit handler.
  ./scripts/handle_subreddit.sh "$artifact"
else
  # Unrecognized artifact type.
  readme_snippet=" - **$artifact**: Unrecognized artifact type.\n"
  index_snippet="<li>$artifact (Unrecognized)</li>\n"
  echo -e "${readme_snippet}|||${index_snippet}"
fi