/**
 * @fileoverview Groq AI Curriculum Analyzer
 * 
 * Uses Groq API (llama-3.3-70b-versatile model) to analyze training curriculum
 * documents and map them to WorkSafeBC Level 1 asbestos abatement competencies.
 * 
 * AI analyzes curriculum text and returns:
 * - Mappings: Competencies covered (with where/how taught/how assessed)
 * - Missing criteria: Competencies not found or insufficiently covered
 */

// const Groq = require('groq-sdk');

// const groq = new Groq({ 
//   apiKey: process.env.GROQ_API_KEY
// });

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { MAX_INPUT_CHARACTERS, MAX_RESPONSE_TOKENS } = require('../config/constants');


/**
 * Analyze curriculum and map to Level 1 competencies using AI.
 * 
 * Workflow:
 * 1. Build prompt with curriculum text and competency list
 * 2. Send to Groq API with JSON response format
 * 3. Parse and validate JSON response
 * 4. Return mappings and missing criteria
 * 
 * @param {string} pdfText - Extracted text from curriculum PDFs (combined if multiple files)
 * @param {Array<{rowIndex: number, text: string}>} competencies - List of competencies from getLevel1Competencies
 * @returns {Promise<{mappings: Array<Object>, missingCriteria: Array<string>}>} Analysis results
 * @throws {Error} API rate limit exceeded
 * @throws {Error} Invalid API key
 * @throws {Error} AI analysis failure
 */
// async function analyzeCurriculum(pdfText, competencies) {
//   try {
//     console.log('Starting Groq AI analysis...'); 
    
//     const prompt = buildPrompt(pdfText, competencies);
    
//     console.log('Sending request to Groq API...');
    
//     const completion = await groq.chat.completions.create({
//       messages: [
//         {
//           role: "system",  // controls behavior. 
//           content: "You are an expert at analyzing training curricula and mapping them to competency frameworks. Always respond with valid JSON only, no markdown or explanations."
//         },
//         {
//           role: "user",  // actual request
//           content: prompt
//         }
//       ],
//       model: "llama-3.3-70b-versatile", 
//       temperature: 0.0, // randomness of AI. 0.0 = deterministic, 1.0 = creative. 
//       max_tokens: MAX_RESPONSE_TOKENS,
//       response_format: { type: "json_object" }
//     });
    
//     console.log('Response received, parsing...');
    
//     const responseText = completion.choices[0].message.content;
//     const analysis = JSON.parse(responseText);
    
//     console.log(`Analysis complete`);
//     console.log(`Mappings found: ${analysis.mappings ? analysis.mappings.length : 0}`); 
//     console.log(`Missing criteria: ${analysis.missingCriteria ? analysis.missingCriteria.length : 0}`);
    
//     return analysis;
 
//   } catch (error) { 
//     console.error('Groq analysis error:', error); 
    
//     if (error.message.includes('rate limit')) {
//       throw new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
//     }
    
//     if (error.message.includes('API key')) {
//       throw new Error('Invalid Groq API key. Please check your configuration.');
//     }
    
