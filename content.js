// Identify if text is a question that needs answering rather than a form field
function isQuestion(text) {
  text = text.trim().toLowerCase();
  
  // Check if it ends with a question mark
  if (text.endsWith('?')) return true;
  
  // Check if it starts with question words
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'can', 'could', 'will', 'would', 'do', 'does', 'is', 'are'];
  for (const word of questionWords) {
    if (text.startsWith(word + ' ')) return true;
  }
  
  return false;
}

// Enhanced function to get appropriate value based on field context
async function getSmartValue(label, context = {}) {
  const l = label.toLowerCase();
  
  // If we have uploaded document context, try to extract relevant information
  if (context.documentContent) {
    const response = await getAIResponseWithDocumentContext(label, context.documentContent, context);
    if (response) return response;
  }
  
  // Handle typical form fields with mock data
  if (l.includes("email")) return "example@example.com";
  if (l.includes("name") && !l.includes("user")) return "John Doe";
  if (l.includes("phone") || l.includes("tel")) return "123-456-7890";
  if (l.includes("address")) return "123 AI Street";
  if (l.includes("city")) return "San Francisco";
  if (l.includes("zip") || l.includes("postal")) return "94107";
  if (l.includes("country")) return "USA";
  if (l.includes("company")) return "OpenAI";
  if (l.includes("website") || l.includes("url")) return "https://example.com";
  
  // For non-standard fields, provide customized responses based on the field label
  
  // Elevator pitch or "what are you building" questions
  if (l.includes("elevator pitch") || l.includes("what are you building")) {
    return "I'm building an AI-powered educational platform that helps students learn at their own pace through personalized curriculum and interactive exercises. It uses machine learning to adapt to each student's strengths and weaknesses, making learning more efficient and engaging.";
  }
  
  // Milestone or achievement questions
  if (l.includes("milestone") || l.includes("achievement") || l.includes("accomplished")) {
    return "I successfully led a team that launched a mobile app with 100,000+ downloads in the first month. I also redesigned a customer service process that reduced response time by 40% while improving satisfaction ratings. Recently, I completed an advanced certification in my field and mentored three junior team members to promotion.";
  }
  
  // Skills questions
  if (l.includes("skill") || l.includes("proficient") || l.includes("expertise")) {
    return "My core skills include full-stack development (JavaScript/React/Node.js), data analysis using Python and SQL, and project management with agile methodologies. I'm also experienced in customer research, A/B testing, and have strong communication skills demonstrated through presentations to technical and non-technical stakeholders.";
  }
  
  // Handle feedback and rating questions
  if (l.includes("rate") || l.includes("rating") || l.includes("score")) {
    if (context.formType === 'satisfaction' || context.isPositiveFeedback) {
      return "5"; // Highest rating for positive feedback
    } else {
      return "4"; // Slightly positive rating for general feedback
    }
  }
  
  if (l.includes("feedback") || l.includes("comment") || l.includes("suggestion")) {
    if (context.formType === 'product') {
      return "The product is intuitive and solved my specific needs efficiently. I particularly value the attention to detail in the user interface and the robust feature set. One suggestion would be to add more customization options for power users.";
    } else if (context.formType === 'service') {
      return "The service exceeded my expectations. Staff was responsive, knowledgeable, and went the extra mile to ensure my satisfaction. The follow-up communication was especially appreciated.";
    } else {
      return "My experience has been very positive. The combination of quality, efficiency, and attention to detail stands out. I particularly appreciated the thoughtful approach to solving my specific needs.";
    }
  }
  
  // For questions or essay-type fields that don't match the above patterns,
  // use the AI to generate a response
  try {
    return await getAIResponseForField(label, {
      fieldType: isQuestion(label) ? 'question' : 'essay',
      ...context
    });
  } catch (error) {
    console.error("Error getting AI response for field:", error);
    
    // If AI call fails, provide field-specific fallbacks based on common patterns
    
    // Why questions - motivation, reasons
    if (l.includes("why") || l.includes("reason") || l.includes("motivation")) {
      return "I'm drawn to this opportunity because it aligns with my passion for innovation and problem-solving. The chance to work with a forward-thinking team on meaningful challenges is exactly what I'm looking for in my next role.";
    }
    
    // How questions - process, approach
    if (l.includes("how would you") || l.includes("approach to")) {
      return "I would approach this systematically by first gathering requirements and understanding key stakeholders' needs. Then I'd research best practices, develop a strategic plan with measurable goals, implement in phases with regular feedback loops, and continuously iterate based on results and learnings.";
    }
    
    // Description questions
    if (l.includes("describe") || l.includes("tell us about") || l.includes("share") || l.includes("provide")) {
      return "Throughout my career, I've focused on combining analytical thinking with creative problem-solving. I believe in collaborative approaches that leverage diverse perspectives, while maintaining clear accountability for outcomes. My work is characterized by attention to detail without losing sight of the bigger strategic picture.";
    }
    
    // Default response as absolute last resort
    return "I bring a combination of relevant experience, technical skills, and collaborative mindset to this opportunity. I'm particularly excited about the potential to contribute to innovative solutions while continuing to develop professionally in a dynamic environment.";
  }
}

