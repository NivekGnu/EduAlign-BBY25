//Import Grok so you can call their API
const Groq = require('groq-sdk');

// Initialize Groq
const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Analyze curriculum and map to Level 1 competencies.
 * @param {String} pdfText Extracted text from PDF
 * @param {Array} competencies List of competencies to map
 * @returns {Promise<Object>} Analysis result with mappings and missing criteria
 */
async function analyzeCurriculum(pdfText, competencies) {
    //Try block prevents entire server from crashing if API fails
  try {
    console.log('🤖 Starting Groq AI analysis...');  //Debug line. 
    
    const prompt = buildPrompt(pdfText, competencies); //Calling function defined below
    
    console.log('   Sending request to Groq API...'); //Debug Line.
    
    const completion = await groq.chat.completions.create({  //Sends the AI request. 
      messages: [
        {
          role: "system",  //controls behavior. 
          content: "You are an expert at analyzing training curricula and mapping them to competency frameworks. Always respond with valid JSON only, no markdown or explanations."
        },
        {
          role: "user",  //actual request
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile", 
      temperature: 0.3, //randomness of AI. 0.0 = deterministic, 1.0 = creative. 
      max_tokens: 8000, //we are limiting the AI response to 8000 
      response_format: { type: "json_object" } //response format must be JSON
    });
    
    console.log('   Response received, parsing...'); //debug line
    
    const responseText = completion.choices[0].message.content; //parsing response here. 
    const analysis = JSON.parse(responseText);
    
    console.log(`✅ Analysis complete`);
    console.log(`   Mappings found: ${analysis.mappings ? analysis.mappings.length : 0}`); //validity checking return 0 if mapping not found
    console.log(`   Missing criteria: ${analysis.missing ? analysis.missing.length : 0}`); //validity checking return 0 if mapping not found
    
    return analysis; //returns the curriculum analysis 
 
  } catch (error) { //catch API, limit, and usability errors. 
    console.error('❌ Groq analysis error:', error); 
    
    if (error.message.includes('rate limit')) {
      throw new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
    }
    
    if (error.message.includes('API key')) {
      throw new Error('Invalid Groq API key. Please check your configuration.');
    }
    
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

/**
 * Puts together a prompt for the AI 
 * @param {String} pdfText PDF content
 * @param {Array} competencies Competencies list
 * @returns {String} Formatted prompt
 */
function buildPrompt(pdfText, competencies) {
  //PDF text limited to ~30k characters for Groq
  const limitedText = pdfText.substring(0, 30000);
  
  //loops through the array, numbers, and joins them. 
  const competencyList = competencies.map((c, i) => 
    `${i + 1}. ${c.text}`
  ).join('\n');
  
  return `You are analyzing a training course curriculum document to map it to WorkSafeBC asbestos abatement training competencies (Level 1 Certification).

**COURSE CONTENT:**
${limitedText}

**COMPETENCIES TO MAP:**
${competencyList}

**YOUR TASK:**
For each competency, identify:
1. WHERE in the course material this competency is covered (specific section, page number, or resource name)
2. HOW it is taught (lecture, demonstration, hands-on practice, video, discussion, case study, or other)
3. HOW it is assessed (written exam, practical test, quiz, observation, project/assignment, other, or not assessed)

If a competency is NOT adequately covered in the course material, mark it as MISSING.

**RESPOND WITH ONLY THIS JSON FORMAT (pure JSON, no markdown):**
{
  "mappings": [
    {
      "competencyIndex": 1,
      "where": "Section 2.3, Pages 45-47; Training Video Module 3",
      "howTaught": "Lecture and Video",
      "howAssessed": "Written exam and Quiz"
    }
  ],
  "missing": [
    "Competency #5: Describe the abatement process - not found in curriculum"
  ]
}

**IMPORTANT RULES:**
- Be specific about locations (page numbers, section names, module titles)
- Only mark as MISSING if truly absent or insufficiently covered
- Return ONLY valid JSON, no explanatory text
- Include ALL competencies in either mappings or missing`;
}

/**
 * Get ALL Level 1 competencies with accurate rowIndex from the template
 * Row numbers are 1-based from the Excel sheet.
 * Only includes actual competency rows (skips headers like section titles).
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

//makes function usable in other files. 
module.exports = {
  analyzeCurriculum,
  getLevel1Competencies
};