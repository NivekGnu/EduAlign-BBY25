/**
 * @fileoverview Reviewer Controller
 * 
 * Handles reviewer dashboard operations: view applications, update status, access details.
 * All endpoints require authentication + reviewer role.
 * 
 * Status values: "Unreviewed" | "Incomplete" | "Approved"
 */

const { getApplicationById, getAllApplications, updateApplication, getStats } = require('../utils/firestoreService');
const { getSignedUrl } = require('../utils/firebaseStorage');

/**
 * Get all submitted applications for reviewer dashboard.
 * 
 * @returns {{ success: boolean, stats: Object, applications: Array }} Applications with statistics
 * @throws {500} Database query failure
 */
exports.getApplications = async (req, res) => {
  try {
    const applications = await getAllApplications();
    const stats = await getStats();
    
    res.json({
      success: true,
      stats,
      applications
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update application status.
 * Sets reviewedDate timestamp when status is "Approved".
 * 
 * @param {string} req.params.id - Application Firestore document ID
 * @param {string} req.body.status - New status: "Unreviewed" | "Incomplete" | "Approved"
 * @returns {{ success: boolean, application: Object }} Updated application
 * @throws {400} Invalid status value
 * @throws {404} Application not found
 * @throws {500} Database update failure
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['Unreviewed', 'Incomplete', 'Approved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    const application = await getApplicationById(id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const updateData = { status };

    if (status === 'Incomplete' || status === 'Approved') {
      updateData.reviewedDate = new Date();
    }

    const updatedApp = await updateApplication(id, updateData);
    
    console.log(`Status updated: ${application.applicationId} → ${status}`);
    
    res.json({
      success: true,
      application: updatedApp
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get full application details with all versions and downloadable files.
 * Generates signed URLs (valid 1 day) for PDFs and Excel files.
 * 
 * @param {string} req.params.id - Application Firestore document ID
 * @returns {{ success: boolean, application: Object, versions: Array }} Complete application data
 * @throws {404} Application not found
 * @throws {500} Database or storage failure
 */
exports.getApplicationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const application = await getApplicationById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Generate signed URLs for all versions
    const versions = await Promise.all(
      (application.versions || []).map(async (version) => {
        const versionData = {
          version: version.version,
          analyzedAt: version.analyzedAt,
          missingCriteria: version.missingCriteria || [],
          mappings: version.mappings || []
        };

        // Add signed URLs for all PDFs
        if (version.curriculumFiles && version.curriculumFiles.length > 0) {
          versionData.curriculumFiles = await Promise.all(
            version.curriculumFiles.map(async (pdf) => ({
              filename: pdf.filename,
              uploadedAt: pdf.uploadedAt,
              fileIndex: pdf.fileIndex || 1,
              signedUrl: await getSignedUrl(pdf.storagePath, 1)
            }))
          );
        }
        
        // Signed URLs for package files (application form, course outline, admin docs)
        if (version.applicationPackageFiles && version.applicationPackageFiles.length > 0) {
          versionData.applicationPackageFiles = await Promise.all(
            version.applicationPackageFiles.map(async (pkg) => ({
              filename: pkg.filename,
              label: pkg.label || 'Package Document',
              uploadedAt: pkg.uploadedAt,
              fileIndex: pkg.fileIndex || 1,
              signedUrl: await getSignedUrl(pkg.storagePath, 1)
            }))
          );
        }

        // Add signed URL for Excel
        if (version.excelFile?.storagePath) {
          versionData.excelFile = {
            filename: version.excelFile.filename,
            generatedAt: version.excelFile.generatedAt,
            signedUrl: await getSignedUrl(version.excelFile.storagePath, 1)
          };
        }

        return versionData;
      })
    );

    res.json({
      success: true,
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        providerName: application.providerName,
        organizationName: application.organizationName,
        email: application.email,
        status: application.status,
        submittedDate: application.submittedDate,
        lastRevised: application.lastRevised,
        reviewedDate: application.reviewedDate,
        currentVersion: application.currentVersion || 1
      },
      versions: versions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};