// Function to request an AI-generated response for form fields
async function getAIResponseForField(fieldLabel, fieldContext = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "getAIFieldResponse",
      field: {
        label: fieldLabel,
        context: fieldContext
      },
      pageContext: extractFormContext()
    }, (response) => {
      if (response && response.value) {
        resolve(response.value);
      } else {
        reject(new Error("Failed to get AI field response"));
      }
    });
  });
}

// Function to get AI response using uploaded document context
async function getAIResponseWithDocumentContext(fieldLabel, documentContent, additionalContext = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "getAIFieldResponseWithDocument",
      field: {
        label: fieldLabel,
        context: additionalContext
      },
      documentContent: documentContent,
      pageContext: extractFormContext()
    }, (response) => {
      if (response && response.value) {
        resolve(response.value);
      } else {
        reject(new Error("Failed to get AI response with document context"));
      }
    });
  });
}

// Generate contextual answers to questions - using AI to interpret the question
async function generateAnswerToQuestion(question, documentContent = null) {
  // Only handle very basic queries locally for immediate response
  question = question.toLowerCase().trim();
  
  if (question.includes("how are you") || question.includes("how do you feel")) {
    return "I'm an AI assistant designed to help with forms. I don't have feelings, but I'm ready to assist you!";
  }
  
  if (question.includes("what is your name") || question.includes("who are you")) {
    return "I'm an AI form assistant that helps fill out forms and answer questions.";
  }
  
  if (question.includes("help") || question.includes("how does this work")) {
    return "I can automatically fill form fields or answer questions. For forms, I'll provide appropriate responses based on the field context.";
  }
  
  // For all other questions, use the AI backend to generate a contextual response
  try {
    // If we have document content, use it for answering
    if (documentContent) {
      return await getAIResponseForQuestionWithDocument(question, documentContent);
    } else {
      return await getAIResponseForQuestion(question);
    }
  } catch (error) {
    console.error("Error getting AI response:", error);
    // Fallback response if AI call fails
    return "I'm interested in this opportunity because it aligns with my skills and values. I have relevant experience and am excited about the chance to contribute while continuing my professional development.";
  }
}

// Function to request an answer from the AI backend
async function getAIResponseForQuestion(question) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "getAIResponse",
      question: question,
      context: {
        pageTitle: document.title,
        pageUrl: window.location.href,
        formContext: extractFormContext()
      }
    }, (response) => {
      if (response && response.answer) {
        resolve(response.answer);
      } else {
        reject(new Error("Failed to get AI response"));
      }
    });
  });
}

// Function to request an answer from the AI backend with document context
async function getAIResponseForQuestionWithDocument(question, documentContent) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "getAIResponseWithDocument",
      question: question,
      documentContent: documentContent,
      context: {
        pageTitle: document.title,
        pageUrl: window.location.href,
        formContext: extractFormContext()
      }
    }, (response) => {
      if (response && response.answer) {
        resolve(response.answer);
      } else {
        reject(new Error("Failed to get AI response with document"));
      }
    });
  });
}

