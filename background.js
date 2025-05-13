chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "getAIValue") {
    const { label, context, pageContext, documentContent } = request;
    chrome.storage.local.get("openaiApiKey", async (data) => {
      const apiKey = data.openaiApiKey;
      if (!apiKey) {
        sendResponse({ error: "API key not set." });
        return;
      }

      // Determine if this is likely a text area based on context or label
      const isTextarea = context?.fieldType === 'essay' || 
                        label.toLowerCase().includes('describe') || 
                        label.toLowerCase().includes('explain') ||
                        label.length > 50;

      // Create a more intelligent prompt based on the field context
      let prompt = `Generate a realistic example value for a form field labeled: "${label}"`;
      
      // Add document context if available
      if (documentContent) {
        // Limit document content to avoid token limits
        const limitedDocContent = documentContent.length > 2000 ? 
          documentContent.substring(0, 2000) + "..." : documentContent;
        
        prompt += `\n\nUse the following document as context when generating your response. 
        Extract any relevant information that would help answer this form field:
        
        DOCUMENT CONTENT:
        ${limitedDocContent}`;
      }
      
      // Add form context information
      if (pageContext) {
        if (pageContext.headings && pageContext.headings.length > 0) {
          prompt += `\n\nForm headings: ${pageContext.headings.join(" | ")}`;
        }
        
        if (pageContext.companyName) {
          prompt += `\nCompany/Organization: ${pageContext.companyName}`;
        }
        
        if (pageContext.url) {
          prompt += `\nForm URL: ${pageContext.url}`;
        }
        
        if (pageContext.title) {
          prompt += `\nPage Title: ${pageContext.title}`;
        }
        
        if (pageContext.labels && pageContext.labels.length > 0) {
          prompt += `\nOther form labels: ${pageContext.labels.slice(0, 10).join(" | ")}`;
        }
        
        if (pageContext.questions && pageContext.questions.length > 0) {
          prompt += `\nQuestions on the page: ${pageContext.questions.slice(0, 5).join(" | ")}`;
        }
      }
      
      // Add information about the form type and context
      if (context) {
        if (context.formType) {
          prompt += `\nForm type: ${context.formType}`;
        }
        
        if (context.formTopic) {
          prompt += `\nForm topic: ${context.formTopic}`;
        }
        
        if (context.isPositiveFeedback !== null) {
          prompt += `\nThis appears to be a ${context.isPositiveFeedback ? 'positive' : 'general'} feedback form.`;
        }
        
        if (context.isQuestionForm) {
          prompt += `\nThis appears to be a questionnaire or survey.`;
        }
        
        // Request variation if previous responses have been used
        if (context.requestVariation && context.previouslyUsed) {
          prompt += `\nPROVIDE A DIFFERENT RESPONSE THAN BEFORE. Be creative and write a new response with different wording and perspective.`;
        }
        
        // Avoid duplicating previous responses
        if (context.usedResponses && context.usedResponses.length > 0) {
          prompt += `\nDO NOT provide any of these previously used responses: 
          ${context.usedResponses.slice(0, 3).join("\n---\n")}`;
        }
      }
      
      // Different instruction for textareas vs regular inputs
      if (isTextarea) {
        prompt += `\n\nThis is a larger text area field, so please provide a few sentences or a paragraph that would be appropriate as a response. Make it realistic, professional, and contextually appropriate. Focus on being specific and concise.`;
      } else {
        prompt += `\n\nProvide just the value with no explanations. Keep it brief and appropriate for the field type.`;
      }

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",  // Using the improved model for better context understanding
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: isTextarea ? 1000 : 150 // Allow more tokens for textarea responses
          })
        });

        const result = await response.json();
        
        if (result.error) {
          console.error("OpenAI API error:", result.error);
          sendResponse({ error: "API request failed: " + result.error.message });
          return;
        }
        
        const answer = result.choices?.[0]?.message?.content?.trim() || 
                      (isTextarea ? "Sample response for this text area." : "AI response");
        
        // For non-textareas, try to extract just the value without explanation
        let cleanedAnswer = answer;
        if (!isTextarea && answer.length > 50) {
          // Extract just the first line or sentence if the AI gave an explanation
          cleanedAnswer = answer.split('\n')[0].split('.')[0].trim();
        }
        
        sendResponse({ value: cleanedAnswer });
      } catch (err) {
        console.error("API request error:", err);
        sendResponse({ error: "API request failed." });
      }
    });
    return true;
  } else if (request.action === "getAIFieldResponse") {
    const { field, pageContext } = request;
    chrome.storage.local.get("openaiApiKey", async (data) => {
      const apiKey = data.openaiApiKey;
      if (!apiKey) {
        sendResponse({ error: "API key not set." });
        return;
      }

      // Build a prompt for the AI to respond to the field
      let prompt = `Generate an appropriate response for the following form field or question: "${field.label}"`;
      
      // Add context about the field type
      if (field.context?.fieldType) {
        prompt += `\nField type: ${field.context.fieldType}`;
      }
      
      // Add page context
      if (pageContext) {
        prompt += `\n\nForm context:
        Page title: ${pageContext.title || 'Unknown'}
        URL: ${pageContext.url || 'Unknown'}
        Company/Organization: ${pageContext.companyName || 'Unknown'}`;
        
        if (pageContext.headings && pageContext.headings.length > 0) {
          prompt += `\nForm headings: ${pageContext.headings.join(" | ")}`;
        }
      }

      // Add instructions based on field type
      if (field.context?.fieldType === 'question') {
        prompt += `\n\nProvide a thoughtful, professional answer to this question. Be specific and concise.`;
      } else if (field.context?.fieldType === 'essay') {
        prompt += `\n\nWrite a thoughtful, professional response for this essay-type field. Use specific examples where appropriate. Keep it reasonably concise but comprehensive.`;
      }

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1000
          })
        });

        const result = await response.json();
        
        if (result.error) {
          console.error("OpenAI API error:", result.error);
          sendResponse({ error: "API request failed: " + result.error.message });
          return;
        }
        
        const value = result.choices?.[0]?.message?.content?.trim() || 
                     "I would be an excellent fit for this position due to my relevant experience and passion for the field.";
        
        sendResponse({ value });
      } catch (err) {
        console.error("API request error:", err);
        sendResponse({ error: "API request failed." });
      }
    });
    return true;
  } else if (request.action === "getAIFieldResponseWithDocument") {
    const { field, documentContent, pageContext } = request;
    chrome.storage.local.get("openaiApiKey", async (data) => {
      const apiKey = data.openaiApiKey;
      if (!apiKey) {
        sendResponse({ error: "API key not set." });
        return;
      }

      // Limit document content to avoid token limits
      const limitedDocContent = documentContent.length > 3000 ? 
        documentContent.substring(0, 3000) + "..." : documentContent;

      // Build a prompt for the AI to respond to the field using document content
      let prompt = `Generate an appropriate response for the following form field: "${field.label}"

Based on the provided document, extract relevant information and formulate a response that accurately reflects the information in the document.

DOCUMENT CONTENT:
${limitedDocContent}`;
      
      // Add context about the field type
      if (field.context?.fieldType) {
        prompt += `\n\nField type: ${field.context.fieldType}`;
      }
      
      // Add page context
      if (pageContext) {
        prompt += `\n\nForm context:
        Page title: ${pageContext.title || 'Unknown'}
        URL: ${pageContext.url || 'Unknown'}
        Company/Organization: ${pageContext.companyName || 'Unknown'}`;
      }

      // Add final instructions
      prompt += `\n\nProvide a professional response based on the document information. Be specific and concise while accurately using the document's information.`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,  // Lower temperature for more faithful extraction from documents
            max_tokens: 1000
          })
        });

        const result = await response.json();
        
        if (result.error) {
          console.error("OpenAI API error:", result.error);
          sendResponse({ error: "API request failed: " + result.error.message });
          return;
        }
        
        const value = result.choices?.[0]?.message?.content?.trim() || 
                     "Based on the provided document, I believe I would be an excellent fit for this position.";
        
        sendResponse({ value });
      } catch (err) {
        console.error("API request error:", err);
        sendResponse({ error: "API request failed." });
      }
    });
    return true;
  } else if (request.action === "getAIResponse") {
    const { question, context } = request;
    chrome.storage.local.get("openaiApiKey", async (data) => {
      const apiKey = data.openaiApiKey;
      if (!apiKey) {
        sendResponse({ error: "API key not set." });
        return;
      }

      // Build a prompt for the AI to respond to the question
      let prompt = `Answer the following question: "${question}"`;
      
      // Add any context information that might be helpful
      if (context) {
        prompt += `\n\nContext:
        Page title: ${context.pageTitle || 'Unknown'}
        URL: ${context.pageUrl || 'Unknown'}`;
        
        if (context.formContext) {
          if (context.formContext.companyName) {
            prompt += `\nCompany/Organization: ${context.formContext.companyName}`;
          }
          
          if (context.formContext.headings && context.formContext.headings.length > 0) {
            prompt += `\nForm headings: ${context.formContext.headings.join(" | ")}`;
          }
        }
      }

      // Add final instructions
      prompt += `\n\nProvide a helpful, professional response to this question. Be clear, specific, and concise.`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 800
          })
        });

        const result = await response.json();
        
        if (result.error) {
          console.error("OpenAI API error:", result.error);
          sendResponse({ error: "API request failed: " + result.error.message });
          return;
        }
        
        const answer = result.choices?.[0]?.message?.content?.trim() || 
                      "I don't have enough information to answer that question accurately.";
        
        sendResponse({ answer });
      } catch (err) {
        console.error("API request error:", err);
        sendResponse({ error: "API request failed." });
      }
    });
    return true;
  } else if (request.action === "getAIResponseWithDocument") {
    const { question, documentContent, context } = request;
    chrome.storage.local.get("openaiApiKey", async (data) => {
      const apiKey = data.openaiApiKey;
      if (!apiKey) {
        sendResponse({ error: "API key not set." });
        return;
      }

      // Limit document content to avoid token limits
      const limitedDocContent = documentContent.length > 3000 ? 
        documentContent.substring(0, 3000) + "..." : documentContent;

      // Build a prompt for the AI to respond to the question using document content
      let prompt = `Answer the following question based on the provided document: "${question}"

DOCUMENT CONTENT:
${limitedDocContent}`;
      
      // Add any context information that might be helpful
      if (context) {
        prompt += `\n\nAdditional context:
        Page title: ${context.pageTitle || 'Unknown'}
        URL: ${context.pageUrl || 'Unknown'}`;
      }

      // Add final instructions
      prompt += `\n\nProvide an answer that accurately reflects the information in the document. Be clear, specific, and concise. If the document doesn't contain information related to the question, state that clearly.`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,  // Lower temperature for more accurate information extraction
            max_tokens: 800
          })
        });

        const result = await response.json();
        
        if (result.error) {
          console.error("OpenAI API error:", result.error);
          sendResponse({ error: "API request failed: " + result.error.message });
          return;
        }
        
        const answer = result.choices?.[0]?.message?.content?.trim() || 
                      "Based on the document, I don't have enough information to answer that question accurately.";
        
        sendResponse({ answer });
      } catch (err) {
        console.error("API request error:", err);
        sendResponse({ error: "API request failed." });
      }
    });
    return true;
  }
});

