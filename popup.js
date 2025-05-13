document.addEventListener('DOMContentLoaded', () => {
  // Initialize global variables
  window.documentContent = null; // To store uploaded document content

  // Setup tab navigation
  setupTabs();

  // Load saved settings
  loadSettings();
  
  // Setup event listeners
  document.getElementById("saveKeyBtn").addEventListener("click", saveApiKey);
  document.getElementById("fillFormBtn").addEventListener("click", fillCurrentForm);
  document.getElementById("uploadBtn").addEventListener("click", () => document.getElementById("documentUpload").click());
  document.getElementById("documentUpload").addEventListener("change", handleDocumentUpload);
  document.getElementById("askButton").addEventListener("click", askAI);
  document.getElementById("clearHistoryBtn").addEventListener("click", clearResponseHistory);
  
  // Initialize toggle listeners
  setupToggleListeners();
  
  // Show status message initially
  updateStatus();
});

// Tab navigation setup
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and content
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Show corresponding content
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get([
    "openaiApiKey", 
    "showFieldIcons", 
    "autoDetectForm", 
    "showSuggestions", 
    "smartDetection",
    "contextualResponses",
    "selectedModel",
    "responseVariation"
  ], (data) => {
    // Set API key if exists
    if (data.openaiApiKey) {
      document.getElementById("apiKey").value = data.openaiApiKey;
      document.getElementById("keyStatus").textContent = "API key set ✓";
      document.getElementById("keyStatus").style.color = "#2e7d32";
    }
    
    // Set toggle states based on saved preferences (default to true if not set)
    document.getElementById("showFieldIcons").checked = data.showFieldIcons !== false;
    document.getElementById("autoDetectForm").checked = data.autoDetectForm !== false;
    document.getElementById("showSuggestions").checked = data.showSuggestions !== false;
    document.getElementById("smartDetection").checked = data.smartDetection !== false;
    document.getElementById("contextualResponses").checked = data.contextualResponses !== false;
    
    // Set dropdown selections if previously saved
    if (data.selectedModel) {
      document.getElementById("modelSelector").value = data.selectedModel;
    }
    
    if (data.responseVariation) {
      document.getElementById("responseVariation").value = data.responseVariation;
    }
  });
}

// Setup toggle listeners to save changes
function setupToggleListeners() {
  const toggles = [
    "showFieldIcons", 
    "autoDetectForm", 
    "showSuggestions", 
    "smartDetection", 
    "contextualResponses"
  ];
  
  toggles.forEach(toggle => {
    document.getElementById(toggle).addEventListener("change", (e) => {
      const settingObj = {};
      settingObj[toggle] = e.target.checked;
      chrome.storage.local.set(settingObj);
    });
  });
  
  // Setup model selector and response variation listeners
  document.getElementById("modelSelector").addEventListener("change", (e) => {
    chrome.storage.local.set({ selectedModel: e.target.value });
  });
  
  document.getElementById("responseVariation").addEventListener("change", (e) => {
    chrome.storage.local.set({ responseVariation: e.target.value });
  });
}

function saveApiKey() {
  const key = document.getElementById("apiKey").value.trim();
  if (key) {
    chrome.storage.local.set({ openaiApiKey: key }, () => {
      document.getElementById("keyStatus").textContent = "API key saved ✓";
      document.getElementById("keyStatus").style.color = "#2e7d32";
      updateStatus("API key saved successfully!", "success");
    });
  } else {
    updateStatus("Please enter a valid API key", "error");
  }
}

// Handle document upload for context
async function handleDocumentUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  document.getElementById("documentName").textContent = file.name;
  
  try {
    updateStatus("Processing document...", "info");
    
    // Read the file content
    const reader = new FileReader();
    reader.onload = (e) => {
      window.documentContent = e.target.result;
      updateStatus("Document loaded successfully!", "success");
      
      // Automatically enable the "Use Document Context" toggle in Ask tab
      document.getElementById("useDocumentContext").checked = true;
    };
    
    if (file.type === 'application/pdf') {
      // For PDFs, we'd need to use PDF.js or similar
      // This is a simplified version that just reads as text
      reader.readAsText(file);
      updateStatus("PDF loaded (text extraction may be limited)", "info");
    } else {
      reader.readAsText(file);
    }
  } catch (error) {
    console.error("Error processing document:", error);
    updateStatus("Error processing document", "error");
  }
}

