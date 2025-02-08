# Web Archiver Action

[![GitHub release](https://img.shields.io/github/v/release/annabarnes1138/web-archiver-action)](https://github.com/annabarnes1138/web-archiver-action/releases)

A reusable GitHub Actions composite action that archives a list of web artifacts—such as websites, file URLs, or subreddit names. It:
- Downloads and archives each artifact (using `wget` for websites/files and a specialized process for subreddits)
- **Separates artifact processing into individual scripts** for easier readability and maintainability:
  - `scripts/handle_website.sh` handles website URLs
  - `scripts/handle_subreddit.sh` handles subreddit artifacts by archiving only the wiki page
  - `scripts/handle_artifact.sh` acts as a dispatcher to call the appropriate script
- Generates a `README.md` documenting each archived item, the run schedule, and links to download a ZIP of the repository and view the published GitHub Pages site
- Creates an `index.html` linking to the archived artifacts
- Commits the changes to the repository
- Deploys the content (including a dedicated `static` folder) to GitHub Pages

## Repository Structure
```
web-archiver-action/
├── scripts/
│   ├── handle_artifact.sh      # Dispatcher script that selects the proper handler
│   ├── handle_website.sh       # Processes website URLs
│   └── handle_subreddit.sh     # Archives only the subreddit’s wiki page
├── action.yml                  # Composite action definition
├── README.md                   # This file
└── LICENSE
```

## Usage

This repository contains a composite action that you can incorporate into your own GitHub Actions by referencing it. To use it in your repository, create a workflow file (e.g., `.github/workflows/archive.yml`) with the following content:

```yaml
name: Archive Artifacts

on:
  # Trigger on a schedule and/or manually.
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Run Web Archiver Composite Action
        uses: annabarnes1138/web-archiver-action@v1
        with:
          # Provide a comma-separated list of artifacts to archive.
          artifacts: "https://example.com, r/AskReddit, https://example.com/file.pdf"
          schedule: "Daily at midnight (UTC)"
        secrets:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Optionally include webhook and Discord user ID for alerting on 404 errors.
          WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
          DISCORD_USER_ID: ${{ secrets.DISCORD_USER_ID }}