// Function to extract relevant text from PDF documents
async function extractPdfText(pdfArrayBuffer) {
  // Check if PDF.js is already loaded, if not load it dynamically
  if (typeof pdfjsLib === 'undefined') {
    // This would require having PDF.js files accessible or loading from CDN
    // For simplicity, we'll just return a placeholder message
    return "PDF TEXT EXTRACTION PLACEHOLDER - Actual implementation would require PDF.js integration";
  }
  
  try {
    const pdf = await pdfjsLib.getDocument({data: pdfArrayBuffer}).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return "Error extracting PDF text: " + error.message;
  }
}

// Function to extract text from Word documents (basic implementation)
async function extractWordText(docArrayBuffer) {
  // This would require a library like mammoth.js
  // For simplicity, we'll just return a placeholder message
  return "WORD DOCUMENT TEXT EXTRACTION PLACEHOLDER - Actual implementation would require mammoth.js integration";
}

// Setup communication with content scripts
chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Form Assistant extension installed");
  
  // Set default API key for development/testing - REMOVE IN PRODUCTION
  // chrome.storage.local.set({ openaiApiKey: "YOUR_API_KEY_HERE" });
});

// Add option to handle file uploads through a context menu
chrome.contextMenus.create({
  id: "uploadDocumentContext",
  title: "Upload Document for Form Context",
  contexts: ["page"]
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "uploadDocumentContext") {
    chrome.tabs.sendMessage(tab.id, { action: "showDocumentUpload" });
  }
});