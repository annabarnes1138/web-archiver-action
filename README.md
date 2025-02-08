# Web Archiver Action

[![GitHub release](https://img.shields.io/github/v/release/annabarnes1138/web-archiver-action)](https://github.com/annabarnes1138/web-archiver-action/releases)

A reusable GitHub Actions **JavaScript action** that archives a list of web artifacts—such as websites, file URLs, or subreddit pages. This action:
- **Downloads and archives full websites** using `wget`, storing them in a structured `archive/` folder.
- **Generates correct links to archived copies**, so that the saved files are accessible instead of linking back to the original URLs.
- **Implements artifact processing in JavaScript** for a self-contained and streamlined workflow.
- **Generates a `README.md` documenting each archived item**, including:
  - A static description (if provided)
  - An optional per-artifact description (if provided in the JSON input)
  - The date each artifact was last archived
  - The run schedule and links to download a ZIP of the repository and view the published GitHub Pages site
- **Creates an `index.html`** linking to the archived artifacts.
- **Commits the changes to the repository.**
- **Deploys the content** (including a dedicated `static/` folder) to GitHub Pages.

---

## How the Action Works
**1.	Archives Websites Locally**
* Uses wget to **download and save full copies of websites** to the archive/ folder.
* Includes --mirror --convert-links --adjust-extension --page-requisites --no-parent to ensure a complete archive.
* Uses sanitized filenames to prevent conflicts.

**2.	Generates Proper Archive Links**
* Instead of linking back to the original URLs, the README and index.html link to the saved copies in archive/.
* Example:
  * Original: [https://example.com](https://example.com)
  * Archived: [https://example.com](archive/example_com/index.html)

**3.	Commits Changes & Pushes to Repository**
  * Automatically commits and pushes the new archives to the repository.
  * Supports scheduling for automatic backups.

**4.	Supports GitHub Pages Deployment**
  * The archive can be viewed online via GitHub Pages if enabled.

---

## Repository Structure

```plaintext
web-archiver-action/
├── action.yml                  # JavaScript action definition
├── package.json                # Node.js project file
├── main.js                     # Main script containing action logic
├── README.md                   # This file
├── LICENSE
├── archive/                    # Folder where website archives are saved
└── static/                     # Folder for static files like example.txt
```

## Usage

This repository contains a JavaScript action that you can incorporate into your own GitHub Actions by referencing it. The action accepts a JSON array for the artifacts input. Each object in the JSON array should include a `"url"` property and may optionally include a `"description"`. Additionally, you can provide a static description that will appear at the top of the generated README.

### Example Workflow
To use the action, create a workflow file (e.g., `.github/workflows/archive.yml`) with the following content:

```yaml
name: Archive Artifacts

on:
  # Trigger on a schedule and/or manually.
  schedule:
    - cron: '0 0 * * 5'  # Runs every Friday at midnight (UTC)
  workflow_dispatch:

permissions:
  contents: write  # Required to allow pushing commits

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run Web Archiver Action
        uses: annabarnes1138/web-archiver-action@v2
        with:
          # Provide a JSON array of artifact objects. Each object must include a "url" and may include a "description".
          artifacts: |
            [
              { "url": "https://example.com", "description": "Example website" },
              { "url": "r/AskReddit", "description": "Subreddit Wiki for AskReddit" },
              { "url": "https://example.com/file.pdf" }
            ]
          schedule: "Weekly on Fridays at midnight (UTC)"
          static_description: "Backup of web resources."
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Permissions Requirement
By default, GITHUB_TOKEN has read-only access when running in another repository.
To allow the action to push commits, you must explicitly grant it write permissions in your workflow:

```yaml
permissions:
  contents: write
```
Without this, Git operations (like commits and pushes) will fail with a 403 error.

## Alternative: Using a Personal Access Token (PAT)

If you’re running this action in a repository where you cannot modify permissions, you can use a Personal Access Token (PAT) instead.

### 1. Generate a PAT
	•	Go to GitHub → Settings → Developer Settings → Personal Access Tokens.
	•	Click “Generate new token”.
	•	Enable these scopes:
	•	✅ repo (Full control of repositories)
	•	✅ workflow (Access GitHub Actions)

### 2. Add the PAT as a Repository Secret
	•	Go to Settings → Secrets and Variables → Actions.
	•	Click “New repository secret”.
	•	Name it PAT_TOKEN.
	•	Paste the copied PAT.

### 3. Update the Workflow

Modify the workflow to use the PAT instead of GITHUB_TOKEN:

```yaml
jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run Web Archiver Action
        uses: annabarnes1138/web-archiver-action@v2
        with:
          artifacts: '[{"url": "https://example.com", "description": "Example website"}]'
          schedule: "Weekly on Fridays at midnight (UTC)"
          static_description: "Backup of web resources."
          github_token: ${{ secrets.PAT_TOKEN }}  # Use PAT instead of GITHUB_TOKEN
```

## Final Notes

✅ If you own the repository, updating permissions: contents: write is the best approach.

✅ If you’re running this in a third-party or organization-managed repository, using a PAT is a reliable alternative.