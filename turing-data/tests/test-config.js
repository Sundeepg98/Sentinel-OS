/**
 * Shared test configuration for dynamic path resolution
 * This file provides cross-platform paths for test files
 */
const path = require('path');

// Project root directory (one level up from tests/)
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Convert to file:// URL format (works on both Windows and Unix)
function toFileUrl(filePath) {
  // Normalize path separators and handle Windows drive letters
  const normalizedPath = filePath.replace(/\\/g, '/');
  // On Windows, paths start with drive letter (e.g., D:/...)
  // On Unix, paths start with /
  if (/^[a-zA-Z]:/.test(normalizedPath)) {
    return `file:///${normalizedPath}`;
  }
  return `file://${normalizedPath}`;
}

// Main HTML file path
const HTML_FILE = path.join(PROJECT_ROOT, 'index.html');
const HTML_PATH = toFileUrl(HTML_FILE);

// Content directory (markdown files)
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content');

// Test utilities directory
const UTILS_DIR = path.join(__dirname, 'utils');

module.exports = {
  PROJECT_ROOT,
  HTML_FILE,
  HTML_PATH,
  CONTENT_DIR,
  UTILS_DIR,
  toFileUrl
};