// Extract relevant context from the current form/page
function extractFormContext() {
  // Get all visible text on the page to provide context
  const bodyText = document.body.innerText;
  
  // Get form title or nearby headings
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map(h => h.innerText.trim())
    .filter(text => text.length > 0)
    .slice(0, 3);  // Take up to 3 headings for context
  
  // Get labels from the form
  const labels = Array.from(document.querySelectorAll('label'))
    .map(label => label.innerText.trim())
    .filter(text => text.length > 0);
  
  // Extract all questions from the page
  const questions = [];
  const paragraphs = document.querySelectorAll('p, div, label, span');
  for (const para of paragraphs) {
    const text = para.innerText.trim();
    if (isQuestion(text)) {
      questions.push(text);
    }
  }
  
  // Look for company name or organization
  const companyElements = document.querySelectorAll('.company, .organization, .brand, header img[alt]');
  let companyName = '';
  if (companyElements.length > 0) {
    const element = companyElements[0];
    companyName = element.alt || element.innerText || '';
  }
  
  return {
    headings,
    labels,
    questions, // New field to capture all questions on the page
    companyName,
    url: window.location.href,
    title: document.title
  };
}

// Enhanced function to get the context of the form
function analyzeFormContext() {
  const pageText = document.body.innerText.toLowerCase();
  const context = {
    formType: null,
    isPositiveFeedback: null,
    isQuestionForm: false,
    formTopic: null
  };
  
  // Determine form type
  if (pageText.includes("satisfaction") || pageText.includes("how was your experience")) {
    context.formType = 'satisfaction';
  } else if (pageText.includes("product") && (pageText.includes("review") || pageText.includes("feedback"))) {
    context.formType = 'product';
  } else if (pageText.includes("service") && (pageText.includes("review") || pageText.includes("feedback"))) {
    context.formType = 'service';
  } else if (pageText.includes("contact us") || pageText.includes("get in touch")) {
    context.formType = 'contact';
  } else if (pageText.includes("application") || pageText.includes("resume") || pageText.includes("cv")) {
    context.formType = 'job_application';
  } else if (pageText.includes("survey") || pageText.includes("questionnaire")) {
    context.formType = 'survey';
  }
  
  // Check if it's a positive feedback form
  context.isPositiveFeedback = pageText.includes("what did you like") || 
    pageText.includes("positive aspects") || 
    pageText.includes("what went well");
  
  // Check if it's mainly questions rather than a traditional form
  const questionMarks = (pageText.match(/\?/g) || []).length;
  context.isQuestionForm = questionMarks > 3; // If multiple question marks, likely a questionnaire
  
  // Try to determine form topic
  if (pageText.includes("job") && (pageText.includes("apply") || pageText.includes("application"))) {
    context.formTopic = 'job application';
  } else if (pageText.includes("volunteer") || pageText.includes("volunteering")) {
    context.formTopic = 'volunteer application';
  } else if (pageText.includes("scholarship") || pageText.includes("grant")) {
    context.formTopic = 'scholarship application';
  } else if (pageText.includes("conference") || pageText.includes("event")) {
    context.formTopic = 'event registration';
  }
  
  return context;
}

