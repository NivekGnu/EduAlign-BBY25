const { createApplication, updateApplication, getApplicationById, getAllApplications } = require('../utils/firestoreService');
const { uploadMultipleToStorage, getSignedUrl } = require('../utils/firebaseStorage');
const { extractTextFromMultiplePDFs, isValidPDF, getFileSizeMB } = require('../utils/pdfParser');
const { analyzeCurriculum, getLevel1Competencies } = require('../utils/groqAnalyzer');
const { fillAndUploadLevel1Excel } = require('../utils/excelFiller');
const fs = require('fs');

/**
 * Create a draft application (Step 1: saves curriculum files + analysis, status = Draft)
 * Called from application.html after "Continue to Application Package"
 */
exports.createDraft = async (req, res) => {
  const tempFilePaths = [];
  
  try {
    const { providerName, organizationName } = req.body;
    const email = req.user ? req.user.email : req.body.email;
    const pdfFiles = req.files;
    
    if (!providerName || !organizationName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName, email'
      });
    }
    
    if (!pdfFiles || pdfFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }
    
    console.log('');
    console.log('===== CREATING DRAFT APPLICATION =====');
    console.log(`Provider: ${providerName}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Email: ${email}`);
    console.log(`Curriculum Files: ${pdfFiles.length} PDFs`);
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

    // Create application record with Draft status
    const application = await createApplication({
      userId,
      providerName,
      organizationName,
      email,
      status: 'Draft',
      submittedDate: new Date(),
      pdfFiles: [],
      excelFile: null,
      mappings: [],
      missingCriteria: []
    });
    
    // Capture Firestore doc ID immediately as primitive string
    const firestoreDocId = application.id || application._id;
    const appDisplayId = application.applicationId;
    
    console.log(`Draft Application ID: ${appDisplayId}`);
    console.log(`Firestore Doc ID: ${firestoreDocId}`);
    
    if (!firestoreDocId) {
      throw new Error('Failed to get Firestore document ID after creation');
    }
    
    // Upload curriculum files to Firebase Storage
    const filenames = pdfFiles.map(f => f.originalname);
    const storageResults = await uploadMultipleToStorage(pdfBuffers, filenames, firestoreDocId);
    
    // Extract text from all PDFs
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    const competencies = getLevel1Competencies();
    
    // Use cached analysisResults or analyze with Groq
    let analysis;
    if (req.body.analysisResults) {
      console.log('Using pre-analyzed results from frontend');
      analysis = JSON.parse(req.body.analysisResults);
    } else {
      console.log('No pre-analyzed results found, analyzing now...');
      analysis = await analyzeCurriculum(pdfData.combinedText, competencies);
    }
    
    // Generate and upload filled Level 1 Excel
    let filledExcelResult = null;
    try {
      filledExcelResult = await fillAndUploadLevel1Excel(
        analysis,
        competencies,
        firestoreDocId
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

    // Update application with version 1 data (curriculum only, package files added later)
    const version1 = {
      version: 1,
      analyzedAt: new Date(),
      pdfFiles: pdfFilesData,
      packageFiles: [], // Will be filled in completePackage
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

    await updateApplication(firestoreDocId, updateData);
    
    console.log('');
    console.log('Draft created successfully');
    console.log('========================================');
    console.log('');
    
    // Clean up temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.json({
      success: true,
      id: firestoreDocId,
      applicationId: appDisplayId
    });
    
  } catch (error) {
    console.error('Error creating draft:', error);
    
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create draft'
    });
  }
};

/**
 * Complete application package (Step 2: uploads package files, status Draft → Unreviewed)
 * Called from application-package.html
 */
