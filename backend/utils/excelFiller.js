/**
 * @fileoverview Excel Template Filler
 * 
 * Fills Excel competency mapping template with AI analysis results.
 * Reads WorkSafeBC Level 1 template, populates with curriculum mappings,
 * marks missing competencies, and uploads to Firebase Storage.
 */

const ExcelJS = require('exceljs');
const { uploadToStorage } = require('./firebaseStorage');
const fs = require('fs').promises;
const path = require('path');

/**
 * Fill Level 1 competency template and upload to Firebase Storage.
 * 
 * Workflow:
 * 1. Load Excel template from local file
 * 2. Fill mapped competencies (where AI found coverage)
 * 3. Mark missing competencies as "Not covered"
 * 4. Save to buffer and upload to Firebase Storage
 * 
 * @param {Object} analysis - AI analysis results from analyzeCurriculum
 * @param {Array<Object>} analysis.mappings - Competencies found in curriculum
 * @param {Array<string>} analysis.missingCriteria - Competencies not found
 * @param {Array<Object>} competencies - Full list from getLevel1Competencies
 * @param {string} applicationId - Application ID for Firebase Storage folder path
 * @param {string} [templatePath] - Local path to Excel template file
 * @returns {Promise<{storagePath: string, publicUrl: string, filename: string}>} Upload result
 * @throws {Error} Template file not found or sheet missing
 * @throws {Error} Firebase Storage upload failure
 */
async function fillAndUploadLevel1Excel(analysis, competencies, applicationId, templatePath = './templates/asbestos-abatement-training-curriculum-mapping-xls-en.xlsx') {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet('Level 1 competencies');
  if (!sheet) throw new Error('Level 1 competencies sheet not found');

  console.log(`Filling Excel for application ${applicationId}`);
  console.log(`Total competencies in list: ${competencies.length}`);

  // Fill mappings (where AI found coverage)
  // note mappings and missingCriteria variables use 1-based indexing
  (analysis.mappings || []).forEach(m => {
    const index = m.competencyIndex - 1; // convert to 0-based indexing: eg. competencyIndex 1 → array index 0
    if (index < 0 || index >= competencies.length) {
      console.warn(`Invalid competencyIndex ${m.competencyIndex} (out of range)`);
      return;
    }

    const rowNum = competencies[index].rowIndex; // competencies array is 0 based
    const competencyText = competencies[index].text.slice(0, 40) + '...';

    console.log(`Mapping #${m.competencyIndex} → Row ${rowNum} | ${competencyText}`);

    const row = sheet.getRow(rowNum);
    row.getCell(3).value = m.where     || 'Not explicitly covered';  // Column C
    row.getCell(4).value = m.howTaught || 'Lecture';                 // Column D 
    row.getCell(5).value = m.howAssessed || 'Quiz';                  // Column E
    row.commit();
  });

  // Fill missing competencies with clear indication
  const mappedIndices = new Set((analysis.mappings || []).map(m => m.competencyIndex));
  competencies.forEach((comp, idx) => {
    const compIndex = idx + 1; // switch back to 1-based indexing
    if (!mappedIndices.has(compIndex)) {
      const rowNum = comp.rowIndex;
      console.log(`Marking missing: #${compIndex} → Row ${rowNum} | ${comp.text.slice(0, 40)}...`);

      const row = sheet.getRow(rowNum);
      row.getCell(3).value = 'Not covered in provided course material';
      row.getCell(4).value = 'Not taught';
      row.getCell(5).value = 'Not assessed';
      row.commit();
    }
  });

  // Save to buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `Filled_Level1_${applicationId}.xlsx`;
  const storageResult = await uploadToStorage(buffer, filename, applicationId);

  console.log(`Filled Excel uploaded: ${storageResult.storagePath}`);

  return {
    storagePath: storageResult.storagePath,
    publicUrl: storageResult.publicUrl,
    filename
  };
}

module.exports = { fillAndUploadLevel1Excel };