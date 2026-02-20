// Handles Firebase File Storage: upload to storage, download as buffer, remove from storage, signed URL generation, and listing all files for an application
// Wrapper functions for Firebase Cloud Storage operations.
//
// File organization structure:
// applications/{applicationId}/{timestamp}_{filename}
//
// Supported operations:
// - Upload files (PDFs, Excel) with automatic content type detection
// - Download files as buffers
// - Generate signed URLs for temporary access
// - Delete files
// - List all files for an application
const { storage } = require('./firebase');
let uuidv4; // UUID generator for file access tokens

// Load uuid dynamically
(async () => {
  const uuid = await import('uuid');
  uuidv4 = uuid.v4;
})();

/**
 * Upload file to Firebase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} filename - Original filename
 * @param {String} applicationId - Application ID for folder structure
 * @returns {Promise<Object>} Upload result with path and URL
 */
async function uploadToStorage(fileBuffer, filename, applicationId) {
  try {
    // Generate unique storage path with timestamp
    const timestamp = Date.now();
    const storagePath = `applications/${applicationId}/${timestamp}_${filename}`;
    
    // Get reference to file in storage bucket
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
 * Get file from Firebase Storage
 * @param {String} storagePath - Storage path
 * @returns {Promise<Buffer>} File buffer
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
 * Generate signed URL for temporary access (valid for 7 days)
 * @param {String} storagePath - Storage path
 * @param {Number} expiresInDays - Expiration in days (default 7)
 * @returns {Promise<String>} Signed URL
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
 * Delete file from Firebase Storage
 * @param {String} storagePath - Storage path
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
 * List all files for an application
 * @param {String} applicationId - Application ID
 * @returns {Promise<Array>} List of files
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
  getFromStorage,
  getSignedUrl,
  deleteFromStorage,
  listFiles
};