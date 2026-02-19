const { getApplicationById, getAllApplications, updateApplication, getStats } = require('../utils/firestoreService');
const { getSignedUrl } = require('../utils/firebaseStorage');

/**
 * Login (simple password check)
 */
exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (password === process.env.REVIEWER_PASSWORD) {
      res.json({
        success: true,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

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
    
    console.log(`✅ Status updated: ${application.applicationId} → ${status}`);
    
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
 * Get signed URL for PDF download
 */
exports.getPdfUrl = async (req, res) => {
  try {
    const { id, version } = req.params;
    
    const application = await getApplicationById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    const versionIndex = parseInt(version) - 1;
    
    if (versionIndex < 0 || versionIndex >= application.pdfFiles.length) {
      return res.status(404).json({
        success: false,
        error: 'PDF version not found'
      });
    }
    
    const pdfFile = application.pdfFiles[versionIndex];
    
    // Generate signed URL (valid for 1 hour)
    const signedUrl = await getSignedUrl(pdfFile.storagePath, 1); // 1 day
    
    res.json({
      success: true,
      url: signedUrl,
      filename: pdfFile.filename,
      expiresIn: 3600
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

    // Generate signed URLs for all PDF versions
    const pdfFiles = await Promise.all(
      application.pdfFiles.map(async (file, index) => ({
        version: index + 1,
        filename: file.filename,
        uploadedAt: file.uploadedAt,
        signedUrl: await getSignedUrl(file.storagePath, 1) // 1 day
      }))
    );

    // Signed URL for filled Excel (if generated)
    let filledExcel = null;
    if (application.filledExcel?.storagePath) {
      filledExcel = {
        filename: application.filledExcel.filename,
        generatedAt: application.filledExcel.generatedAt,
        signedUrl: await getSignedUrl(application.filledExcel.storagePath, 1)
      };
    }

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
        missingCriteria: application.missingCriteria,
        // mappings excluded for size, add if needed
      },
      pdfFiles,
      filledExcel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};