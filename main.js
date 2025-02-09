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
    // Normalize subreddit wiki links (e.g., "r/AskReddit" → "https://www.reddit.com/r/AskReddit/wiki/index")
    if (url.startsWith("r/")) {
      url = `https://www.reddit.com/${url}/wiki/index`;
      core.info(`Converted subreddit URL to wiki: ${url}`);
    }

    const rateLimitOption = limitRate ? `--limit-rate=${limitRate}` : "";
    const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
    const finalUserAgent = userAgent || defaultUserAgent;

    execSync(`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent \
      -e robots=off --random-wait --user-agent="${finalUserAgent}" --no-check-certificate \
      ${rateLimitOption} -P ${archiveDir} ${url}`, {
      stdio: 'inherit',
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