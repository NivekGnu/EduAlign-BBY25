/**
 * @fileoverview Firebase Storage Wrapper
 * 
 * Provides wrapper functions for Firebase Cloud Storage operations:
 * - Upload files (PDFs, Excel) with automatic content type detection
 * - Download files as buffers
 * - Generate signed URLs for temporary access (default 7 days, configurable)
 * - Delete files
 * - List all files for an application
 * 
 * File organization structure:
 * applications/{applicationId}/{timestamp}_{filename}
 */

const { storage } = require('./firebase');
let uuidv4; // UUID generator for file access tokens

// Load uuid dynamically
(async () => {
  const uuid = await import('uuid');
  uuidv4 = uuid.v4;
})();

/**
 * Upload single file to Firebase Storage.
 * Auto-detects content type based on file extension (.pdf or .xlsx).
 * 
 * @param {Buffer} fileBuffer - File contents as buffer
 * @param {string} filename - Original filename
 * @param {string} applicationId - Application ID for folder structure
 * @returns {Promise<{storagePath: string, publicUrl: string, filename: string}>} Upload result
 * @throws {Error} Firebase Storage upload failure
 */
async function uploadToStorage(fileBuffer, filename, applicationId) {
  try {
    // Generate unique storage path with timestamp
    const timestamp = Date.now();
    const storagePath = `applications/${applicationId}/${timestamp}_${filename}`;
    const file = storage.file(storagePath);
    
    // Determine content type based on file extension
    const contentType = filename.toLowerCase().endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : filename.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/octet-stream';
    
    console.log(`Uploading to Firebase Storage: ${storagePath}`);
    
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: (await import('uuid')).v4(), // For public access
        uploadedAt: new Date().toISOString()
      }
    });
    
    // Make file publicly accessible
    try {
      await file.makePublic();
      console.log(`File made public successfully`);
    } catch (publicError) {
      console.warn(`Could not make file public:`, publicError.message);
      // Continue anyway - signed URLs will still work
    }
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${storage.name}/${storagePath}`;
  
    console.log(`Upload successful: ${storagePath}`);
    
    return {
      storagePath,
      publicUrl,
      filename
    };
  } catch (error) {
    console.error('Firebase Storage upload error:', error);
    throw new Error(`Failed to upload file to Firebase Storage: ${error.message}`);
  }
}

/**
 * Upload multiple files to Firebase Storage concurrently.
 * Faster than sequential uploads via Promise.all().
 * 
 * @param {Array<Buffer>} fileBuffers - Array of file buffers
 * @param {Array<string>} filenames - Array of original filenames
 * @param {string} applicationId - Application ID for folder structure
 * @returns {Promise<Array<{storagePath: string, publicUrl: string, filename: string}>>} Array of upload results
 * @throws {Error} Firebase Storage upload failure for any file
 */
async function uploadMultipleToStorage(fileBuffers, filenames, applicationId) {
  try {
    console.log(`Uploading ${fileBuffers.length} files to Firebase Storage...`);
    
    const uploadPromises = fileBuffers.map((buffer, index) => {
      return uploadToStorage(buffer, filenames[index], applicationId);
    });
    
    const results = await Promise.all(uploadPromises);
    
    console.log(`All ${results.length} files uploaded successfully`);
    
    return results;
  } catch (error) {
    console.error('Multiple file upload error:', error);
    throw new Error(`Failed to upload multiple files: ${error.message}`);
  }
}

/**
 * Download file from Firebase Storage.
 * 
 * @param {string} storagePath - Full storage path (e.g., "applications/APP123/file.pdf")
 * @returns {Promise<Buffer>} File contents as buffer
 * @throws {Error} Firebase Storage download failure or file not found
 */
async function getFromStorage(storagePath) {
  try {
    const file = storage.file(storagePath);
    
    console.log(`Downloading from Firebase Storage: ${storagePath}`);
    
    const [buffer] = await file.download();
    
    return buffer;
  } catch (error) {
    console.error('Firebase Storage download error:', error);
    throw new Error(`Failed to download file from Firebase Storage: ${error.message}`);
  }
}

/**
 * Generate signed URL for temporary file access.
 * URLs expire after specified days and must be regenerated.
 * 
 * @param {string} storagePath - Full storage path
 * @param {number} [expiresInDays=7] - Expiration in days (default 7)
 * @returns {Promise<string>} Signed URL valid for specified duration
 * @throws {Error} Signed URL generation failure
 */
async function getSignedUrl(storagePath, expiresInDays = 7) {
  try {
    const file = storage.file(storagePath);
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    });
    
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Delete file from Firebase Storage.
 * 
 * @param {string} storagePath - Full storage path
 * @returns {Promise<void>}
 * @throws {Error} Firebase Storage deletion failure
 */
async function deleteFromStorage(storagePath) {
  try {
    const file = storage.file(storagePath);
    await file.delete();
    console.log(`Deleted from Firebase Storage: ${storagePath}`);
  } catch (error) {
    console.error('Firebase Storage delete error:', error);
    throw new Error(`Failed to delete file from Firebase Storage: ${error.message}`);
  }
}

/**
 * List all files for an application.
 * 
 * @param {string} applicationId - Application ID
 * @returns {Promise<Array<{path: string, name: string, size: number, contentType: string, created: string}>>} File list with metadata
 * @throws {Error} Firebase Storage list operation failure
 */
async function listFiles(applicationId) {
  try {
    const [files] = await storage.getFiles({
      prefix: `applications/${applicationId}/`
    });
    
    return files.map(file => ({
      path: file.name,
      name: file.metadata.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      created: file.metadata.timeCreated
    }));
  } catch (error) {
    console.error('Firebase Storage list error:', error);
    throw new Error(`Failed to list files from Firebase Storage: ${error.message}`);
  }
}

module.exports = {
  uploadToStorage,
  uploadMultipleToStorage,
  getFromStorage,
  getSignedUrl,
  deleteFromStorage,
  listFiles
};