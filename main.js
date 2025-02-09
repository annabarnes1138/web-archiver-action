const core = require('@actions/core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARCHIVE_DIR = 'archive';
const METADATA_PATH = path.join(ARCHIVE_DIR, 'metadata.json');

/**
 * Loads or initializes the archive metadata JSON file.
 */
function loadArchiveMetadata() {
  if (fs.existsSync(METADATA_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
    } catch (error) {
      core.warning("Error reading metadata.json, initializing a new one.");
    }
  }
  return {}; // Return an empty object if no metadata exists
}

/**
 * Saves the archive metadata JSON file.
 */
function saveArchiveMetadata(metadata) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
}

/**
 * Downloads and archives a website using wget with optimized settings.
 */
function archiveWebsite(url, archiveDir, limitRate, userAgent) {
  core.info(`Archiving website: ${url}`);

  try {
    // Normalize subreddit wiki links (e.g., "r/AskReddit" → "https://old.reddit.com/r/AskReddit/wiki")
    if (url.startsWith("r/")) {
      url = `https://old.reddit.com/${url}/wiki`;
      core.info(`Converted subreddit URL to wiki: ${url}`);
    }

    const rateLimitOption = limitRate ? `--limit-rate=${limitRate}` : "";
    const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
    const finalUserAgent = userAgent || defaultUserAgent;

    core.info(`Executing wget command with detailed logging...`);

    execSync(`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent \
      -e robots=off --random-wait --user-agent="${finalUserAgent}" --no-check-certificate --verbose \
      ${rateLimitOption} -P ${archiveDir} ${url}`, {
      stdio: 'inherit', // This ensures all logs are displayed in the GitHub Actions console
    });

    // Determine if the URL points to a specific file or a directory
    const urlObj = new URL(url);
    const fileName = path.basename(urlObj.pathname);

    if (fileName && fileName.includes(".")) {
      return `${archiveDir}/${urlObj.hostname}${urlObj.pathname}`;
    } else {
      return `${archiveDir}/${urlObj.hostname}/index.html`;
    }
  } catch (error) {
    core.warning(`Failed to archive ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Initializes required directories and loads metadata.
 */
function initializeDirectories() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  return loadArchiveMetadata();
}

/**
 * Processes the list of artifacts to archive them.
 */
function processArtifacts(artifacts, metadata, limitRate, userAgent) {
  let updatedMetadata = { ...metadata };

  core.info(`Processing ${artifacts.length} artifacts...`);

  for (const artifact of artifacts) {
    const url = artifact.url;
    const description = artifact.description || "No description provided";
    core.info(`Processing artifact: ${url}`);

    let archivedPath = archiveWebsite(url, ARCHIVE_DIR, limitRate, userAgent);
    let archiveDate = new Date().toISOString().split("T")[0];

    if (!archivedPath) {
      if (metadata[url]) {
        archiveDate = metadata[url].lastArchived;
        archivedPath = metadata[url].archivedPath;
        core.warning(`Using last successful archive from ${archiveDate} for ${url}`);
      } else {
        core.warning(`No previous archive available for ${url}, skipping.`);
        continue;
      }
    }

    updatedMetadata[url] = { lastArchived: archiveDate, archivedPath: archivedPath.replace(/^.*?archive\//, "archive/"), description };
  }

  return updatedMetadata;
}

/**
 * Generates a dynamic schedule description.
 */
function generateScheduleDescription(schedule) {
  if (schedule.toLowerCase().includes("daily")) {
    return "This archive is automatically updated every day.";
  } else if (schedule.toLowerCase().includes("weekly")) {
    return "This archive is automatically updated on a weekly basis.";
  } else if (schedule.toLowerCase().includes("monthly")) {
    return "This archive is automatically updated once a month.";
  } else {
    return `This archive is updated according to the following schedule: <strong>${schedule}</strong>.`;
  }
}

/**
 * Generates the README.md content.
 */
function generateReadmeContent(metadata, schedule, contactEmail) {
  const scheduleDescription = generateScheduleDescription(schedule);
  const repoOwner = process.env.GITHUB_REPOSITORY.split('/')[0];
  const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
  const githubPagesUrl = `https://${repoOwner}.github.io/${repoName}/`;
  const zipDownloadUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/main.zip`;
  const githubIssuesUrl = `https://github.com/${repoOwner}/${repoName}/issues`;

  return `# What is this?
This is an archive of various websites that are periodically saved to preserve their content. ${scheduleDescription}

## Accessing this archive
### Online, no download required.
[View the archive](${githubPagesUrl})

### Locally
[Download ZIP](${zipDownloadUrl}) and extract the contents. Open \`index.html\` in your browser to navigate the archive.

## List of Archived Websites
| Website | Description | Last Successful Archive |
|---------|------------|-------------------------|
${Object.entries(metadata)
  .map(([url, data]) => `| [${url}](${data.archivedPath.replace(ARCHIVE_DIR + '/', '')}) | ${data.description} | ${data.lastArchived} |`)
  .join("\n")}

## Mirroring
I encourage you to start your own mirror, and open an issue or pull request if you would like it added to the readme.

## Contact Me
If you have questions or suggestions, please open an issue on [GitHub](${githubIssuesUrl}).${contactEmail ? ` Or you can [send me an email](mailto:${contactEmail}).` : ""}
`;
}

/**
 * Generates the index.html content.
 */
function generateIndexContent(metadata, schedule, contactEmail) {
  const scheduleDescription = generateScheduleDescription(schedule);
  const repoOwner = process.env.GITHUB_REPOSITORY.split('/')[0];
  const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
  const githubPagesUrl = `https://${repoOwner}.github.io/${repoName}/`;
  const zipDownloadUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/main.zip`;
  const githubIssuesUrl = `https://github.com/${repoOwner}/${repoName}/issues`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Archived Websites</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
            max-width: 800px;
        }
        h1, h2 {
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f4f4f4;
        }
        a {
            color: #007bff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>

    <h1>What is this?</h1>
    <p>This is an archive of various websites that are periodically saved to preserve their content. ${scheduleDescription}</p>

    <h2>Accessing this archive</h2>
    <p><strong>Online, no download required:</strong> <a href="${githubPagesUrl}">${githubPagesUrl}</a></p>
    <p><strong>Locally:</strong> <a href="${zipDownloadUrl}">Download ZIP</a> and extract the contents.</p>

    <h2>List of Archived Websites</h2>
    <table>
        <tr>
            <th>Website</th>
            <th>Description</th>
            <th>Last Successful Archive</th>
        </tr>
        ${Object.entries(metadata)
          .map(
            ([url, data]) =>
              `<tr><td><a href="${data.archivedPath.replace(ARCHIVE_DIR + '/', '')}">${url}</a></td><td>${data.description}</td><td>${data.lastArchived}</td></tr>`
          )
          .join("\n")}
    </table>

    <h2>Mirroring</h2>
    <p>I encourage you to start your own mirror, and open an issue if you need help.</p>

    <h2>Contact Me</h2>
    <p>If you have questions, open an issue on <a href="${githubIssuesUrl}">GitHub</a>.${contactEmail ? ` Or you can <a href="mailto:${contactEmail}">send me an email</a>.` : ""}</p>

</body>
</html>`;
}

/**
 * Writes README.md, index.html, and metadata.json.
 */
function writeOutputFiles(metadata, schedule, contactEmail) {
  fs.writeFileSync("README.md", generateReadmeContent(metadata, schedule, contactEmail));
  fs.writeFileSync("index.html", generateIndexContent(metadata, schedule, contactEmail));
  saveArchiveMetadata(metadata);
}

/**
 * Main function that executes the archiving process.
 */
async function run() {
  const artifacts = JSON.parse(core.getInput('artifacts', { required: true }));
  const schedule = core.getInput('schedule') || 'Weekly updates';
  const contactEmail = core.getInput('contact_email') || '';
  const limitRate = core.getInput('limit_rate') || '';
  const userAgent = core.getInput('user_agent') || '';

  let metadata = initializeDirectories();
  metadata = processArtifacts(artifacts, metadata, limitRate, userAgent);
  writeOutputFiles(metadata, schedule, contactEmail);

  core.info("Action completed successfully.");
}

run();