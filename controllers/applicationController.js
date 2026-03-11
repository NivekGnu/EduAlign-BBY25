const { createApplication, updateApplication, getApplicationById, getAllApplications } = require('../utils/firestoreService');
const { uploadMultipleToStorage, getSignedUrl } = require('../utils/firebaseStorage');
const { extractTextFromMultiplePDFs, isValidPDF, getFileSizeMB } = require('../utils/pdfParser');
const { analyzeCurriculum, getLevel1Competencies } = require('../utils/groqAnalyzer');
const { fillAndUploadLevel1Excel } = require('../utils/excelFiller');
const fs = require('fs');

// Submit a new application (create applicationId and store all files)
exports.submitApplication = async (req, res) => {
  const tempFilePaths = []; // Array to track all temp files
  
  try {
    const { providerName, organizationName } = req.body;
    const email = req.user ? req.user.email : req.body.email;
    const pdfFiles = req.files; 
    // files sent over http as bytes, multer intercepts and extracts bytes of each PDF file, 
    // bytes for each file saved temporarily in /Uploads
    // multer then adds each PDF file in array (req.files)
    
    if (!providerName || !organizationName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName, email'
      });
    }
    
    // Check for files array
    if (!pdfFiles || pdfFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }
    
    console.log('');
    console.log('===== NEW APPLICATION SUBMISSION =====');
    console.log(`Provider: ${providerName}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Email: ${email}`);
    console.log(`Files: ${pdfFiles.length} PDFs`); // Show file count
    pdfFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
    // Read all PDF files
    const pdfBuffers = [];
    for (const file of pdfFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      pdfBuffers.push(buffer);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }

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
      pdfFiles: [], // Empty array placeholder
      excelFile: null,
      mappings: [],
      missingCriteria: []
    });
    
    console.log(`Application ID: ${application.applicationId}`);
    
    // Upload all files to Firebase Storage
    const filenames = pdfFiles.map(f => f.originalname);
    const storageResults = await uploadMultipleToStorage(pdfBuffers, filenames, application.id);
    
    // Extract text from all PDFs
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    
    // Step 5: Analyze with Groq (using combined text)
    const competencies = getLevel1Competencies();
    const analysis = await analyzeCurriculum(pdfData.combinedText, competencies);

    // Generate and upload filled Level 1 Excel
    let filledExcelResult = null;
    try {
      filledExcelResult = await fillAndUploadLevel1Excel(
        analysis,
        competencies,
        application._id.toString()
      );
    } catch (excelErr) {
      console.error('Warning: Failed to generate filled Excel:', excelErr);
    }

    // Build pdfFiles array from storage results
    const pdfFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));

    // Step 6: Update application with version 1 data
    const version1 = {
      version: 1,
      analyzedAt: new Date(),
      pdfFiles: pdfFilesData,
      excelFile: filledExcelResult ? {
        storagePath: filledExcelResult.storagePath,
        publicUrl: filledExcelResult.publicUrl,
        filename: filledExcelResult.filename,
        generatedAt: new Date()
      } : null,
      missingCriteria: analysis.missingCriteria || [],
      mappings: analysis.mappings || []
    };

    const updateData = {
      versions: [version1],
      currentVersion: 1
    };

    const updatedApp = await updateApplication(application.id, updateData);
    
    console.log('');
    console.log('Application submitted successfully');
    console.log('========================================');
    console.log('');
    
    // Clean up all temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
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
        mappingsCount: updatedApp.mappings ? updatedApp.mappings.length : 0,
        filesCount: pdfFilesData.length 
      }
    });
    
  } catch (error) {
    console.error('');
    console.error('Error submitting application:', error);
    console.error('');
    
    // Clean up all temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit application'
    });
  }
};

/**
 * Analyze curriculum without submitting (preview only)
 * No database creation, no Firebase upload
 */
