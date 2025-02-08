#!/bin/bash
# Usage: ./handle_subreddit.sh <artifact>
artifact="$1"

# Extract the subreddit name (remove the 'r/' prefix).
SUBREDDIT=$(echo "$artifact" | cut -d'/' -f2)
# Construct the wiki URL for the subreddit.
WIKI_URL="https://www.reddit.com/r/${SUBREDDIT}/wiki/index"
# Define the output file for the archived wiki.
OUTPUT_FILE="archive/${SUBREDDIT}_wiki.html"

# Archive a copy of the subreddit's wiki using curl.
# Using a custom user agent to mimic a browser.
curl -sL -A "Mozilla/5.0 (compatible; GitHub-ArchiveBot/1.0)" "$WIKI_URL" -o "$OUTPUT_FILE"

# Generate output snippets.
readme_snippet=" - **r/$SUBREDDIT Wiki** archived in \`$OUTPUT_FILE\`\n"
index_snippet="<li><a href='$OUTPUT_FILE'>r/$SUBREDDIT Wiki</a></li>\n"

echo -e "${readme_snippet}|||${index_snippet}"