async function fillCurrentForm() {
  // First check if API key is set
  chrome.storage.local.get(["openaiApiKey", "selectedModel", "responseVariation", "smartDetection", "contextualResponses"], async (data) => {
    if (!data.openaiApiKey) {
      updateStatus("Please set your OpenAI API key first", "error");
      return;
    }
    
    // Get current settings to pass to content script
    const settings = {
      model: data.selectedModel || "gpt-4-turbo",
      temperature: parseFloat(data.responseVariation || "0.7"),
      smartDetection: data.smartDetection !== false,
      contextualResponses: data.contextualResponses !== false
    };
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      document.getElementById("fillFormBtn").disabled = true;
      document.getElementById("fillFormBtn").textContent = "Filling form...";
      updateStatus("AI is analyzing and filling the form...", "info");
      
      // Send message to content script with document content if available
      chrome.tabs.sendMessage(tab.id, { 
        action: "fillForm",
        documentContent: window.documentContent,
        settings: settings
      }, (response) => {
        document.getElementById("fillFormBtn").disabled = false;
        document.getElementById("fillFormBtn").innerHTML = `
          <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Fill Form with AI
        `;
        
        if (chrome.runtime.lastError) {
          updateStatus("Error: " + chrome.runtime.lastError.message, "error");
          return;
        }
        
        if (response?.success) {
          let message = "Form filled successfully!";
          
          // Add context information if available
          if (response.context && response.context.formType) {
            message += ` (Detected form type: ${response.context.formType})`;
          }
          
          updateStatus(message, "success");
        } else if (response?.error) {
          updateStatus("Error: " + response.error, "error");
        }
      });
    } catch (err) {
      document.getElementById("fillFormBtn").disabled = false;
      document.getElementById("fillFormBtn").innerHTML = `
        <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        Fill Form with AI
      `;
      updateStatus("Error: " + err.message, "error");
    }
  });
}

// Function to ask AI a question
async function askAI() {
  const question = document.getElementById("questionInput").value.trim();
  const useDocumentContext = document.getElementById("useDocumentContext").checked;
  
  if (!question) {
    updateStatus("Please enter a question", "error");
    return;
  }
  
  // Check if API key is set
  chrome.storage.local.get("openaiApiKey", async (data) => {
    if (!data.openaiApiKey) {
      updateStatus("Please set your OpenAI API key first", "error");
      return;
    }
    
    try {
      document.getElementById("askButton").disabled = true;
      document.getElementById("askButton").textContent = "Getting answer...";
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      const message = {
        action: "analyzeQuestion",
        question: question
      };
      
      // Add document content if available and requested
      if (useDocumentContext && window.documentContent) {
        message.documentContent = window.documentContent;
      }
      
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        document.getElementById("askButton").disabled = false;
        document.getElementById("askButton").innerHTML = `
          <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Ask AI
        `;
        
        if (chrome.runtime.lastError) {
          updateStatus("Error: " + chrome.runtime.lastError.message, "error");
          return;
        }
        
        if (response?.answer) {
          // Display the answer
          const aiResponseElement = document.getElementById("aiResponse");
          aiResponseElement.textContent = response.answer;
          aiResponseElement.style.display = "block";
          
          // Save to response history (simple implementation)
          saveToResponseHistory(question, response.answer);
        } else {
          updateStatus("Error getting response from AI", "error");
        }
      });
    } catch (err) {
      document.getElementById("askButton").disabled = false;
      document.getElementById("askButton").innerHTML = `
        <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        Ask AI
      `;
      updateStatus("Error: " + err.message, "error");
    }
  });
}

// Function to save responses to history
function saveToResponseHistory(question, answer) {
  chrome.storage.local.get("responseHistory", (data) => {
    let history = data.responseHistory || [];
    
    // Add new entry
    history.unshift({
      question,
      answer,
      timestamp: Date.now()
    });
    
    // Limit history to most recent 20 entries
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    // Save back to storage
    chrome.storage.local.set({ responseHistory: history });
  });
}

// Function to clear response history
function clearResponseHistory() {
  chrome.storage.local.remove("responseHistory", () => {
    updateStatus("Response history cleared", "success");
  });
}

function updateStatus(message = "", type = "") {
  const statusEl = document.getElementById("status");
  
  if (message) {
    statusEl.textContent = message;
    statusEl.className = "status " + type;
    statusEl.style.display = "block";
    
    // Auto-hide success messages after 3 seconds
    if (type === "success") {
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 3000);
    }
  } else {
    statusEl.style.display = "none";
  }
}