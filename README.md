# Web Archiver Action

[![GitHub release](https://img.shields.io/github/v/release/annabarnes1138/web-archiver-action)](https://github.com/annabarnes1138/web-archiver-action/releases)

A reusable GitHub Actions **JavaScript action** that archives a list of web artifacts—such as websites, file URLs, or **subreddit wikis**. This action:
- **Downloads and archives full websites** using `wget`, storing them in a structured `archive/` folder.
- **Automatically archives subreddit wikis using `curl`** to bypass restrictions that block `wget`.
- **Generates correct links to archived copies**, so that the saved files are accessible instead of linking back to the original URLs.
- **Stores the last successful archive date**, ensuring that even if an archive attempt fails, the README and index will still reference the most recent successful version.
- **Maintains archive history in `archive/metadata.json`**, tracking when each artifact was last successfully archived.
- **Implements artifact processing in JavaScript** for a self-contained and streamlined workflow.
- **Generates a `README.md` and `index.html` documenting each archived item**, including:
  - A dynamically generated description based on the **update schedule**.
  - A table listing all **archived websites, their description, and the last successful archive date**.
  - The **GitHub Pages link** for online access.
  - Instructions for **local access** via a downloaded ZIP.
  - Instructions for **mirroring the archive**.
  - A **contact section**, with an optional email if provided.
- **Creates an `index.html`** that serves as an **interactive archive index**, making it easy to browse archived content.
- **Commits the changes to the repository.**
- **Deploys the content** to GitHub Pages.

---

## **How the Action Works**

This action **automates website archiving** and saves **full websites or specific pages**, ensuring that **important content is preserved**.

It intelligently selects **the best tool for each archive**:
- **Uses `wget` for general websites** (to fully mirror them).
- **Uses `curl` for Reddit wikis** (because Reddit blocks `wget`).
- **Skips archiving if a page returns a 404 (Not Found) error**.
- **Includes cookies for age-restricted content** (to bypass Reddit’s over-18 warning).
- **Ensures all archives are correctly stored in a structured format**.

### ✅ **Error Handling**
- **404 Not Found errors will NOT stop the job.**  
  - The action will log these as warnings and continue archiving other sites.
- **All other errors (server issues, download failures, etc.) will fail the workflow.**  
  - If a website cannot be accessed (HTTP `500+` errors, DNS failures), the action will stop.
- **wget and curl errors will halt execution** if archiving a site is unsuccessful.

### ⚙️ **Configurable Options**
| Input        | Description |
|-------------|------------|
| `artifacts` | A list of websites to archive (JSON format). **(Required)** |
| `schedule`  | How often the action runs. Example: `"Weekly updates"` |
| `contact_email` | Optional email to display in the generated `README.md`. |
| `limit_rate` | Limits download speed (e.g., `"10m"` for 10MB/s). Default: No limit. |
| `user_agent` | Sets a custom `User-Agent` header for wget/curl. Defaults to a Chrome browser string. |

### 📝 **Logging & Debugging**
- Logs will indicate **if a site was successfully archived or why it failed**.
- If a site **fails repeatedly**, previous successful archives are preserved.
- The action will **fail with a clear message** if critical errors occur.

---

### **1. Archives Websites and Subreddit Wikis**
| Website Type | Tool Used | Notes |
|-------------|----------|-------|
| General websites (e.g., `example.com`) | `wget` | Archives all linked resources (CSS, images, JS). |
| Subreddit wikis (e.g., `r/AskReddit`) | `curl` | Uses `curl` because Reddit blocks `wget`. Saves as `archive/reddit/{subreddit}.html`. |
| 404 Pages | **Skipped** | If a page is missing, the action logs a warning and skips it. |

#### **Website Archiving (wget)**
- Uses `wget` to **mirror entire websites**:
```sh
wget –mirror –convert-links –adjust-extension –page-requisites –no-parent 
-e robots=off –random-wait –user-agent=”{userAgent}” –no-check-certificate 
–limit-rate={limitRate} -P archive {URL}
```
- Automatically organizes archives based on the website’s domain name (e.g., `archive/hrt.coffee/`).

#### **Subreddit Wiki Archiving (curl)**
- Uses `curl` to download **Reddit wikis only** because Reddit blocks `wget`:
```sh
curl -L -A “{userAgent}” –compressed –fail –retry 3 –max-time 30 
-b “over18=1” -o archive/reddit/{subreddit}.html “https://www.reddit.com/r/{subreddit}/wiki/index”
```
- Stores the file in `archive/reddit/{subreddit}.html`.

#### **Skipping 404 Pages**
- Before attempting to archive a page, the action **checks if it exists**:
```sh
curl -o /dev/null -s -w “%{http_code}” {URL}
```
- If the page **returns 404**, it **logs a warning and skips** the archive.

#### **Handling Age-Restricted Content**
- If a Reddit page **requires age confirmation**, `curl` **sends a cookie (`over18=1`)** to bypass restrictions.

---

### **2. Generates a Dynamic README & Interactive Index**
- The action **dynamically generates** the `README.md` and `index.html`, including:
- A description that **adapts to the provided schedule** (e.g., daily, weekly, or monthly updates).
- A **table of archived websites** showing their description and last successful archive date.
- A **GitHub Pages link** for easy online access.
- Instructions for local usage and mirroring.

---

### **3. Maintains Archive Metadata**
- The action stores archive history in `archive/metadata.json`.
- If an archive attempt **fails**, the last successful **archive date** will still be displayed in the README and index.
- This prevents loss of historical data if a website is temporarily unavailable.

---

### **4. Cleans Up After Archiving**
| Cleanup Task | Reason |
|-------------|--------|
| **Removes `robots.txt`** | Prevents future `wget` runs from being blocked. |
| **Deletes temporary files** | Ensures clean and efficient archives. |
```sh
rm -f archive/robots.txt
```
---

### **5. Commits Changes & Pushes to Repository**
- Automatically **commits and pushes** new archives to the repository.
- Supports scheduling for **automatic backups**.

---

### **6. Supports GitHub Pages Deployment**
- The archive can be **viewed online via GitHub Pages** if enabled.

---

## **Repository Structure**
```plaintext
web-archiver-action/
├── action.yml                  # JavaScript action definition
├── package.json                # Node.js project file
├── main.js                     # Main script containing action logic
├── README.md                   # This file
├── LICENSE
└── archive/                    # Folder where website archives are saved
    ├── metadata.json           # Tracks last successful archive date
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
              { "url": "https://example.com/file.pdf", "description": "Sample PDF document" }
            ]
          schedule: "Weekly on Fridays at midnight (UTC)"
          contact_email: "your-email@example.com"  # Optional email contact
          limit_rate: "10m"  # Optional rate limit for downloads (10MB/s)
          user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" # Optional
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