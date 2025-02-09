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
 * Downloads and archives a website using wget with its default folder structure.
 */
function archiveWebsite(url) {
  core.info(`Archiving website: ${url}`);

  try {
    execSync(`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent -P ${ARCHIVE_DIR} ${url}`, {
      stdio: 'inherit',
    });

    return `${ARCHIVE_DIR}/${new URL(url).hostname}/index.html`; // Expected location of index.html
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
function processArtifacts(artifacts, metadata) {
  let readmeContent = "# Archive Report\n\n## Archived Artifacts:\n";
  let indexContent = "<html><head><title>Archive Index</title></head><body><h1>Archived Artifacts</h1><ul>";

  core.info(`Processing ${artifacts.length} artifacts...`);

  for (const artifact of artifacts) {
    const url = artifact.url;
    const description = artifact.description || "";
    core.info(`Processing artifact: ${url}`);

    let archivedPath = archiveWebsite(url);
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

    metadata[url] = { lastArchived: archiveDate, archivedPath: archivedPath.replace(/^.*?archive\//, "archive/") };

    const relativeArchivePath = archivedPath.replace(/^.*?archive\//, "archive/");
    readmeContent += `- [${url}](${relativeArchivePath}) ${description ? "- " + description : ""} - Last archived on: ${archiveDate}\n`;
    indexContent += `<li><a href="${relativeArchivePath}">${url}</a> (Last archived: ${archiveDate})</li>`;
  }

  indexContent += "</ul></body></html>";

  return { readmeContent, indexContent, metadata };
}

/**
 * Writes README.md, index.html, and metadata.json.
 */
function writeOutputFiles(readmeContent, indexContent, metadata, schedule, contactEmail) {
  // Determine how to phrase the schedule dynamically
  let scheduleDescription;
  if (schedule.toLowerCase().includes("daily")) {
    scheduleDescription = "This archive is automatically updated every day.";
  } else if (schedule.toLowerCase().includes("weekly")) {
    scheduleDescription = "This archive is automatically updated on a weekly basis.";
  } else if (schedule.toLowerCase().includes("monthly")) {
    scheduleDescription = "This archive is automatically updated once a month.";
  } else {
    scheduleDescription = `This archive is updated according to the following schedule: **${schedule}**.`;
  }

  // General description of the archive
  readmeContent = `# What is this?
This is an archive of various websites that are periodically saved to preserve their content. ${scheduleDescription}

## Accessing this archive
### Online, no download required.
[View the archive](https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io/${process.env.GITHUB_REPOSITORY.split('/')[1]}/)

### Locally
[Download ZIP](https://github.com/${process.env.GITHUB_REPOSITORY}/archive/refs/heads/main.zip) and extract the contents. Open \`index.html\` in your browser to navigate the archive.

## List of Archived Websites
| Website | Last Successful Archive |
|---------|-------------------------|
`;

  // Add each archived site to the table
  for (const [url, data] of Object.entries(metadata)) {
    readmeContent += `| [${url}](${data.archivedPath}) | ${data.lastArchived} |\n`;
  }

  // Add mirroring instructions
  readmeContent += `
## Mirroring
I encourage you to start your own mirror, and open an issue or pull request if you would like it added to the readme. If you decide to create a public mirror, it should be automatically updated by simply running \`git pull\` at least once a week (you can do this with a [simple cron job](https://stackoverflow.com/a/69553820)). Feel free to open an issue if you need any help.

This project is currently hosted on GitHub and may be mirrored elsewhere in the future.

## Contact Me
If you have questions or suggestions, please open an issue on [GitHub](https://github.com/${process.env.GITHUB_REPOSITORY}/issues).`;

  // Append email contact if provided
  if (contactEmail) {
    readmeContent += ` Or you can [send me an email](mailto:${contactEmail}).`;
  }

  // Write the files
  fs.writeFileSync('README.md', readmeContent);
  fs.writeFileSync('index.html', indexContent);
  saveArchiveMetadata(metadata);
}

/**
 * Commits and pushes changes to the repository.
 */
function commitAndPushChanges(githubToken) {
  try {
    execSync(`git config user.name "github-actions[bot]"`);
    execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`);
    execSync(`git add .`, { stdio: 'inherit' });

    try {
      execSync(`git commit -m "Update archived artifacts [skip ci]"`, { stdio: 'inherit' });
    } catch (commitError) {
      core.info("No changes to commit.");
    }

    if (process.env.GITHUB_REPOSITORY && githubToken) {
      const remoteUrl = `https://${githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
      execSync(`git remote set-url origin ${remoteUrl}`, { stdio: 'inherit' });
    }

    execSync(`git push`, { stdio: 'inherit' });
  } catch (gitError) {
    core.setFailed(`Git operations failed: ${gitError.message}`);
  }
}

/**
 * Main function to run the archiving process.
 */
async function run() {
  try {
    const artifactsInput = core.getInput('artifacts', { required: true });
    const schedule = core.getInput('schedule') || 'Weekly updates';
    const githubToken = core.getInput('github_token', { required: true });
    const contactEmail = core.getInput('contact_email') || '';

    let artifacts;
    try {
      artifacts = JSON.parse(artifactsInput);
    } catch (error) {
      core.setFailed(`Invalid JSON for artifacts input: ${error.message}`);
      return;
    }

    let metadata = initializeDirectories();
    const { readmeContent, indexContent, metadata: updatedMetadata } = processArtifacts(artifacts, metadata);
    writeOutputFiles(readmeContent, indexContent, updatedMetadata, schedule, contactEmail);
    commitAndPushChanges(githubToken);

    core.info("Action completed successfully.");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();