// Enhanced function to get label text with more context
function getLabelText(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText.trim();
  }

  // Check for aria-label attribute
  if (input.getAttribute('aria-label')) {
    return input.getAttribute('aria-label');
  }
  
  // Check for placeholders as they often contain question hints
  if (input.placeholder && input.placeholder.length > 3) {
    return input.placeholder;
  }
  
  // Check for adjacent text that might be a label
  let el = input.closest("div, td, tr, section, form");
  while (el) {
    const label = el.querySelector("label");
    if (label && label.innerText.trim().length > 2) return label.innerText.trim();

    const textNodes = Array.from(el.childNodes).filter(n =>
      n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 4
    );
    if (textNodes.length > 0) return textNodes[0].textContent.trim();
    
    // Check for heading elements near the input
    const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
    for (const heading of headings) {
      if (heading.innerText.trim().length > 2) {
        return heading.innerText.trim();
      }
    }

    el = el.parentElement;
  }

  // Check siblings that might contain text
  const prevSibling = input.previousElementSibling;
  if (prevSibling && prevSibling.innerText && prevSibling.innerText.trim().length > 2) {
    return prevSibling.innerText.trim();
  }
  
  // Look for question text above the input
  let previousElement = input.previousElementSibling;
  while (previousElement) {
    if (previousElement.tagName === 'P' || previousElement.tagName === 'DIV' || previousElement.tagName === 'SPAN') {
      const text = previousElement.innerText.trim();
      if (text.length > 5) {
        return text;
      }
    }
    previousElement = previousElement.previousElementSibling;
  }

  return input.name || input.placeholder || "unknown field";
}

// Enhanced function to fill fields with context awareness
async function fillField(input, documentContext = null) {
  const label = getLabelText(input);
  console.log("Analyzing field with label:", label);
  
  // Get form context
  const context = analyzeFormContext();
  
  // Add document context if available
  if (documentContext) {
    context.documentContent = documentContext;
  }
  
  // Important: Track which responses have been used to avoid duplication
  if (!window.usedResponses) {
    window.usedResponses = new Set();
  }
  
  try {
    // Get appropriate value based on field and context
    let smartValue = await getSmartValue(label, context);
    
    // If the exact same response has been used before, try to get a new one
    // by adding a request for variation
    if (window.usedResponses.has(smartValue)) {
      try {
        const variationContext = {
          ...context,
          requestVariation: true,
          previouslyUsed: true
        };
        const alternativeValue = await getAIResponseForField(label, variationContext);
        if (alternativeValue && alternativeValue !== smartValue) {
          smartValue = alternativeValue;
        }
      } catch (error) {
        console.warn("Could not get variation, using original value");
      }
    }
    
    // Add this response to the set of used responses
    if (smartValue && smartValue.length > 20) {  // Only track substantial responses
      window.usedResponses.add(smartValue);
    }
    
    if (smartValue) {
      input.value = smartValue;
      // Trigger input event to ensure any listeners know the value changed
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // If no smart value is available locally, request from the backend
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: "getAIValue", 
          label,
          context: {
            ...context,
            usedResponses: Array.from(window.usedResponses)  // Pass used responses to avoid duplicates
          },
          pageContext: extractFormContext(),
          documentContent: documentContext
        }, (response) => {
          if (response?.value) {
            input.value = response.value;
            // Track this response
            if (response.value.length > 20) {
              window.usedResponses.add(response.value);
            }
            // Trigger input event
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          resolve();
        });
      });
    }
  } catch (error) {
    console.error("Error filling field:", error);
    // Handle error gracefully
  }
}

// Main function to handle form filling
async function processFormWithAI(documentContent = null) {
  const inputs = document.querySelectorAll("input, textarea, select");
  const context = analyzeFormContext();
  const promises = [];

  for (const input of inputs) {
    const tag = input.tagName.toLowerCase();
    const type = input.type;

    if (["text", "email", "tel", "url", "number"].includes(type) || tag === "textarea") {
      promises.push(fillField(input, documentContent));
    } else if (["checkbox", "radio"].includes(type)) {
      const label = getLabelText(input);
      
      // Make intelligent decisions about checkboxes/radio buttons
      if (context.isPositiveFeedback || 
          label.toLowerCase().includes("agree") || 
          label.toLowerCase().includes("yes")) {
        input.checked = true;
      } else if (label.toLowerCase().includes("disagree") || 
                label.toLowerCase().includes("no")) {
        input.checked = false;
      } else {
        // For neutral options or when context is unclear
        input.checked = Math.random() > 0.5;
      }
    } else if (tag === "select") {
      // Try to select a meaningful option instead of just index 1
      const options = Array.from(input.options);
      const label = getLabelText(input);
      
      // If it's a rating select box, choose based on context
      if (label.toLowerCase().includes("rate") || label.toLowerCase().includes("score")) {
        const highOption = options.find(opt => 
          opt.text.includes("5") || 
          opt.text.toLowerCase().includes("excellent") || 
          opt.text.toLowerCase().includes("best")
        );
        
        if (highOption && context.isPositiveFeedback) {
          input.value = highOption.value;
        } else {
          // Choose middle option for neutral
          input.selectedIndex = Math.floor(options.length / 2);
        }
      } else {
        // Default to second option if available (skip "Please select")
        input.selectedIndex = options.length > 1 ? 1 : 0;
      }
    }
  }

  await Promise.all(promises);
  return { success: true, context };
}