exports.analyzeCurriculum = async (req, res) => {
  const tempFilePaths = []; // Array to track all temp files
  
  try {
    const { providerName, organizationName } = req.body;
    const pdfFiles = req.files;
    
    if (!providerName || !organizationName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName'
      });
    }
    
    if (!pdfFiles || pdfFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }
    
    console.log('');
    console.log('===== ANALYZING CURRICULUM (PREVIEW) =====');
    console.log(`Provider: ${providerName}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Files: ${pdfFiles.length} PDFs`);
    pdfFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
    // CHANGED: Read and validate all PDFs
    const pdfBuffers = [];
    const filenames = [];
    
    for (const file of pdfFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      pdfBuffers.push(buffer);
      filenames.push(file.originalname);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }
    
    // CHANGED: Extract text from all PDFs
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    
    // Analyze with Groq (combined text)
    const competencies = getLevel1Competencies();
    const analysis = await analyzeCurriculum(pdfData.combinedText, competencies);
    
    console.log('');
    console.log('Analysis complete (not saved)');
    console.log('========================================');
    console.log('');
    
    // Clean up all temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    // Return analysis results (nothing saved to DB or Firebase)
    res.json({
      success: true,
      analysis: {
        missingCriteria: analysis.missingCriteria || [],
        mappingsCount: analysis.mappings ? analysis.mappings.length : 0,
        coveredCount: competencies.length - (analysis.missingCriteria ? analysis.missingCriteria.length : 0),
        filesAnalyzed: pdfFiles.length // NEW: File count
      }
    });
    
  } catch (error) {
    console.error('');
    console.error('Error analyzing curriculum:', error);
    console.error('');
    
    // Clean up all temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze curriculum'
    });
  }
};

/**
 * Get all applications belonging to applicant only
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
 * Get application details belonging to applicant only
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

    // Generate signed URLs for all files in all versions
    const versions = await Promise.all(
      (application.versions || []).map(async (version) => {
        const versionData = {
          version: version.version,
          analyzedAt: version.analyzedAt,
          missingCriteria: version.missingCriteria || [],
          mappings: version.mappings || []
        };

        // Add signed URLs for all PDF files
        if (version.pdfFiles && version.pdfFiles.length > 0) {
          versionData.pdfFiles = await Promise.all(
            version.pdfFiles.map(async (pdf) => ({
              filename: pdf.filename,
              uploadedAt: pdf.uploadedAt,
              fileIndex: pdf.fileIndex || 1,
              signedUrl: await getSignedUrl(pdf.storagePath, 1)
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

/**
 * Add a new revision to an existing application
 */
exports.reviseApplication = async (req, res) => {
  const tempFilePaths = []; // Array to track all temp files
  
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const pdfFiles = req.files;
    
    if (!pdfFiles || pdfFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }
    
    // Find existing application
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
    
    console.log('');
    console.log('===== APPLICATION REVISION =====');
    console.log(`Application ID: ${application.applicationId}`);
    console.log(`New Version: ${application.currentVersion + 1}`);
    console.log(`Files: ${pdfFiles.length} PDFs`);
    pdfFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
    // Read and validate all PDFs
    const pdfBuffers = [];
    const filenames = [];
    
    for (const file of pdfFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      pdfBuffers.push(buffer);
      filenames.push(file.originalname);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }
    
    // Upload all files to Firebase Storage
    const storageResults = await uploadMultipleToStorage(pdfBuffers, filenames, application.id);
    
    // Extract text from all PDFs and analyze
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    const competencies = getLevel1Competencies();
    const analysis = await analyzeCurriculum(pdfData.combinedText, competencies);
    
    // Generate and upload filled Excel
    let filledExcelResult = null;
    try {
      filledExcelResult = await fillAndUploadLevel1Excel(
        analysis,
        competencies,
        application._id.toString()
      );
    } catch (excelErr) {
      console.error('Warning: Failed to generate filled Excel on revision:', excelErr);
    }
    
    // Build pdfFiles array from storage results
    const pdfFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));
    
    // Create new version object
    const revisionData = {
      pdfFiles: pdfFilesData, 
      excelFile: filledExcelResult ? {
        storagePath: filledExcelResult.storagePath,
        publicUrl: filledExcelResult.publicUrl,
        filename: filledExcelResult.filename,
        generatedAt: new Date()
      } : null,
      missingCriteria: analysis.missingCriteria || [],
      mappings: analysis.mappings || []
    };
    
    // Add revision to application
    const { addRevision } = require('../utils/firestoreService');
    const updatedApp = await addRevision(application.id, revisionData);
    
    console.log('');
    console.log('Revision submitted successfully');
    console.log('===================================');
    console.log('');
    
    // Clean up all temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.json({
      success: true,
      applicationId: updatedApp.applicationId,
      version: updatedApp.currentVersion,
      missingCriteria: revisionData.missingCriteria,
      filesCount: pdfFilesData.length // NEW: File count
    });
    
  } catch (error) {
    console.error('Error revising application:', error);
    
    // Clean up all temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revise application'
    });
  }
};