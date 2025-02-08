const core = require('@actions/core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * This function simulates processing an artifact.
 * Replace its logic with your actual processing as needed.
 */
function handleArtifact(url, repository) {
  // Example: Generate simple snippets.
  const readmeSnippet = `Artifact: ${url}`;
  const indexSnippet = `<li><a href="${url}">${url}</a></li>`;
  return { readmeSnippet, indexSnippet };
}

async function run() {
  try {
    // Retrieve inputs
    const artifactsInput = core.getInput('artifacts', { required: true });
    const schedule = core.getInput('schedule') || 'Daily at midnight (UTC)';
    const staticDescription = core.getInput('static_description') || '';
    const githubToken = core.getInput('github_token', { required: true });
    
    // Parse the artifacts JSON
    let artifacts;
    try {
      artifacts = JSON.parse(artifactsInput);
    } catch (error) {
      core.setFailed(`Invalid JSON for artifacts input: ${error.message}`);
      return;
    }
    
    // Create directories (if they don't already exist)
    fs.mkdirSync('archive', { recursive: true });
    fs.mkdirSync('static', { recursive: true });
    
    // Initialize the README and index content
    let readmeContent = "# Archive Report\n\n## Archived Artifacts:\n";
    let indexContent = "<html><head><title>Archive Index</title></head><body><h1>Archived Artifacts</h1><ul>";
    
    // Prepend the static description if provided
    if (staticDescription) {
      readmeContent = staticDescription + "\n\n" + readmeContent;
    }
    
    core.info(`Processing ${artifacts.length} artifacts...`);
    
    // Loop through each artifact
    for (let i = 0; i < artifacts.length; i++) {
      const artifact = artifacts[i];
      const url = artifact.url;
      const description = artifact.description || "";
      
      core.info(`Processing artifact: ${url}`);
      
      // Call the artifact processing function (replacing your external script)
      const { readmeSnippet, indexSnippet } = handleArtifact(url, process.env.GITHUB_REPOSITORY);
      
      // Append the artifact description if provided
      let snippet = readmeSnippet;
      if (description) {
        snippet += " - " + description;
      }
      
      // Append the current date
      const currentDate = new Date().toISOString().replace('T', ' ').split('.')[0];
      snippet += " - Last archived on: " + currentDate + "\n";
      
      readmeContent += snippet;
      indexContent += indexSnippet;
    }
    
    // Close the index HTML content
    indexContent += "</ul></body></html>";
    
    // Append schedule information and additional links to README
    readmeContent += "\n## Schedule\n" + schedule;
    
    const githubRepo = process.env.GITHUB_REPOSITORY || '';
    const githubRef = process.env.GITHUB_REF || 'refs/heads/main';
    const branch = githubRef.replace('refs/heads/', '');
    const zipUrl = `https://github.com/${githubRepo}/archive/refs/heads/${branch}.zip`;
    readmeContent += `\n\n[Download ZIP of Repository](${zipUrl})`;
    
    const [owner, repo] = githubRepo.split('/');
    const pagesUrl = `https://${owner}.github.io/${repo}/`;
    readmeContent += `\n\n[View Published GitHub Pages Site](${pagesUrl})`;
    
    // Write the generated files
    fs.writeFileSync('README.md', readmeContent);
    fs.writeFileSync('index.html', indexContent);
    fs.writeFileSync(path.join('static', 'example.txt'), "This is a static file.");
    
    // Configure and run git commands to commit and push changes
    try {
      // Set git user configuration
      execSync(`git config user.name "github-actions[bot]"`);
      execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`);
      
      // Stage all changes
      execSync(`git add .`, { stdio: 'inherit' });
      
      // Attempt to commit (this may throw if there are no changes)
      try {
        execSync(`git commit -m "Update archived artifacts [skip ci]"`, { stdio: 'inherit' });
      } catch (commitError) {
        core.info("No changes to commit.");
      }
      
      // Update remote URL to include the GitHub token so that push works
      if (githubRepo && githubToken) {
        const remoteUrl = `https://${githubToken}@github.com/${githubRepo}.git`;
        execSync(`git remote set-url origin ${remoteUrl}`, { stdio: 'inherit' });
      }
      
      // Push the commit
      execSync(`git push`, { stdio: 'inherit' });
    } catch (gitError) {
      core.setFailed(`Git operations failed: ${gitError.message}`);
    }
    
    core.info("Action completed successfully.");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();