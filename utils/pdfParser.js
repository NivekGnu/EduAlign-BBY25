/**
 * @fileoverview PDF Text Extraction Utility
 * 
 * Extracts text from PDF files using pdf-parse library.
 * Supports single and multiple PDF processing with validation.
 * Adds file separators for multi-PDF analysis to help AI identify sources.
 */

const pdfParse = require('pdf-parse');

/**
 * Extract text from single PDF buffer.
 * Validates PDF has sufficient text content (>100 characters).
 * 
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<{text: string, numpages: number, info: Object, metadata: Object}>} Parsed PDF data
 * @throws {Error} PDF is empty, scanned image, or invalid format
 */
async function extractTextFromPDF(pdfBuffer) {
  try { 
    console.log('Parsing PDF...'); 
    
    const data = await pdfParse(pdfBuffer); 
    
    console.log(`PDF parsed successfully`); 
    console.log(`Pages: ${data.numpages}`);
    console.log(`Text length: ${data.text.length} characters`);
    
    // checking for text on pdf. whether pdf has no text, or too little to process. (under 100 character)
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
    console.error('PDF parsing error:', error);
    
    if (error.message.includes('Invalid PDF')) { 
      throw new Error('Invalid PDF file. Please ensure the file is a valid PDF document.');
    }
    
    throw new Error(`Failed to parse PDF: ${error.message}`); 
  }
}

/**
 * Extract text from multiple PDFs and combine with file separators.
 * 
 * Adds separators like "========== FILE: filename ==========" between files
 * to help AI identify which file contains which content.
 * 
 * @param {Array<Buffer>} pdfBuffers - Array of PDF file buffers
 * @param {Array<string>} filenames - Array of original filenames (same order as buffers)
 * @returns {Promise<{combinedText: string, totalPages: number, files: Array<Object>}>} Combined results
 * @throws {Error} PDFs are empty, scanned images, or parsing fails
 */
async function extractTextFromMultiplePDFs(pdfBuffers, filenames) {
  try {
    console.log(`Parsing ${pdfBuffers.length} PDF files...`);
    
    const results = [];
    let combinedText = '';
    let totalPages = 0;
    
    for (let i = 0; i < pdfBuffers.length; i++) {
      const buffer = pdfBuffers[i];
      const filename = filenames[i];
      
      console.log(`  Parsing file ${i + 1}/${pdfBuffers.length}: ${filename}`);
      
      const data = await pdfParse(buffer);
      
      // Add separator with filename for context
      const separator = `\n\n========== FILE: ${filename} ==========\n\n`;
      combinedText += separator + data.text;
      
      totalPages += data.numpages;
      
      results.push({
        filename,
        text: data.text,
        numpages: data.numpages,
        info: data.info
      });
      
      console.log(`Pages: ${data.numpages}, Text length: ${data.text.length} characters`);
    }
    
    console.log(`All PDFs parsed successfully`);
    console.log(`Total pages: ${totalPages}`);
    console.log(`Combined text length: ${combinedText.length} characters`);
    
    if (!combinedText || combinedText.trim().length < 100) {
      throw new Error('PDFs appear to be empty or are scanned images. Please use text-based PDFs.');
    }
    
    return {
      combinedText,
      totalPages,
      files: results
    };
  } catch (error) {
    console.error('Multi-PDF parsing error:', error);
    throw new Error(`Failed to parse PDFs: ${error.message}`);
  }
}


/**
 * Validate PDF file by checking header.
 * Checks first 4 bytes for PDF signature ("%PDF").
 * 
 * @param {Buffer} buffer - File buffer to validate
 * @returns {boolean} True if valid PDF format
 */
function isValidPDF(buffer) {
  const pdfHeader = buffer.slice(0, 4).toString(); 
  return pdfHeader === '%PDF';
}

/**
 * Get PDF file size in megabytes.
 * 
 * @param {Buffer} buffer - File buffer
 * @returns {string} File size in MB with 2 decimal places
 */
function getFileSizeMB(buffer) {
  return (buffer.length / (1024 * 1024)).toFixed(2); //Byte to MB conversion
}

module.exports = {
  extractTextFromPDF,
  extractTextFromMultiplePDFs,
  isValidPDF,
  getFileSizeMB
};