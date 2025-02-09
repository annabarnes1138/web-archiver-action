const core = require('@actions/core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARCHIVE_DIR = 'archive';
const METADATA_PATH = path.join(ARCHIVE_DIR, 'metadata.json');

/**
 * Runs a shell command and returns its output.
 */
function runCommand(command) {
  try {
    return execSync(command, { stdio: 'pipe' }).toString().trim();
  } catch (error) {
    return null; // Return null if the command fails
  }
}

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
 * Normalizes URLs for specific formats (e.g., subreddit wikis).
 */
function normalizeUrl(url) {
  if (url.startsWith("r/")) {
    const subredditUrl = `https://www.reddit.com/${url}/wiki/index`;
    core.info(`Converted subreddit URL to wiki: ${subredditUrl}`);
    return { url: subredditUrl, useCurl: true };
  }
  return { url, useCurl: false };
}

/**
 * Checks if a URL is accessible (not returning 404).
 */
function checkUrlStatus(url) {
  const { url: normalizedUrl } = normalizeUrl(url); // Ensure URL is fully qualified
  const status = runCommand(`curl -o /dev/null -s -w "%{http_code}" "${normalizedUrl}"`);
  
  if (!status) {
    core.setFailed(`Critical error: Could not access ${url} (Invalid URL or unreachable)`);
    throw new Error(`Failed to access ${url}`);
  }

  if (status === "404") {
    const timestamp = new Date().toISOString();
    core.warning(`[${timestamp}] Skipping ${url} (404 Not Found) during validation.`);
    return "404"; // Log but continue
  }

  if (status.startsWith("5")) {
    core.setFailed(`Critical error: Could not access ${url} (HTTP ${status})`);
    throw new Error(`Failed to access ${url}`);
  }

  return status;
}

/**
 * Archives subreddit wikis using curl.
 */
function archiveWithCurl(url, archiveDir, userAgent) {
  core.info(`📂 Using curl to archive: ${url}`);

  try {
    const subreddit = url.match(/r\/([^/]+)/)[1]; // Extract subreddit name
    const outputDir = `${archiveDir}/reddit`;
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = `${outputDir}/${subreddit}.html`;

    execSync(`curl -L -A "${userAgent}" --compressed --fail --retry 3 --max-time 30 \
      -b "over18=1" -o "${outputPath}" "${url}"`, {
      stdio: 'inherit',
    });

    return outputPath;
  } catch (error) {
    core.error(`❌ Critical failure while archiving Reddit wiki: ${url}, Error: ${error.message}`);

    // Store failure in metadata for tracking
    saveArchiveMetadata({ 
      ...loadArchiveMetadata(), 
      [url]: { lastArchived: "FAILED", archivedPath: null, description: "Archive failed." } 
    });

    return null;
  }
}

/**
 * Archives websites using wget.
 */
function archiveWithWget(url, archiveDir, limitRate, userAgent) {
  core.info(`📂 Using wget to archive: ${url}`);

  try {
    const rateLimitOption = limitRate ? `--limit-rate=${limitRate}` : "";

    execSync(`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent \
      -e robots=off --random-wait --user-agent="${userAgent}" --no-check-certificate \
      ${rateLimitOption} -P ${archiveDir} ${url}`, { stdio: 'inherit' });

    const urlObj = new URL(url);
    const fileName = path.basename(urlObj.pathname);
    const outputPath = fileName && fileName.includes(".")
      ? `${archiveDir}/${urlObj.hostname}${urlObj.pathname}`
      : `${archiveDir}/${urlObj.hostname}/index.html`;

    // Remove .orig files generated by wget
    execSync(`find ${archiveDir} -name "*.orig" -type f -delete`);
    
    return outputPath;
  } catch (error) {
    core.error(`❌ Critical failure while archiving ${url}: ${error.message}`);

    // Store failure in metadata for tracking
    saveArchiveMetadata({ 
      ...loadArchiveMetadata(), 
      [url]: { lastArchived: "FAILED", archivedPath: null, description: "Archive failed." } 
    });

    return null;
  }
}

/**
 * Generates the schedule description.
 */
function generateScheduleDescription(schedule) {
  return schedule ? `This archive is updated on the following schedule: **${schedule}**.` : "";
}

/**
 * Generates the README.md content.
 */
function generateReadmeContent(metadata, schedule, contactEmail) {
  const scheduleDescription = generateScheduleDescription(schedule);
  const repoOwner = process.env.GITHUB_REPOSITORY?.split('/')[0] || "your-github-username";
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || "your-repo";
  const githubPagesUrl = `https://${repoOwner}.github.io/${repoName}/`;
  const zipDownloadUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/main.zip`;
  const githubIssuesUrl = `https://github.com/${repoOwner}/${repoName}/issues`;

  let tableRows = Object.entries(metadata)
    .map(([url, data]) => `| [${url}](${data.archivedPath}) | ${data.description} | ${data.lastArchived} |`)
    .join("\n");

  return `# Web Archive

This repository contains archived copies of various websites. ${scheduleDescription}

## **Accessing the Archive**
### Online, no download required
[View the archive](${githubPagesUrl})

### Locally
[Download ZIP](${zipDownloadUrl}) and extract the contents. Open \`index.html\` in your browser to navigate the archive.

## **Archived Websites**
| Website | Description | Last Successful Archive |
|---------|------------|-------------------------|
${tableRows}

## **Mirroring**
If you'd like to create a mirror of this archive, simply fork this repository or download the archive.

## **Contact**
If you have any questions, feel free to open an issue on [GitHub](${githubIssuesUrl}).${contactEmail ? ` Or you can [send an email](mailto:${contactEmail}).` : ""}
  `;
}

/**
 * Generates the index.html content.
 */
function generateIndexContent(metadata, schedule, contactEmail) {
  const scheduleDescription = generateScheduleDescription(schedule);
  const repoOwner = process.env.GITHUB_REPOSITORY?.split('/')[0] || "your-github-username";
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || "your-repo";
  const githubPagesUrl = `https://${repoOwner}.github.io/${repoName}/`;
  const zipDownloadUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/main.zip`;
  const githubIssuesUrl = `https://github.com/${repoOwner}/${repoName}/issues`;

  let tableRows = Object.entries(metadata)
    .map(([url, data]) => `<tr><td><a href="${data.archivedPath}">${url}</a></td><td>${data.description}</td><td>${data.lastArchived}</td></tr>`)
    .join("\n");

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

    <h1>Archived Websites</h1>
    <p>${scheduleDescription}</p>

    <h2>Accessing the Archive</h2>
    <p><strong>Online, no download required:</strong> <a href="${githubPagesUrl}">${githubPagesUrl}</a></p>
    <p><strong>Locally:</strong> <a href="${zipDownloadUrl}">Download ZIP</a> and extract the contents.</p>

    <h2>List of Archived Websites</h2>
    <table>
        <tr>
            <th>Website</th>
            <th>Description</th>
            <th>Last Successful Archive</th>
        </tr>
        ${tableRows}
    </table>

    <h2>Contact</h2>
    <p>If you have questions, open an issue on <a href="${githubIssuesUrl}">GitHub</a>.${contactEmail ? ` Or you can <a href="mailto:${contactEmail}">send an email</a>.` : ""}</p>

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
 * Archives a website using either wget or curl.
 */
function archiveWebsite(url, archiveDir, limitRate, userAgent) {
  core.info(`Checking status for: ${url}`);
  
  const status = checkUrlStatus(url);
  if (status === "404") return null; // Ignore 404 errors but continue

  const { url: normalizedUrl, useCurl } = normalizeUrl(url);
  const finalUserAgent = userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";

  return useCurl
    ? archiveWithCurl(normalizedUrl, archiveDir, finalUserAgent)
    : archiveWithWget(normalizedUrl, archiveDir, limitRate, finalUserAgent);
}

/**
 * Ensures required directories exist and loads metadata.
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

    core.info(`✅ Successfully archived: ${url} → ${archivedPath}`);

    updatedMetadata[url] = { 
      lastArchived: archiveDate, 
      archivedPath: archivedPath.replace(/^.*?archive\//, "archive/"), 
      description 
    };
  }

  return updatedMetadata;
}

/**
 * Main function that executes the archiving process.
 */
async function run() {
  try {
    const artifacts = JSON.parse(core.getInput('artifacts', { required: true }));
    const schedule = core.getInput('schedule') || 'Weekly updates';
    const contactEmail = core.getInput('contact_email') || '';
    const limitRate = core.getInput('limit_rate') || '';
    const userAgent = core.getInput('user_agent') || '';

    // Ensure directories exist and load metadata
    let metadata = initializeDirectories();

    // Step 1: Validate all URLs before archiving (Fail Fast)
    core.info("🔍 Validating URLs before archiving...");
    let invalidUrls = [];

    for (const artifact of artifacts) {
      const url = artifact.url;
      const status = checkUrlStatus(url);

      if (!status || status.startsWith("5") || status === "null") {
        core.error(`❌ Invalid URL: ${url} (HTTP ${status})`);
        invalidUrls.push(url);
      }
    }

    if (invalidUrls.length > 0) {
      core.setFailed(`🚨 The following URLs are invalid and cannot be archived:\n${invalidUrls.join("\n")}`);
      return;
    }

    core.info("✅ All URLs are valid. Proceeding with archiving...");

    // Step 2: Process artifacts and update metadata
    metadata = processArtifacts(artifacts, metadata, limitRate, userAgent);

    // Step 3: Write updated files (README.md, index.html, metadata.json)
    writeOutputFiles(metadata, schedule, contactEmail);

    core.info("🎉 Archive process completed successfully.");
  } catch (error) {
    core.setFailed(`🚨 Action failed with error: ${error.message}`);
  }
}

run();