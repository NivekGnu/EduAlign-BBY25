const { getApplicationById, getAllApplications, updateApplication, getStats } = require('../utils/firestoreService');
const { getSignedUrl } = require('../utils/firebaseStorage');

/**
 * Get all applications for reviewer dashboard
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
 * Update application status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    // Validate status
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

    if (notes) {
      updateData.reviewerNotes = notes;
    }

    if (status === 'Approved') {
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
 * Get full application details with signed URLs for downloads
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

        // Add signed URL for PDF
        if (version.pdfFile?.storagePath) {
          versionData.pdfFile = {
            filename: version.pdfFile.filename,
            uploadedAt: version.pdfFile.uploadedAt,
            signedUrl: await getSignedUrl(version.pdfFile.storagePath, 1)
          };
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
        reviewerNotes: application.reviewerNotes,
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