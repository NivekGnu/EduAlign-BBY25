//importing the pdf parsing library. 
const pdfParse = require('pdf-parse');

/**
 * extract text from PDF buffer
 * @param {Buffer} pdfBuffer PDF file buffer
 * @returns {Promise<Object>} parsed PDF data with text content
 */
async function extractTextFromPDF(pdfBuffer) {
  try { //start error handling 
    console.log('Parsing PDF...'); //debug line
    
    const data = await pdfParse(pdfBuffer); //data will store the information parsed. text, page num, pdf info, metadeta.
    
    console.log(`PDF parsed successfully`); //debug line 
    console.log(`Pages: ${data.numpages}`); //debug line - logs number of pages 
    console.log(`Text length: ${data.text.length} characters`); //debug line - logs how many characters of text
    
    // checking for text on pdf. whether pdf has no text, or too little to process. (under 100 character)
    if (!data.text || data.text.trim().length < 100) {
      throw new Error('PDF appears to be empty or is a scanned image. Please use a text-based PDF or OCR your document first.');
    }
    
    return {  //returns an object
      text: data.text, 
      numpages: data.numpages,
      info: data.info,
      metadata: data.metadata
    }; 
  } catch (error) { //if parsing fails 
    console.error('PDF parsing error:', error);
    
    if (error.message.includes('Invalid PDF')) { //if invalid file type. 
      throw new Error('Invalid PDF file. Please ensure the file is a valid PDF document.');
    }
    
    throw new Error(`Failed to parse PDF: ${error.message}`); // any other errors. 
  }
}

/**
 * validate PDF file
 * @param {Buffer} buffer file buffer
 * @returns {Boolean} true if valid PDF
 */
function isValidPDF(buffer) {
  const pdfHeader = buffer.slice(0, 4).toString(); //takes the file header. (first 4 bytes)
  return pdfHeader === '%PDF'; //return true if it matches. PDF header starts with %PDF
}

/**
 * get PDF file size in MB
 * @param {Buffer} buffer file buffer
 * @returns {Number} size in MB
 */
function getFileSizeMB(buffer) {
  return (buffer.length / (1024 * 1024)).toFixed(2); //Byte to MB conversion
}

//export function to other files.
module.exports = {
  extractTextFromPDF,
  isValidPDF,
  getFileSizeMB
};
