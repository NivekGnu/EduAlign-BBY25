const pdfParse = require('pdf-parse');

/**
 * Extract text from PDF buffer
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} Parsed PDF data with text content
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    console.log('📄 Parsing PDF...');
    
    const data = await pdfParse(pdfBuffer);
    
    console.log(`✅ PDF parsed successfully`);
    console.log(`   Pages: ${data.numpages}`);
    console.log(`   Text length: ${data.text.length} characters`);
    
    // Check if PDF has text
    if (!data.text || data.text.trim().length < 100) {
      throw new Error('PDF appears to be empty or is a scanned image. Please use a text-based PDF or OCR your document first.');
    }
    
    return {
      text: data.text,
      numpages: data.numpages,
      info: data.info,
      metadata: data.metadata
    };
  } catch (error) {
    console.error('❌ PDF parsing error:', error);
    
    if (error.message.includes('Invalid PDF')) {
      throw new Error('Invalid PDF file. Please ensure the file is a valid PDF document.');
    }
    
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Validate PDF file
 * @param {Buffer} buffer - File buffer
 * @returns {Boolean} True if valid PDF
 */
function isValidPDF(buffer) {
  // Check PDF magic number (first 4 bytes should be %PDF)
  const pdfHeader = buffer.slice(0, 4).toString();
  return pdfHeader === '%PDF';
}

/**
 * Get PDF file size in MB
 * @param {Buffer} buffer - File buffer
 * @returns {Number} Size in MB
 */
function getFileSizeMB(buffer) {
  return (buffer.length / (1024 * 1024)).toFixed(2);
}

module.exports = {
  extractTextFromPDF,
  isValidPDF,
  getFileSizeMB
};
