/**
 * @fileoverview Constants for backend
 * 
 * Core configuration constants for the backend application.
 * 
 * IMPORTANT: Keep in sync with frontend/src/config/constants.js
 */

/**
 * Maximum file size in megabytes for PDF uploads
 */
const MAX_FILE_SIZE_MB = 10;

/**
 * Maximum characters of curriculum text to send to AI
 */
const MAX_INPUT_CHARACTERS = 50000;

/**
 * Maximum tokens for AI response
 */
const MAX_RESPONSE_TOKENS = 5000;

/**
 * Maximum number of curriculum PDF files allowed per application.
 */
const MAX_CURRICULUM_FILES = 10;

/**
 * Required number of application package files.
 * Must be exactly 3 files: Provider Application Form, Course Outline, Administrative Document
 */
const APPLICATION_PACKAGE_FILES = 3;

module.exports = {
  MAX_FILE_SIZE_MB,
  MAX_INPUT_CHARACTERS,
  MAX_RESPONSE_TOKENS,
  MAX_CURRICULUM_FILES,
  APPLICATION_PACKAGE_FILES
};