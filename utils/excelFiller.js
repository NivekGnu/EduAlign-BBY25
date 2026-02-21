const ExcelJS = require('exceljs');
const { uploadToStorage } = require('./firebaseStorage');
const fs = require('fs').promises;
const path = require('path');

/**
  * Fills Level 1 sheet and uploads to Firebase Storage
 * @param {Object} analysis - From analyzeCurriculum
 * @param {Array} competencies - From getLevel1Competencies (updated full list)
 * @param {String} applicationId - Application ID for Firebase Storage folder
 * @param {String} [templatePath] - Local path to Excel template
 * @returns {Promise<{storagePath: String, publicUrl: String, filename: String}>}
 */
async function fillAndUploadLevel1Excel(analysis, competencies, applicationId, templatePath = './templates/asbestos-abatement-training-curriculum-mapping-xls-en.xlsx') {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet('Level 1 competencies');
  if (!sheet) throw new Error('Level 1 competencies sheet not found');

  // TO REMOVE: Log for debugging
  console.log(`Filling Excel for application ${applicationId}`);
  console.log(`Total competencies in list: ${competencies.length}`);

  // Fill mappings (where AI found coverage)
  (analysis.mappings || []).forEach(m => {
    const index = m.competencyIndex - 1; // competencyIndex 1 → array index 0
    if (index < 0 || index >= competencies.length) {
      console.warn(`Invalid competencyIndex ${m.competencyIndex} (out of range)`);
      return;
    }

    const rowNum = competencies[index].rowIndex;
    const competencyText = competencies[index].text.slice(0, 40) + '...';

    console.log(`   Mapping #${m.competencyIndex} → Row ${rowNum} | ${competencyText}`);

    const row = sheet.getRow(rowNum);
    row.getCell(3).value = m.where     || 'Not explicitly covered';  // Column C
    row.getCell(4).value = m.howTaught || 'Lecture';                 // Column D 
    row.getCell(5).value = m.howAssessed || 'Quiz';                  // Column E
    row.commit();
  });

  // Fill missing competencies with clear indication
  const mappedIndices = new Set((analysis.mappings || []).map(m => m.competencyIndex));
  competencies.forEach((comp, idx) => {
    const compIndex = idx + 1; // 1-based
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