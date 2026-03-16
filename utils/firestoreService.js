// Handles Firestore: CRUD for database (NoSQL)

const { db, FieldValue } = require('./firebase');

/**
 * Generate application ID from date and Firestore doc ID
 */
function generateApplicationId(docId, createdAt) {
  const date = createdAt.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const shortId = docId.slice(-4).toUpperCase();
  return `APP${year}${month}${day}${shortId}`;
}

/**
 * Create new application record in Firestore with versions structure
 * 
 * Process:
 * 1. Add document to 'applications' collection with data
 * 2. Auto-generate createdAt and updatedAt timestamps
 * 3. Retrieve created document to get its ID
 * 4. Generate human-readable applicationId
 * 5. Update document with applicationId
 * 6. Return complete application object
 * 
 * @param {Object} data - Initial application data
 * @param {String} data.providerName - Name of person submitting
 * @param {String} data.organizationName - Training organization name
 * @param {String} data.email - Contact email
 * @param {String} data.status - Initial status (typically "Unreviewed")
 * @param {Date} data.submittedDate - Submission date
 * @param {Array} data.pdfFiles - PDF file metadata for version 1
 * @param {Object} data.excelFile - Excel file metadata for version 1
 * @param {Array} [data.mappings=[]] - Competency mappings for version 1
 * @param {Array} [data.missingCriteria=[]] - Missing competencies for version 1
 * 
 * @returns {Promise<Object>} Created application with generated IDs
 * 
 * @throws {Error} If Firestore operation fails
 */
