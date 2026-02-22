const { createApplication, updateApplication, getApplicationById, getAllApplications } = require('../utils/firestoreService');
const { uploadToStorage, getSignedUrl } = require('../utils/firebaseStorage');
const { extractTextFromPDF, isValidPDF, getFileSizeMB } = require('../utils/pdfParser');
const { analyzeCurriculum, getLevel1Competencies } = require('../utils/groqAnalyzer');
const { fillAndUploadLevel1Excel } = require('../utils/excelFiller');
const fs = require('fs');

// Submit a new application with PDF
exports.submitApplication = async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { providerName, organizationName } = req.body;
    const email = req.user ? req.user.email : req.body.email;
    const pdfFile = req.file;
    
    if (!providerName || !organizationName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName, email'
      });
    }
    
    if (!pdfFile) {
      return res.status(400).json({
        success: false,
        error: 'No PDF file uploaded'
      });
    }
    
    tempFilePath = pdfFile.path;
    
    // TODO: REMOVE CONSOLE.LOG - This is just for debugging to verify file upload and data received
    console.log('');
    console.log('===== NEW APPLICATION SUBMISSION =====');
    console.log(`Provider: ${providerName}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Email: ${email}`);
    console.log(`File: ${pdfFile.originalname}`);
    console.log('');
    
    // Step 1: Read PDF file
    const pdfBuffer = fs.readFileSync(tempFilePath);
    
    if (!isValidPDF(pdfBuffer)) {
      throw new Error('Invalid PDF file');
    }
    
    console.log(`File size: ${getFileSizeMB(pdfBuffer)} MB`);
    
    let userId = null;
    if (req.user) {
      userId = req.user.uid; 
    }

    // Step 2: Create application record first (to get ID)
    const application = await createApplication({
      userId,
      providerName,
      organizationName,
      email,
      status: 'Unreviewed',
      submittedDate: new Date(),
      pdfFiles: [],
      mappings: [],
      missingCriteria: []
    });
    
    console.log(`Application ID: ${application.applicationId}`);
    
    // Step 3: Upload to Firebase Storage
    const storageResult = await uploadToStorage(pdfBuffer, pdfFile.originalname, application.id);
    
    // Step 4: Extract text from PDF
    const pdfData = await extractTextFromPDF(pdfBuffer);
    
    // Step 5: Analyze with Groq
    const competencies = getLevel1Competencies();
    const analysis = await analyzeCurriculum(pdfData.text, competencies);

    // Generate and upload filled Level 1 Excel
    // const { fillAndUploadLevel1Excel } = require('../utils/excelFiller');
    let filledExcelResult = null;
    try {
      filledExcelResult = await fillAndUploadLevel1Excel(
        analysis,
        competencies,
        application._id.toString()
      );
    } catch (excelErr) {
      console.error('Warning: Failed to generate filled Excel:', excelErr);
      // Optional continue or throw if you want to block submission
    }

    // Step 6: Update application with results
    const updateData = {
      pdfFiles: [{
        storagePath: storageResult.storagePath,
        publicUrl: storageResult.publicUrl,
        filename: pdfFile.originalname,
        uploadedAt: new Date(),
        version: 1
      }],
      mappings: analysis.mappings || [],
      missingCriteria: analysis.missing || []
    };

    if (filledExcelResult) {
      updateData.filledExcel = {
        storagePath: filledExcelResult.storagePath,
        publicUrl: filledExcelResult.publicUrl,
        filename: filledExcelResult.filename,
        generatedAt: new Date()
      };
    }

    const updatedApp = await updateApplication(application.id, updateData);
    
    console.log('');
    console.log('Application submitted successfully');
    console.log('========================================');
    console.log('');
    
    fs.unlinkSync(tempFilePath);
    
    // Return response
    res.json({
      success: true,
      applicationId: updatedApp.applicationId,
      application: {
        id: updatedApp.id,
        applicationId: updatedApp.applicationId,
        providerName: updatedApp.providerName,
        organizationName: updatedApp.organizationName,
        email: updatedApp.email,
        status: updatedApp.status,
        submittedDate: updatedApp.submittedDate,
        missingCriteria: updatedApp.missingCriteria,
        mappingsCount: updatedApp.mappings ? updatedApp.mappings.length : 0
      }
    }); 
    
  } catch (error) {
    console.error('');
    console.error('Error submitting application:', error);
    console.error('');
    
    // Clean up temp file if exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit application'
    });
  }
};

