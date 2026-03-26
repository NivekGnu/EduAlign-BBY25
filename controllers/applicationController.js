const { createApplication, updateApplication, getApplicationById, getAllApplications } = require('../utils/firestoreService');
const { uploadMultipleToStorage, getSignedUrl } = require('../utils/firebaseStorage');
const { extractTextFromMultiplePDFs, isValidPDF, getFileSizeMB } = require('../utils/pdfParser');
const { analyzeCurriculum, getLevel1Competencies } = require('../utils/groqAnalyzer');
const { fillAndUploadLevel1Excel } = require('../utils/excelFiller');
const fs = require('fs');

// Submit a new application (legacy - kept for compatibility, now creates full application in one step)
exports.submitApplication = async (req, res) => {
  const tempFilePaths = []; 
  
  try {
    const { providerName, organizationName } = req.body;
    const email = req.user ? req.user.email : req.body.email;
    const curriculumFiles = req.files['pdfs'] || [];
    const applicationPackageFiles = req.files['applicationPackageFiles'] || [];
    
    if (!providerName || !organizationName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName, email'
      });
    }
    
    if (!curriculumFiles || curriculumFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }

    // Check for package files
    if (!applicationPackageFiles || applicationPackageFiles.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Exactly 3 package files required (Provider Form, Course Outline, Admin Doc)'
      });
    }
    
    console.log('');
    console.log('===== NEW APPLICATION SUBMISSION =====');
    console.log(`Provider: ${providerName}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Email: ${email}`);
    console.log(`Files: ${curriculumFiles.length} PDFs`);
    curriculumFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
    const curriculumBuffers = [];
    for (const file of curriculumFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      curriculumBuffers.push(buffer);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }

    // Read all package files
    const applicationPackageBuffers = [];
    for (const file of applicationPackageFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      applicationPackageBuffers.push(buffer);
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
      curriculumFiles: [],
      excelFile: null,
      mappings: [],
      missingCriteria: []
    });
    
    console.log(`Application ID: ${application.applicationId}`);
    
    const filenames = curriculumFiles.map(f => f.originalname);
    const storageResults = await uploadMultipleToStorage(curriculumBuffers, filenames, application.id);
    const applicationPackageFilenames = applicationPackageFiles.map(f => f.originalname);
    const applicationPackageStorageResults = await uploadMultipleToStorage(applicationPackageBuffers, applicationPackageFilenames, application.id);
    
    const pdfData = await extractTextFromMultiplePDFs(curriculumBuffers, filenames);
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

    const curriculumFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));

    const version1 = {
      version: 1,
      analyzedAt: new Date(),
      curriculumFiles: curriculumFilesData,
      applicationPackageFiles: applicationPackageStorageResults.map((result, idx) => {
        const labels = ['Provider Application Form', 'Course Outline', 'Administration Document'];
        return {
          storagePath: result.storagePath,
          publicUrl: result.publicUrl,
          filename: result.filename,
          label: labels[idx] || 'Package Document',
          uploadedAt: new Date(),
          fileIndex: idx + 1
        };
      }),
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
        filesCount: curriculumFilesData.length 
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
    const curriculumFiles = req.files;
    
    if (!providerName || !organizationName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: providerName, organizationName'
      });
    }
    
    if (!curriculumFiles || curriculumFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }
    
    console.log('');
    console.log('===== ANALYZING CURRICULUM (PREVIEW) =====');
    console.log(`Provider: ${providerName}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Files: ${curriculumFiles.length} PDFs`);
    curriculumFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
    const curriculumBuffers = [];
    const filenames = [];
    
    for (const file of curriculumFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      curriculumBuffers.push(buffer);
      filenames.push(file.originalname);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }
    
    const pdfData = await extractTextFromMultiplePDFs(curriculumBuffers, filenames);
    
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
        filesAnalyzed: curriculumFiles.length
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

        // Signed URLs for package files
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
    const curriculumFiles = req.files['pdfs'] || [];
    const applicationPackageFiles = req.files['applicationPackageFiles'] || [];
    
    if (!curriculumFiles || curriculumFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files uploaded'
      });
    }

    // Check for package files
    if (!applicationPackageFiles || applicationPackageFiles.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Exactly 3 package files required (Provider Form, Course Outline, Admin Doc)'
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
    console.log(`Files: ${curriculumFiles.length} PDFs`);
    curriculumFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalname}`);
    });
    console.log('');
    
    const curriculumBuffers = [];
    const filenames = [];
    
    for (const file of curriculumFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      curriculumBuffers.push(buffer);
      filenames.push(file.originalname);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }

    // Read all package files
    const applicationPackageBuffers = [];
    for (const file of applicationPackageFiles) {
      const buffer = fs.readFileSync(file.path);
      
      if (!isValidPDF(buffer)) {
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
      
      applicationPackageBuffers.push(buffer);
      tempFilePaths.push(file.path);
      console.log(`  ${file.originalname}: ${getFileSizeMB(buffer)} MB`);
    }
    
    const storageResults = await uploadMultipleToStorage(curriculumBuffers, filenames, application.id);
    const applicationPackageFilenames = applicationPackageFiles.map(f => f.originalname);
    const applicationPackageStorageResults = await uploadMultipleToStorage(applicationPackageBuffers, applicationPackageFilenames, application.id);
    
    const pdfData = await extractTextFromMultiplePDFs(curriculumBuffers, filenames);
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
    
    const curriculumFilesData = storageResults.map((result, idx) => ({
      storagePath: result.storagePath,
      publicUrl: result.publicUrl,
      filename: result.filename,
      uploadedAt: new Date(),
      fileIndex: idx + 1
    }));
  
    const revisionData = {
      curriculumFiles: curriculumFilesData,
      applicationPackageFiles: applicationPackageStorageResults.map((result, idx) => {
        const labels = ['Provider Application Form', 'Course Outline', 'Administration Document'];
        return {
          storagePath: result.storagePath,
          publicUrl: result.publicUrl,
          filename: result.filename,
          label: labels[idx] || 'Package Document',
          uploadedAt: new Date(),
          fileIndex: idx + 1
        };
      }),
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
      filesCount: curriculumFilesData.length
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