// Add document upload functionality
function createDocumentUploadUI() {
  // Create the upload UI container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.backgroundColor = '#f8f9fa';
  container.style.padding = '15px';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  container.style.zIndex = '10000';
  container.style.width = '300px';
  
  // Add header
  const header = document.createElement('h3');
  header.textContent = 'AI Form Assistant';
  header.style.marginTop = '0';
  header.style.marginBottom = '15px';
  container.appendChild(header);
  
  // Add file input
  const fileLabel = document.createElement('p');
  fileLabel.textContent = 'Upload document for context:';
  fileLabel.style.marginBottom = '5px';
  container.appendChild(fileLabel);
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'ai-assistant-document';
  fileInput.accept = '.txt,.pdf,.doc,.docx,.rtf';
  fileInput.style.marginBottom = '15px';
  container.appendChild(fileInput);
  
  // Add process button
  const processButton = document.createElement('button');
  processButton.textContent = 'Fill Form with Document Context';
  processButton.style.padding = '8px 15px';
  processButton.style.backgroundColor = '#4285f4';
  processButton.style.color = 'white';
  processButton.style.border = 'none';
  processButton.style.borderRadius = '4px';
  processButton.style.cursor = 'pointer';
  processButton.style.width = '100%';
  processButton.style.marginBottom = '10px';
  container.appendChild(processButton);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.padding = '5px 10px';
  closeButton.style.backgroundColor = '#f2f2f2';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '4px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.width = '100%';
  container.appendChild(closeButton);
  
  // Handle document processing
  processButton.addEventListener('click', async () => {
    const fileInput = document.getElementById('ai-assistant-document');
    if (fileInput.files.length === 0) {
      alert('Please select a document first');
      return;
    }
    
    processButton.textContent = 'Processing...';
    processButton.disabled = true;
    
    try {
      const file = fileInput.files[0];
      const documentContent = await readFileContent(file);
      await processFormWithAI(documentContent);
      processButton.textContent = 'Form Filled Successfully!';
      setTimeout(() => {
        processButton.textContent = 'Fill Form with Document Context';
        processButton.disabled = false;
      }, 3000);
    } catch (error) {
      console.error('Error processing document:', error);
      processButton.textContent = 'Error Processing Document';
      processButton.disabled = false;
    }
  });
  
  // Handle close button
  closeButton.addEventListener('click', () => {
    document.body.removeChild(container);
  });
  
  // Add to page
  document.body.appendChild(container);
}

// Helper function to read file content
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    if (file.type === 'application/pdf') {
      // For PDFs, we'd need to use PDF.js or similar to extract text
      // For now, just alert user that PDFs need server-side processing
      alert('PDF processing is handled on the server side');
      resolve("PDF CONTENT PLACEHOLDER - WILL BE PROCESSED ON SERVER");
    } else {
      reader.readAsText(file);
    }
  });
}

// Handle communication with the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fillForm") {
    processFormWithAI().then((result) => sendResponse(result));
    return true;
  } else if (message.action === "analyzeQuestion") {
    generateAnswerToQuestion(message.question).then(answer => {
      sendResponse({ answer });
    });
    return true;
  } else if (message.action === "showDocumentUpload") {
    createDocumentUploadUI();
    sendResponse({ success: true });
    return true;
  }
});