async function createApplication(data) {
  try {
    // Build version 1 object
    const version1 = {
      version: 1,
      analyzedAt: new Date(),
      pdfFiles: data.pdfFiles || [], 
      packageFiles: data.packageFiles || [],
      excelFile: data.excelFile || null,
      missingCriteria: data.missingCriteria || [],
      mappings: data.mappings || []
    };

    const docRef = await db.collection('applications').add({
      userId: data.userId || null,
      providerName: data.providerName,
      organizationName: data.organizationName,
      email: data.email,
      status: data.status || 'Unreviewed',
      submittedDate: data.submittedDate,
      currentVersion: 1,
      versions: [version1],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Get the created document to generate application ID
    const doc = await docRef.get();
    const docData = doc.data();
    
    const applicationId = generateApplicationId(doc.id, docData.createdAt);
    
    // Update with applicationId
    await docRef.update({ applicationId });
    
    return {
      ...docData,
      id: doc.id,
      _id: doc.id,
      applicationId
    };
  } catch (error) {
    console.error('Error creating application:', error);
    throw error;
  }
}

/**
 * Retrieve single application by Firestore document ID
 * 
 * @param {String} id - Firestore document ID
 * 
 * @returns {Promise<Object|null>} Application object or null if not found
 * 
 * @throws {Error} If Firestore operation fails
 */
async function getApplicationById(id) {
  try {
    const doc = await db.collection('applications').doc(id).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      ...doc.data(),
      id: doc.id,
      _id: doc.id
    };
  } catch (error) {
    console.error('Error getting application:', error);
    throw error;
  }
}

/**
 * Update existing application
 * 
 * Automatically updates the 'updatedAt' timestamp.
 * Only updates fields provided in data parameter.
 * 
 * @param {String} id - Firestore document ID
 * @param {Object} data - Fields to update
 * 
 * @returns {Promise<Object>} Updated application object
 * 
 * @throws {Error} If document doesn't exist or update fails
 */
async function updateApplication(id, data) {
  try {
    await db.collection('applications').doc(id).update({
      ...data,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return await getApplicationById(id);
  } catch (error) {
    console.error('Error updating application:', error);
    throw error;
  }
}

/**
 * Add a new revision (version) to an existing application
 * 
 * @param {String} id - Firestore document ID
 * @param {Object} revisionData - New version data
 * @param {Array} revisionData.pdfFiles - PDF file metadata
 * @param {Object} revisionData.excelFile - Excel file metadata
 * @param {Array} revisionData.missingCriteria - Missing competencies
 * @param {Array} revisionData.mappings - Competency mappings
 * 
 * @returns {Promise<Object>} Updated application object
 * 
 * @throws {Error} If document doesn't exist or update fails
 */
async function addRevision(id, revisionData) {
  try {
    const application = await getApplicationById(id);
    
    if (!application) {
      throw new Error('Application not found');
    }
    
    const newVersionNumber = application.currentVersion + 1;
    
    // Build new version object
    const newVersion = {
      version: newVersionNumber,
      analyzedAt: new Date(),
      pdfFiles: revisionData.pdfFiles || [],
      packageFiles: revisionData.packageFiles || [],
      excelFile: revisionData.excelFile || null,
      missingCriteria: revisionData.missingCriteria || [],
      mappings: revisionData.mappings || []
    };
    
    // Add new version to versions array
    const updatedVersions = [...application.versions, newVersion];
    
    await db.collection('applications').doc(id).update({
      versions: updatedVersions,
      currentVersion: newVersionNumber,
      lastRevised: new Date(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return await getApplicationById(id);
  } catch (error) {
    console.error('Error adding revision:', error);
    throw error;
  }
}

/**
 * Get all applications with optional filtering
 * 
 * Supports filtering by:
 * - status: "Unreviewed", "Incomplete", or "Approved"
 * - email: Provider email address
 * 
 * Results are sorted by submission date (newest first).
 * 
 * @param {Object} [filters={}] - Optional filter criteria
 * @param {String} [filters.status] - Filter by application status
 * @param {String} [filters.email] - Filter by provider email
 * 
 * @returns {Promise<Array>} Array of application objects
 * 
 * @throws {Error} If Firestore operation fails
 */
async function getAllApplications(filters = {}) {
  try {
    let query = db.collection('applications');
    
    // Apply filters
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters.email) {
      query = query.where('email', '==', filters.email);
    }
    
    // Sort by submitted date (newest first)
    query = query.orderBy('submittedDate', 'desc');
    
    const snapshot = await query.get();
    
    const applications = [];
    snapshot.forEach(doc => {
      applications.push({
        ...doc.data(),
        id: doc.id,
        _id: doc.id
      });
    });
    
    return applications;
  } catch (error) {
    console.error('Error getting all applications:', error);
    throw error;
  }
}

/**
 * Delete application (admin operation)
 * 
 * Permanently removes application document from Firestore.
 * Note: This does NOT delete associated files from Cloud Storage.
 * For complete deletion, files should be deleted separately.
 * 
 * @param {String} id - Firestore document ID
 * 
 * @returns {Promise<Boolean>} True if successful
 * 
 * @throws {Error} If deletion fails
 */
async function deleteApplication(id) {
  try {
    await db.collection('applications').doc(id).delete();
    return true;
  } catch (error) {
    console.error('Error deleting application:', error);
    throw error;
  }
}

/**
 * Get application statistics for reviewer dashboard
 * 
 * Counts applications by status:
 * - Unreviewed: Newly submitted, awaiting review
 * - Incomplete: Missing competencies, needs revision
 * - Approved: Fully approved applications
 * 
 * @returns {Promise<Object>} Statistics object
 * @returns {Number} return.total - Total number of applications
 * @returns {Number} return.unreviewed - Count of unreviewed applications
 * @returns {Number} return.incomplete - Count of incomplete applications
 * @returns {Number} return.approved - Count of approved applications
 * 
 * @throws {Error} If Firestore operation fails
 */
async function getStats() {
  try {
    const snapshot = await db.collection('applications').get();
    
    let unreviewed = 0;
    let incomplete = 0;
    let approved = 0;
    
    snapshot.forEach(doc => {
      const status = doc.data().status;
      if (status === 'Unreviewed') unreviewed++;
      else if (status === 'Incomplete') incomplete++;
      else if (status === 'Approved') approved++;
    });
    
    return {
      total: unreviewed + incomplete + approved, // Exclude drafts from total
      unreviewed,
      incomplete,
      approved
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
}

module.exports = {
  createApplication,
  getApplicationById,
  updateApplication,
  addRevision,
  getAllApplications,
  deleteApplication,
  getStats,
  generateApplicationId
};