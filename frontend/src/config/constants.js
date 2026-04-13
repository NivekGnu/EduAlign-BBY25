/**
 * @fileoverview Constants for frontend
 * 
 * Core configuration constants for the frontend application.
 * 
 * IMPORTANT: Keep in sync with backend/config/worksafebc.js
 */

/**
 * Maximum file size in megabytes for PDF uploads
 */
export const MAX_FILE_SIZE_MB = 10;

/**
 * Maximum number of curriculum PDF files allowed per application.
 */
export const MAX_CURRICULUM_FILES = 10;

/**
 * Required number of application package files.
 * Must be exactly 3 files: Provider Application Form, Course Outline, Administrative Documentation.
 */
export const REQUIRED_PKG_FILES = 3;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";