exports.completePackage = async (req, res) => {
  const tempFilePaths = [];
  
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const packagePdfFiles = req.files;
    
    if (!packagePdfFiles || packagePdfFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No package files uploaded'
      });
    }
    
    // Find existing draft application
    const application = await getApplicationById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    // Verify ownership
    if (application.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Verify it's a draft
    if (application.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        error: 'Application is not in Draft status'
      });
    }
    
    console.log('');
    console.log('===== COMPLETING APPLICATION PACKAGE =====');
    console.log(`Application ID: ${application.applicationId}`);
    console.log(`Package Files: ${packagePdfFiles.length} PDFs`);
    
    // Parse package labels
    let packageLabels = [];
    try {
      packageLabels = JSON.parse(req.body.packageLabels || '[]');
    } catch (e) {
      packageLabels = [];
    }
    
    // Read and validate package files
    const packageBuffers = [];
    const packageFilenames = [];
    
    for (let i = 0; i < packagePdfFiles.length; i++) {
      const file = packagePdfFiles[i];
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      packageBuffers.push(buffer);
      packageFilenames.push(file.originalname);
      tempFilePaths.push(file.path);
      
      const label = packageLabels[i] || `Package Document ${i + 1}`;
      console.log(`  ${i + 1}. [${label}] ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }
    
    // Upload package files to Firebase Storage
    const storageResults = await uploadMultipleToStorage(packageBuffers, packageFilenames, application.id);
    
    // Build packageFiles array
    const packageFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      label: packageLabels[idx] || `Package Document ${idx + 1}`,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));
    
    // Update version 1 with package files and change status to Unreviewed
    const versions = application.versions || [];
    if (versions.length > 0) {
      versions[0].packageFiles = packageFilesData;
    }
    
    await updateApplication(application.id, {
      versions: versions,
      status: 'Unreviewed'
    });
    
    console.log('');
    console.log('Application package completed successfully');
    console.log('========================================');
    console.log('');
    
    // Clean up temp files
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.json({
      success: true,
      applicationId: application.applicationId
    });
    
  } catch (error) {
    console.error('Error completing package:', error);
    
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete package'
    });
  }
};

// Submit a new application (legacy - kept for compatibility, now creates full application in one step)
exports.submitApplication = async (req, res) => {
  const tempFilePaths = [];
  
  try {
    const { providerName, organizationName } = req.body;
    const email = req.user ? req.user.email : req.body.email;
    const pdfFiles = req.files; 
    
    if (!providerName || !organizationName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName, email'
      });
    }
    
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
    console.log(`Files: ${pdfFiles.length} PDFs`);
    pdfFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
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

    const application = await createApplication({
      userId,
      providerName,
      organizationName,
      email,
      status: 'Unreviewed',
      submittedDate: new Date(),
      pdfFiles: [],
      excelFile: null,
      mappings: [],
      missingCriteria: []
    });
    
    console.log(`Application ID: ${application.applicationId}`);
    
    const filenames = pdfFiles.map(f => f.originalname);
    const storageResults = await uploadMultipleToStorage(pdfBuffers, filenames, application.id);
    
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    const competencies = getLevel1Competencies();
    
    let analysis;
    if (req.body.analysisResults) {
      console.log('Using pre-analyzed results from frontend');
      analysis = JSON.parse(req.body.analysisResults);
    } else {
      console.log('No pre-analyzed results found, analyzing now...');
      analysis = await analyzeCurriculum(pdfData.combinedText, competencies);
    }
    
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

    const pdfFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));

    const version1 = {
      version: 1,
      analyzedAt: new Date(),
      pdfFiles: pdfFilesData,
      packageFiles: [],
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
    
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
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
  const tempFilePaths = [];
  
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
    
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    
    const competencies = getLevel1Competencies();
    const analysis = await analyzeCurriculum(pdfData.combinedText, competencies);
    
    console.log('');
    console.log('Analysis complete (not saved)');
    console.log('========================================');
    console.log('');
    
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.json({
      success: true,
      analysis: {
        missingCriteria: analysis.missingCriteria || [],
        mappings: analysis.mappings || [],
        mappingsCount: analysis.mappings ? analysis.mappings.length : 0,
        coveredCount: competencies.length - (analysis.missingCriteria ? analysis.missingCriteria.length : 0),
        filesAnalyzed: pdfFiles.length
      }
    });
    
  } catch (error) {
    console.error('');
    console.error('Error analyzing curriculum:', error);
    console.error('');
    
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
    // Filter by user AND exclude Draft status (incomplete applications)
    const myApplications = applications.filter(app => app.userId === userId && app.status !== 'Draft');
    
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

        // Signed URLs for curriculum PDF files
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

        // Signed URLs for package files
        if (version.packageFiles && version.packageFiles.length > 0) {
          versionData.packageFiles = await Promise.all(
            version.packageFiles.map(async (pkg) => ({
              filename: pkg.filename,
              label: pkg.label || 'Package Document',
              uploadedAt: pkg.uploadedAt,
              fileIndex: pkg.fileIndex || 1,
              signedUrl: await getSignedUrl(pkg.storagePath, 1)
            }))
          );
        }

        // Signed URL for Excel
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
  const tempFilePaths = [];
  
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
    
    const application = await getApplicationById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
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
    
    const storageResults = await uploadMultipleToStorage(pdfBuffers, filenames, application.id);
    
    const pdfData = await extractTextFromMultiplePDFs(pdfBuffers, filenames);
    const competencies = getLevel1Competencies();

    let analysis;
    if (req.body.analysisResults) {
      console.log('Using pre-analyzed results from frontend');
      analysis = JSON.parse(req.body.analysisResults);
    } else {
      console.log('No pre-analyzed results found, analyzing now...');
      analysis = await analyzeCurriculum(pdfData.combinedText, competencies);
    }
    
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
    
    const pdfFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));

    // Carry forward package files from the previous version
    const previousVersions = application.versions || [];
    const lastVersion = previousVersions[previousVersions.length - 1];
    const previousPackageFiles = lastVersion ? (lastVersion.packageFiles || []) : [];
    
    const revisionData = {
      pdfFiles: pdfFilesData,
      packageFiles: previousPackageFiles, // Carry forward package files
      excelFile: filledExcelResult ? {
        storagePath: filledExcelResult.storagePath,
        publicUrl: filledExcelResult.publicUrl,
        filename: filledExcelResult.filename,
        generatedAt: new Date()
      } : null,
      missingCriteria: analysis.missingCriteria || [],
      mappings: analysis.mappings || []
    };
    
    const { addRevision } = require('../utils/firestoreService');
    const updatedApp = await addRevision(application.id, revisionData);
    
    console.log('');
    console.log('Revision submitted successfully');
    console.log('===================================');
    console.log('');
    
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.json({
      success: true,
      applicationId: updatedApp.applicationId,
      version: updatedApp.currentVersion,
      missingCriteria: revisionData.missingCriteria,
      filesCount: pdfFilesData.length
    });
    
  } catch (error) {
    console.error('Error revising application:', error);
    
    tempFilePaths.forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revise application'
    });
  }
};