//     throw new Error(`AI analysis failed: ${error.message}`);
//   }
// }
async function analyzeCurriculum(pdfText, competencies) {
  try {
    const prompt = buildPrompt(pdfText, competencies);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6', // or claude-sonnet-4-6 for higher quality
      max_tokens: MAX_RESPONSE_TOKENS,
      temperature: 0,
      system: "You are an expert at analyzing training curricula and mapping them to competency frameworks. Always respond with valid JSON only, no markdown, no explanations, no preamble.",
      messages: [{ role: 'user', content: prompt }]
    });

    // Claude returns content as an array of blocks
    const responseText = message.content[0].text;

    // Strip accidental code fences just in case
    const cleaned = responseText.replace(/```json\s*|\s*```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    return analysis;
  } catch (error) {
    if (error.status === 429) throw new Error('Anthropic API rate limit exceeded. Please wait and try again.');
    if (error.status === 401) throw new Error('Invalid Anthropic API key. Please check your configuration.');
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

/**
 * Build AI prompt for curriculum analysis.
 * Includes curriculum text, competency list, and detailed instructions.
 * 
 * @param {string} pdfText - Curriculum text (truncated to MAX_INPUT_CHARACTERS to reduce tokens)
 * @param {Array<{rowIndex: number, text: string}>} competencies - Competency list
 * @returns {string} Formatted prompt for AI
 */
function buildPrompt(pdfText, competencies) {
  // be mindful of Groq daily token limit (free tier)
  const limitedText = pdfText.substring(0, MAX_INPUT_CHARACTERS);
  
  const competencyList = competencies.map((c, i) => 
    `${i + 1}. ${c.text}`
  ).join('\n');
  
  return `You are analyzing training course curriculum documents to map them to WorkSafeBC asbestos abatement training competencies (Level 1 Certification).

**COURSE CONTENTS:**
(Multiple files may be provided. Each file is separated by "========== FILE: filename ==========" markers)
${limitedText}

**COMPETENCIES TO MAP:**
${competencyList}

**YOUR TASK:**
Analyze which competencies are covered in the course material.

**For COVERED competencies, provide:**
1. WHERE: Include the resource/document name and page number(s) if applicable
2. HOW TAUGHT: Select EXACTLY ONE from these 5 options:
   - In-class: Instructor Presentation
   - Online: Resource Material
   - In-class: Demonstration
   - Online: Demonstration
   - Participant Activity
3. HOW ASSESSED: Select EXACTLY ONE from these 4 options:
   - In-class: Quiz
   - Online: Quiz
   - In-class: Practical Skills Observation
   - N / A

**For MISSING/NOT COVERED competencies:**
- Do NOT include in mappings
- List in missingCriteria with reason (e.g., "not found" or "insufficiently covered")

**RESPOND WITH ONLY THIS JSON FORMAT (pure JSON, no markdown):**
{
  "mappings": [
    {
      "competencyIndex": 1,
      "where": "Asbestos Awareness Waste Handling and Disposal Level 1 PDF, Pages 19-22",
      "howTaught": "In-class: Instructor Presentation",
      "howAssessed": "In-class: Quiz"
    },
    {
      "competencyIndex": 2,
      "where": "Student Workbook",
      "howTaught": "Online: Resource Material",
      "howAssessed": "Online: Quiz"
    }
  ],
  "missingCriteria": [
    "Competency #5: Describe the abatement process - not found in curriculum",
    "Competency #12: External expertise requirements - insufficiently covered"
  ]
}

**CRITICAL RULES:**
- Only include covered competencies in "mappings"
- Missing competencies go ONLY in "missingCriteria"
- Every competency must appear in either mappings OR missingCriteria (not both)
- Match capitalization and spacing EXACTLY for howTaught and howAssessed
- WHERE must include the filename (from FILE markers) and page numbers when available
- Return ONLY valid JSON, no explanatory text`;
}

/**
 * Get all Level 1 competencies with Excel row indices.
 * Returns 26 competencies total across 4 sections:
 * - Asbestos knowledge (8 competencies)
 * - Health effects (7 competencies)
 * - Workers Compensation Act and OHS Regulation (9 competencies)
 * - Waste transportation and disposal (2 competencies)
 * 
 * Note: Row numbers are 1-based and match Excel template.
 * 
 * @returns {Array<{rowIndex: number, text: string}>} List of all Level 1 competencies
 */
function getLevel1Competencies() {
  return [
    { rowIndex: 5,  text: 'Describe asbestos' },
    { rowIndex: 6,  text: 'Describe historical use of asbestos in building materials, industrial settings, and manufactured products' },
    { rowIndex: 7,  text: 'Describe the different types of asbestos-containing materials and associated hazards' },
    { rowIndex: 8,  text: 'Describe the abatement process and abatement work' },
    { rowIndex: 9,  text: 'Define asbestos-containing materials (ACMs)' },
    { rowIndex: 10, text: 'Distinguish between friable and non-friable ACMs' },
    { rowIndex: 11, text: 'Explain the purposes of hazardous material surveying and the sampling process' },
    { rowIndex: 12, text: 'Explain the purpose of air monitoring for asbestos, when it is required, and where to find the results' },
    
    // Health section (starts after row 13 header)
    { rowIndex: 14, text: 'List the primary routes of exposure to asbestos' },
    { rowIndex: 15, text: 'Describe the health effects of asbestos exposure (e.g., asbestosis, mesothelioma, lung cancer)' },
    { rowIndex: 16, text: 'Describe acceptable workplace and personal hygiene practices' },
    { rowIndex: 17, text: 'Explain the synergistic effects of asbestos exposure and other exposures (e.g., smoking)' },
    { rowIndex: 18, text: 'Explain what exposure limits are' },
    { rowIndex: 19, text: 'Explain the importance of health monitoring (e.g., pulmonary function test and/or annual chest x-rays)' },
    { rowIndex: 20, text: 'Explain how and when to access the WorkSafeBC Exposure Registry Program' },
    
    // Workers Compensation Act and OHS Regulation section (after row 21 header)
    { rowIndex: 22, text: 'Identify the roles and responsibilities of workers, supervisors, and employers under the Workers Compensation Act' },
    { rowIndex: 23, text: 'Identify when external expertise is required' },
    { rowIndex: 24, text: 'Identify sections of the OHS Regulation (Parts 6 and 20) that are associated with asbestos‑related work' },
    { rowIndex: 25, text: 'Explain their right to know about hazards in the workplace, right to participate in health and safety activities in the workplace, and right to refuse unsafe work' },
    { rowIndex: 26, text: 'Explain the “as low as reasonably achievable” (ALARA) principle' },
    { rowIndex: 27, text: 'Explain distinctions between low-, moderate-, and high-risk work procedures' },
    { rowIndex: 28, text: 'Explain the purpose of workplace orientations, including young and new worker orientation and training' },
    { rowIndex: 29, text: 'Explain how to contact WorkSafeBC, if required' },
    { rowIndex: 30, text: 'Discuss the purposes of exposure control plans, hazardous materials surveys, and safe work procedures' },
    
    // Waste transportation and disposal section (after row 31 header)
    { rowIndex: 32, text: 'Identify requirements for licence to transport' },
    { rowIndex: 33, text: 'Identify requirements for transporation of dangerous goods (TGD)' }
  ];
}

module.exports = {
  analyzeCurriculum,
  getLevel1Competencies
};