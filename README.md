# Web Archiver Action

[![GitHub release](https://img.shields.io/github/v/release/your-username/web-archiver-action)](https://github.com/your-username/web-archiver-action/releases)

A reusable GitHub Actions workflow that archives a list of web artifacts—such as websites, file URLs, or subreddit names. It:
- Downloads and archives each artifact (using `wget` for websites/files and a placeholder for subreddits)
- Generates a `README.md` documenting each archived item, the run schedule, and links to download a ZIP of the repository and view the published GitHub Pages site
- Creates an `index.html` linking to the archived artifacts
- Commits the changes to the repository
- Deploys the content (including a dedicated `static` folder) to GitHub Pages

## Usage

This repository contains a reusable workflow that you can incorporate into your own GitHub Actions by referencing it. To use it in your repository, create a workflow file (e.g., `.github/workflows/archive.yml`) with the following content:

```yaml
name: Archive Artifacts

on:
  # Trigger on a schedule and/or manually.
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  archive:
    uses: your-username/web-archiver-action/.github/workflows/web-archiver.yml@v1
    with:
      # Provide a comma-separated list of artifacts to archive.
      artifacts: "https://example.com, r/AskReddit, https://example.com/file.pdf"
      schedule: "Daily at midnight (UTC)"
    secrets:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}