// may use later -clinton
// Revise an existing application with a new PDF version
// exports.reviseApplication = async (req, res) => {
//   let tempFilePath = null;
  
//   try {
//     const { id } = req.params;
//     const pdfFile = req.file;
    
//     if (!pdfFile) {
//       return res.status(400).json({
//         success: false,
//         error: 'No PDF file uploaded'
//       });
//     }
    
//     // Find existing application
//     const application = await getApplicationById(id);
    
//     if (!application) {
//       return res.status(404).json({
//         success: false,
//         error: 'Application not found'
//       });
//     }
    
//     tempFilePath = pdfFile.path;
    
//     console.log('');
//     console.log('===== APPLICATION REVISION =====');
//     console.log(`Application ID: ${application.applicationId}`);
//     console.log(`New file: ${pdfFile.originalname}`);
//     console.log('');
    
//     const pdfBuffer = fs.readFileSync(tempFilePath);
    
//     if (!isValidPDF(pdfBuffer)) {
//       throw new Error('Invalid PDF file');
//     }
    
//     // Upload to Firebase Storage
//     const versionNumber = application.pdfFiles.length + 1;
//     const storageResult = await uploadToStorage(pdfBuffer, pdfFile.originalname, application.id);
    
//     // Extract text and analyze
//     const pdfData = await extractTextFromPDF(pdfBuffer);
//     const competencies = getLevel1Competencies();
//     const analysis = await analyzeCurriculum(pdfData.text, competencies);

//     // Generate and upload filled Level 1 Excel
//     const { fillAndUploadLevel1Excel } = require('../utils/excelFiller');
//     let filledExcelResult = null;
//     try {
//       filledExcelResult = await fillAndUploadLevel1Excel(
//         analysis,
//         competencies,
//         application._id.toString()
//       );
//     } catch (excelErr) {
//       console.error('Warning: Failed to generate filled Excel on revision:', excelErr);
//     }

//     // Update application
//     const updatedPdfFiles = [...application.pdfFiles, {
//       storagePath: storageResult.storagePath,
//       publicUrl: storageResult.publicUrl,
//       filename: pdfFile.originalname,
//       uploadedAt: new Date(),
//       version: versionNumber
//     }];

//     const updateData = {
//       pdfFiles: updatedPdfFiles,
//       mappings: analysis.mappings || [],
//       missingCriteria: analysis.missing || [],
//       lastRevised: new Date()
//     };

//     if (filledExcelResult) {
//       updateData.filledExcel = {
//         storagePath: filledExcelResult.storagePath,
//         publicUrl: filledExcelResult.publicUrl,
//         filename: filledExcelResult.filename,
//         generatedAt: new Date()
//       };
//     }

//     await updateApplication(application.id, updateData);
    
//     console.log('');
//     console.log('Revision submitted successfully');
//     console.log('===================================');
//     console.log('');
    
//     // Clean up
//     fs.unlinkSync(tempFilePath);
    
//     res.json({
//       success: true,
//       applicationId: application.applicationId,
//       version: versionNumber,
//       missingCriteria: application.missingCriteria
//     });
    
//   } catch (error) {
//     console.error('Error revising application:', error);
    
//     if (tempFilePath && fs.existsSync(tempFilePath)) {
//       fs.unlinkSync(tempFilePath);
//     }
    
//     res.status(500).json({
//       success: false,
//       error: error.message || 'Failed to revise application'
//     });
//   }
// };

// Return application details by ID
exports.getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    const application = await getApplicationById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    res.json({
      success: true,
      application
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all applications for reviewer
exports.getAllApplications = async (req, res) => {
  try {
    const applications = await getAllApplications();
    
    res.json({
      success: true,
      count: applications.length,
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
 * Get applications for current user (applicant only)
 */
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const applications = await getAllApplications();
    const myApplications = applications.filter(app => app.userId === userId);
    
    res.json({
      success: true,
      count: myApplications.length,
      applications: myApplications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get application details for current user (applicant only)
 */
exports.getMyApplicationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    const application = await getApplicationById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Verify this application belongs to the user
    if (application.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Generate signed URLs for all PDF versions
    const pdfFiles = await Promise.all(
      application.pdfFiles.map(async (file, index) => ({
        version: index + 1,
        filename: file.filename,
        uploadedAt: file.uploadedAt,
        signedUrl: await getSignedUrl(file.storagePath, 1)
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
