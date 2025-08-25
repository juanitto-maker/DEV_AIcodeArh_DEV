// File: AIcodeArh-main/core.js
// [2025-08-13, 03:04:25] Revision 6 - Token cost tracking

// ============================================================================
// ENHANCED STATE MANAGEMENT WITH AGENT-SPECIFIC INSTRUCTIONS
// ============================================================================

const state = {
    // Existing state properties (unchanged)
    files: new Map(),
    folders: new Map(),
    openTabs: [],
    activeFile: null,
    editor: null,
    messages: [],
    chatContext: [],
    editorCollapsed: false,
    apiKeys: {
        claude: '',
        gemini: '',
        groq: ''
    },
    contextFiles: new Set(),
    promptUploads: new Map(),
    instructionsUploads: new Map(),
    conversationState: 'ready',
    projectId: null,
    history: [],
    db: null,
    resizing: {
        horizontal: false,
        vertical: false
    },
    lastSaveContent: new Map(),
    projectContextEnabled: true,
    promptContextEnabled: true,
    instructionsContextEnabled: true,
    modifications: [],
    
    // ENHANCED: 3-Agent System State with Instructions
    agents: {
        generator: {
            id: 'generator',
            name: 'Generator',
            icon: '🔨',
            enabled: true,
            model: 'gemini-1.5-flash',
            instructions: new Map(), // Agent-specific instructions
            description: 'Creates new code and files from scratch',
            keywords: ['create', 'build', 'make', 'develop', 'generate', 'scaffold', 'setup', 'implement', 'design', 'architect', 'new project', 'start', 'initialize'],
            systemPrompt: `You are the GENERATOR AGENT - a master project architect specializing in creating new code and projects from scratch.

YOUR SPECIALIZATION:
- Creating complete project structures
- Generating new files and components
- Setting up development environments
- Implementing fresh features from requirements
- Building initial project scaffolding

CRITICAL RULES:
1. ALWAYS use gemini-1.5-flash as the default model for all API dependencies
2. When creating projects, first propose a detailed plan, then generate using FILE_START/FILE_END format
3. ALL generated code goes directly to the editor - NEVER show code in chat responses
4. Focus on clean, modern, production-ready code
5. Include proper file headers and documentation

DETECTION TRIGGERS:
- User wants to "create", "build", "make", "develop", "generate" something new
- Requests for new projects, components, or features
- Starting fresh implementations
- Setting up new development environments

Remember: You create, others modify and fix. Focus on excellent initial implementations!`
        },
        tweaker: {
            id: 'tweaker',
            name: 'Tweaker',
            icon: '🔧',
            enabled: true,
            model: 'gemini-1.5-flash',
            instructions: new Map(), // Agent-specific instructions
            description: 'Modifies and improves existing code',
            keywords: ['modify', 'update', 'change', 'edit', 'revise', 'refactor', 'improve', 'enhance', 'add feature', 'extend', 'customize', 'adjust', 'tweak'],
            systemPrompt: `You are the TWEAKER AGENT - a code modification specialist focused on improving and extending existing code.

YOUR SPECIALIZATION:
- Modifying existing files and functions
- Adding new features to existing projects
- Refactoring and improving code quality
- Extending functionality without breaking existing code
- Code optimization and enhancement

CRITICAL MODIFICATION RULES:
When modifying existing code, you MUST use this EXACT format:

MODIFY_START: path/to/file.ext
FIND:
[EXACT code to find - must match character-for-character including indentation]
REPLACE:
[EXACT new code to replace with - preserve indentation style]
MODIFY_END

IMPORTANT RULES FOR MODIFICATIONS:
1. The FIND text must be EXACTLY as it appears in the file (same spaces, tabs, line breaks)
2. Include enough context (3-5 lines) to make the match unique
3. Preserve the exact indentation style (spaces vs tabs)
4. Don't add or remove empty lines unless specifically requested
5. If unsure about exact content, ask to see the current file first

DETECTION TRIGGERS:
- User wants to "modify", "update", "change", "add feature" to existing code
- Requests for improvements or enhancements
- Code refactoring or optimization tasks
- Extending existing functionality

Remember: You improve what exists. Be precise with modifications to avoid breaking working code!`
        },
        debugger: {
            id: 'debugger',
            name: 'Debugger',
            icon: '🐛',
            enabled: true,
            model: 'gemini-1.5-flash',
            instructions: new Map(), // Agent-specific instructions
            description: 'Finds and fixes issues in code',
            keywords: ['fix', 'debug', 'error', 'issue', 'problem', 'bug', 'broken', 'not working', 'optimize', 'performance', 'solve', 'troubleshoot', 'repair'],
            systemPrompt: `You are the DEBUGGER AGENT - a diagnostic and problem-solving specialist focused on finding and fixing issues.

YOUR SPECIALIZATION:
- Identifying and fixing bugs in code
- Solving runtime and compilation errors
- Performance optimization and troubleshooting
[EXACT fixed code - preserve formatting]

REPLACE:
[EXACT fixed code - preserve formatting]
MODIFY_END

DETECTION TRIGGERS:
- User reports errors, bugs, or issues
- Code is "not working", "broken", or has problems
- Performance issues or optimization requests
- Requests to "fix", "debug", or "solve" problems
- Error messages or unexpected behavior

DEBUGGING PHILOSOPHY:
- Understand before fixing
- Fix root causes, not symptoms  
- Test your fixes mentally before applying
- Explain what was wrong and why your fix works
- Suggest improvements to prevent future issues

Remember: You are the problem solver. Others create and modify, you make it work correctly!`
        }
    },
    
    // Agent system tracking with dropdown state
    agentSystem: {
        lastUsedAgent: null,
        requestHistory: [],
        autoDetection: true,
        fallbackAgent: 'generator',
        activeDropdown: null // Track which dropdown is open
    },
    
    // Resilient Execution Loop State
    executionLoop: {
        maxAttempts: 3,
        attemptCount: 0,
        currentStrategy: '',
        strategies: ['Direct', 'Retry with Backoff', 'Simplified Context'],
        errorLog: [],
        isRetrying: false
    },
    
    // Token Cost Tracking State
    tokenCosts: {
        total: 0,
        modelBreakdown: {},
        sessionStart: new Date().toISOString(),
        history: [],
        // Approximate costs per 1k tokens (in dollars)
        pricing: {
            'gemini-1.5-flash': { input: 0.000075, output: 0.00030 },
            'gemini-2.5-flash': { input: 0.000075, output: 0.00030 },
            'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
            'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
            'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
            'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
            'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
            'openai/gpt-oss-20b': { input: 0.0001, output: 0.0001 },
            'openai/gpt-oss-120b': { input: 0.00015, output: 0.00015 },
            'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
            'llama3-8b-8192': { input: 0.00005, output: 0.00008 },
            'llama3-70b-8192': { input: 0.00059, output: 0.00079 },
            'gemma2-9b-it': { input: 0.0002, output: 0.0002 }
        }
    }
};


// ============================================================================
// AGENT DROPDOWN MANAGEMENT
// ============================================================================

/**
 * Toggle agent dropdown menu
 * @param {string} agentId - The agent ID
 */
function toggleAgentDropdown(agentId) {
    const currentlyOpen = state.agentSystem.activeDropdown;
    
    // Close all dropdowns first
    closeAllAgentDropdowns();
    
    // If clicking the same dropdown that was open, just close it
    if (currentlyOpen === agentId) {
        state.agentSystem.activeDropdown = null;
        return;
    }
    
    // Open the requested dropdown
    const dropdown = document.getElementById(`${agentId}Dropdown`);
    if (dropdown) {
        dropdown.classList.add('show');
        state.agentSystem.activeDropdown = agentId;
        
        // Update dropdown content
        updateAgentDropdownContent(agentId);
    }
}

/**
 * Close all agent dropdowns
 */
function closeAllAgentDropdowns() {
    ['generator', 'tweaker', 'debugger'].forEach(agentId => {
        const dropdown = document.getElementById(`${agentId}Dropdown`);
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    });
    state.agentSystem.activeDropdown = null;
}

/**
 * Update agent dropdown content with current model and instructions
 * @param {string} agentId - The agent ID
 */
function updateAgentDropdownContent(agentId) {
    const agent = state.agents[agentId];
    if (!agent) return;
    
    // Update model selector
    const modelSelect = document.getElementById(`${agentId}ModelSelect`);
    if (modelSelect) {
        modelSelect.value = agent.model;
    }
    
    // Update instructions list
    updateAgentInstructionsList(agentId);
}

/**
 * Update agent-specific instructions list
 * @param {string} agentId - The agent ID
 */
function updateAgentInstructionsList(agentId) {
    const agent = state.agents[agentId];
    const instructionsList = document.getElementById(`${agentId}InstructionsList`);
    const instructionsCount = document.getElementById(`${agentId}InstructionsCount`);
    
    if (!agent || !instructionsList || !instructionsCount) return;
    
    instructionsList.innerHTML = '';
    instructionsCount.textContent = `(${agent.instructions.size})`;
    
    agent.instructions.forEach((file, name) => {
        renderAgentInstructionFile(instructionsList, file, name, agentId);
    });
}

/**
 * Render agent instruction file item
 * @param {HTMLElement} container - Container element
 * @param {Object} file - File object
 * @param {string} name - File name
 * @param {string} agentId - Agent ID
 */
function renderAgentInstructionFile(container, file, name, agentId) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const contextToggle = document.createElement('div');
    const key = `agent_${agentId}_${name}`;
    contextToggle.className = `context-toggle ${state.contextFiles.has(key) ? 'active' : ''}`;
    contextToggle.onclick = (e) => {
        e.stopPropagation();
        toggleAgentInstructionContext(agentId, name);
    };
    
    const fileIcon = document.createElement('span');
    fileIcon.className = 'file-icon';
    fileIcon.textContent = '📋';
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = name;
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete instruction';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteAgentInstruction(agentId, name);
    };
    
    fileActions.appendChild(deleteBtn);
    
    fileItem.appendChild(contextToggle);
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileActions);
    
    fileItem.onclick = () => showAgentInstructionContent(agentId, name);
    
    container.appendChild(fileItem);
}

/**
 * Handle agent model selection change
 * @param {string} agentId - The agent ID
 * @param {string} model - Selected model
 */
function setAgentModel(agentId, model) {
    if (state.agents[agentId]) {
        state.agents[agentId].model = model;
        saveAgentStates();
        
        console.log(`${state.agents[agentId].name} Agent model set to: ${model}`);
    }
}

/**
 * Toggle agent instruction context
 * @param {string} agentId - The agent ID
 * @param {string} name - Instruction name
 */
function toggleAgentInstructionContext(agentId, name) {
    const key = `agent_${agentId}_${name}`;
    if (state.contextFiles.has(key)) {
        state.contextFiles.delete(key);
    } else {
        state.contextFiles.add(key);
    }
    updateAgentInstructionsList(agentId);
    updateContextIndicator();
}

/**
 * Delete agent instruction
 * @param {string} agentId - The agent ID
 * @param {string} name - Instruction name
 */
function deleteAgentInstruction(agentId, name) {
    if (confirm(`Delete ${state.agents[agentId].name} instruction "${name}"?`)) {
        state.agents[agentId].instructions.delete(name);
        state.contextFiles.delete(`agent_${agentId}_${name}`);
        updateAgentInstructionsList(agentId);
        updateContextIndicator();
        saveAgentStates();
    }
}

/**
 * Show agent instruction content
 * @param {string} agentId - The agent ID
 * @param {string} name - Instruction name
 */
function showAgentInstructionContent(agentId, name) {
    const file = state.agents[agentId].instructions.get(name);
    if (!file) return;
    
    if (file.type.startsWith('text/')) {
        const tempPath = `[${state.agents[agentId].name} Instruction] ${name}`;
        state.files.set(tempPath, {
            name: name,
            path: tempPath,
            content: file.content,
            size: file.size,
            type: file.type,
            modified: new Date().toISOString(),
            isTemporary: true
        });
        openFile(tempPath);
    }
}

/**
 * Handle agent instruction file upload
 * @param {Event} event - File input event
 * @param {string} agentId - The agent ID
 */
async function handleAgentInstructionUpload(event, agentId) {
    const files = event.target.files;
    const agent = state.agents[agentId];
    
    if (!agent) return;
    
    for (const file of files) {
        const content = await readFile(file);
        
        agent.instructions.set(file.name, {
            name: file.name,
            content: content,
            type: file.type || detectFileType(file.name),
            size: file.size
        });
        
        state.contextFiles.add(`agent_${agentId}_${file.name}`);
    }
    
    updateAgentInstructionsList(agentId);
    updateContextIndicator();
    saveAgentStates();
    event.target.value = '';
    
    console.log(`Added ${files.length} instruction(s) to ${agent.name} Agent`);
}

// ============================================================================
// ENHANCED AGENT SYSTEM FUNCTIONS
// ============================================================================

/**
 * Initialize agent system and load saved states
 */
function initAgentSystem() {
    // Load saved agent states from localStorage
    const savedAgentStates = localStorage.getItem('agentStates');
    if (savedAgentStates) {
        try {
            const parsed = JSON.parse(savedAgentStates);
            
            // Merge saved states with defaults, preserving structure
            Object.keys(state.agents).forEach(agentId => {
                if (parsed[agentId]) {
                    // Only update specific properties to preserve system prompts
                    state.agents[agentId].enabled = parsed[agentId].enabled !== undefined ? parsed[agentId].enabled : true;
                    state.agents[agentId].model = parsed[agentId].model || 'gemini-1.5-flash';
                    
                    // Load agent-specific instructions
                    if (parsed[agentId].instructions) {
                        state.agents[agentId].instructions = new Map(parsed[agentId].instructions);
                    }
                }
            });
            
            // Update UI indicators
            updateAllAgentIndicators();
            
            // Update all dropdown contents
            Object.keys(state.agents).forEach(agentId => {
                updateAgentDropdownContent(agentId);
            });
        } catch (error) {
            console.error('Failed to load agent states:', error);
            // Reset to defaults if loading fails
            resetAgentStates();
        }
    }
    
    // Load agent system settings
    const savedAgentSystem = localStorage.getItem('agentSystemSettings');
    if (savedAgentSystem) {
        try {
            const parsed = JSON.parse(savedAgentSystem);
            state.agentSystem = { ...state.agentSystem, ...parsed };
        } catch (error) {
            console.error('Failed to load agent system settings:', error);
        }
    }
    
    // Add this to the initAgentSystem function in core.js (around line 670)
// OR add it to the window load event in index.html

// Ensure project context is enabled by default
if (state.projectContextEnabled === undefined) {
    state.projectContextEnabled = true;
}

// Also ensure the UI reflects this state
updateProjectContextToggle();

// When files are uploaded, ensure they're added to context
async function handleFileUpload(event) {
    const files = event.target.files;
    
    // Process files with auto-context
    await processFiles(files, true);
    
    // Ensure project context is enabled after upload
    if (!state.projectContextEnabled) {
        state.projectContextEnabled = true;
        updateProjectContextToggle();
    }
    
    // Force update context indicator
    updateContextIndicator();
    
    // Log for debugging
    console.log('Files uploaded:', {
        count: files.length,
        projectContextEnabled: state.projectContextEnabled,
        contextFiles: Array.from(state.contextFiles)
    });
    
    event.target.value = '';
    
    if (state.editorCollapsed && state.files.size > 0) {
        toggleEditor();
    }
}
    
    console.log('3-Agent System initialized:', {
        generator: state.agents.generator.enabled,
        tweaker: state.agents.tweaker.enabled,
        debugger: state.agents.debugger.enabled
    });
}

/**
 * Toggle an agent's enabled state
 * @param {string} agentId - The agent ID (generator, tweaker, debugger)
 */
function toggleAgent(agentId) {
    if (!state.agents[agentId]) {
        console.error(`Unknown agent: ${agentId}`);
        return;
    }
    
    const agent = state.agents[agentId];
    agent.enabled = !agent.enabled;
    
    // Update UI indicator
    updateAgentIndicator(agentId);
    
    // Save states
    saveAgentStates();
    
    console.log(`Agent ${agent.name} ${agent.enabled ? 'enabled' : 'disabled'}`);
    
    return agent.enabled;
}

/**
 * Update UI indicator for a specific agent
 * @param {string} agentId - The agent ID
 */
function updateAgentIndicator(agentId) {
    const button = document.getElementById(agentId + 'Agent');
    const indicator = button?.querySelector('.agent-indicator');
    
    if (button && indicator) {
        const agent = state.agents[agentId];
        
        if (agent.enabled) {
            button.classList.add('active');
            indicator.classList.add('active');
        } else {
            button.classList.remove('active');
            indicator.classList.remove('active');
        }
    }
}

/**
 * Update all agent indicators
 */
function updateAllAgentIndicators() {
    Object.keys(state.agents).forEach(agentId => {
        updateAgentIndicator(agentId);
    });
}

/**
 * Reset all agents to default states
 */
function resetAgentStates() {
    Object.keys(state.agents).forEach(agentId => {
        state.agents[agentId].enabled = true;
        state.agents[agentId].model = 'gemini-1.5-flash';
        state.agents[agentId].instructions.clear();
    });
    
    updateAllAgentIndicators();
    saveAgentStates();
}

/**
 * Save agent states to localStorage including instructions
 */
function saveAgentStates() {
    const agentStates = {};
    
    Object.keys(state.agents).forEach(agentId => {
        const agent = state.agents[agentId];
        agentStates[agentId] = {
            enabled: agent.enabled,
            model: agent.model,
            instructions: Array.from(agent.instructions.entries()) // Convert Map to Array for JSON
        };
    });
    
    localStorage.setItem('agentStates', JSON.stringify(agentStates));
    localStorage.setItem('agentSystemSettings', JSON.stringify(state.agentSystem));
}

/**
 * Get list of enabled agents
 * @returns {Array} Array of enabled agent objects
 */
function getEnabledAgents() {
    return Object.values(state.agents).filter(agent => agent.enabled);
}

/**
 * Smart agent detection based on user input
 * @param {string} userMessage - The user's message
 * @returns {Object|null} Best matching agent or null if no agents enabled
 */
function detectBestAgent(userMessage) {
    const enabledAgents = getEnabledAgents();
    
    if (enabledAgents.length === 0) {
        console.warn('No agents enabled!');
        return null;
    }
    
    const message = userMessage.toLowerCase();
    const scores = {};
    
    // Score each enabled agent based on keyword matches
    enabledAgents.forEach(agent => {
        scores[agent.id] = 0;
        
        // Check for keyword matches
        agent.keywords.forEach(keyword => {
            if (message.includes(keyword.toLowerCase())) {
                scores[agent.id] += keyword.length; // Longer keywords get higher priority
            }
        });
        
        // Boost score for exact phrase matches
        agent.keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
            const matches = message.match(regex);
            if (matches) {
                scores[agent.id] += matches.length * 5; // Exact matches get bonus points
            }
        });
    });
    
    // Context-based scoring
    const hasExistingFiles = state.files.size > 0;
    const hasErrors = message.includes('error') || message.includes('not work') || message.includes('fix');
    const isNewProject = message.includes('new project') || message.includes('create app') || message.includes('build');
    
    // Contextual bonuses
    if (hasExistingFiles && state.agents.tweaker.enabled) {
        scores.tweaker = (scores.tweaker || 0) + 2;
    }
    
    if (hasErrors && state.agents.debugger.enabled) {
        scores.debugger = (scores.debugger || 0) + 3;
    }
    
    if (isNewProject && state.agents.generator.enabled) {
        scores.generator = (scores.generator || 0) + 3;
    }
    
    // Find the highest scoring agent
    let bestAgent = null;
    let highestScore = 0;
    
    Object.entries(scores).forEach(([agentId, score]) => {
        if (score > highestScore) {
            highestScore = score;
            bestAgent = state.agents[agentId];
        }
    });
    
    // Fallback to default agent if no clear winner
    if (!bestAgent || highestScore === 0) {
        const fallbackAgent = state.agents[state.agentSystem.fallbackAgent];
        if (fallbackAgent && fallbackAgent.enabled) {
            bestAgent = fallbackAgent;
        } else {
            bestAgent = enabledAgents[0]; // First enabled agent
        }
    }
    
    // Track usage
    if (bestAgent) {
        state.agentSystem.lastUsedAgent = bestAgent.id;
        state.agentSystem.requestHistory.push({
            timestamp: new Date().toISOString(),
            message: userMessage.substring(0, 100), // Store first 100 chars
            selectedAgent: bestAgent.id,
            score: highestScore,
            context: {
                hasFiles: hasExistingFiles,
                hasErrors: hasErrors,
                isNewProject: isNewProject
            }
        });
        
        // Keep only last 50 requests
        if (state.agentSystem.requestHistory.length > 50) {
            state.agentSystem.requestHistory = state.agentSystem.requestHistory.slice(-50);
        }
        
        saveAgentStates();
    }
    
    console.log('Agent detection results:', {
        message: userMessage.substring(0, 50) + '...',
        scores: scores,
        selectedAgent: bestAgent?.name,
        reason: highestScore > 0 ? 'keyword match' : 'fallback'
    });
    
    return bestAgent;
}

/**
 * Get system prompt for an agent including agent-specific instructions
 * @param {string} agentId - The agent ID
 * @returns {string} The agent's system prompt
 */
function getAgentSystemPrompt(agentId) {
    const agent = state.agents[agentId];
    if (!agent) return '';
    
    let systemPrompt = agent.systemPrompt;
    
    // Add agent-specific instructions if any
    if (agent.instructions.size > 0) {
        systemPrompt += '\n\n=== AGENT-SPECIFIC INSTRUCTIONS ===\n';
        agent.instructions.forEach((file, name) => {
            if (state.contextFiles.has(`agent_${agentId}_${name}`)) {
                systemPrompt += `\n--- ${name} ---\n${file.content}\n`;
            }
        });
    }
    
    return systemPrompt;
}

/**
 * Get agent-specific model preference
 * @param {string} agentId - The agent ID
 * @returns {string} The preferred model for this agent
 */
function getAgentModel(agentId) {
    const agent = state.agents[agentId];
    return agent ? agent.model : 'gemini-1.5-flash';
}

/**
 * Get agent statistics
 * @returns {Object} Usage statistics for each agent
 */
function getAgentStats() {
    const stats = {
        generator: { used: 0, enabled: state.agents.generator.enabled },
        tweaker: { used: 0, enabled: state.agents.tweaker.enabled },
        debugger: { used: 0, enabled: state.agents.debugger.enabled }
    };
    
    state.agentSystem.requestHistory.forEach(request => {
        if (stats[request.selectedAgent]) {
            stats[request.selectedAgent].used++;
        }
    });
    
    return stats;
}

/**
 * Check if any agents are enabled
 * @returns {boolean} True if at least one agent is enabled
 */
function hasEnabledAgents() {
    return Object.values(state.agents).some(agent => agent.enabled);
}

/**
 * Get formatted agent status for display
 * @returns {string} Human-readable agent status
 */
function getAgentStatusText() {
    const enabled = getEnabledAgents();
    const total = Object.keys(state.agents).length;
    
    if (enabled.length === 0) {
        return '❌ No agents enabled';
    } else if (enabled.length === total) {
        return '✅ All agents active';
    } else {
        const names = enabled.map(a => a.name).join(', ');
        return `⚡ Active: ${names}`;
    }
}

// ============================================================================
// INDEXEDDB SETUP (unchanged)
// ============================================================================

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AIProjectGenerator', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            state.db = request.result;
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('projects')) {
                const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
                projectsStore.createIndex('lastModified', 'lastModified', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('history')) {
                const historyStore = db.createObjectStore('history', { keyPath: 'id' });
                historyStore.createIndex('projectId', 'projectId', { unique: false });
            }
        };
    });
}

// ============================================================================
// PROJECT MANAGEMENT (unchanged)
// ============================================================================

/**
 * Deletes all files and folders from the project.
 */
function deleteAllFilesAndFolders() {
    if (!confirm("Are you sure you want to delete all files and folders? This cannot be undone.")) {
        return;
    }

    state.files.clear();
    state.folders.clear();
    state.contextFiles.clear();
    state.openTabs = [];
    state.activeFile = null;
    state.lastSaveContent.clear();

    // Reset editor UI
    state.editor?.setValue('');
    updateFileList();
    updateEditorTabs();
    updateContextIndicator();
    
    // Show a message
    addMessage('assistant', '🗑️ All project files and folders have been deleted.');

    // Since we cleared the project, let's also remove it from local storage
    localStorage.removeItem('currentProjectId');
    saveProject();
}

/**
 * Downloads the entire project as a single ZIP file.
 * NOTE: This requires the JSZip library to be included in your project.
 */
async function downloadProjectAsZip() {
    if (state.files.size === 0) {
        alert('There are no files to download.');
        return;
    }

    if (typeof JSZip === 'undefined') {
        alert('JSZip library is not available. Please include it in your HTML file to enable this feature.');
        console.error('JSZip library is not loaded. Please add: <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script> in your index.html');
        return;
    }

    const zip = new JSZip();

    state.files.forEach((file, path) => {
        // Exclude temporary files
        if (!file.isTemporary) {
            zip.file(path, file.content);
        }
    });

    try {
        const zipContent = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        const url = URL.createObjectURL(zipContent);
        const date = new Date().toISOString().split('T')[0];

        a.href = url;
        a.download = `AIcodeArh_project_${date}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addMessage('assistant', '📥 Project has been downloaded as a ZIP file.');

    } catch (error) {
        console.error('Failed to generate or download zip:', error);
        alert('An error occurred while creating the ZIP file.');
    }
}



async function saveProject() {
    if (!state.db || !state.projectId) return;
    
    const project = {
        id: state.projectId,
        files: Array.from(state.files.entries()),
        folders: Array.from(state.folders.entries()),
        contextFiles: Array.from(state.contextFiles),
        lastModified: new Date().toISOString(),
        activeFile: state.activeFile,
        openTabs: state.openTabs,
        projectContextEnabled: state.projectContextEnabled,
        promptContextEnabled: state.promptContextEnabled,
        instructionsContextEnabled: state.instructionsContextEnabled
    };
    
    const transaction = state.db.transaction(['projects'], 'readwrite');
    const store = transaction.objectStore('projects');
    await store.put(project);
}

async function loadProject(projectId) {
    if (!state.db) return;
    
    const transaction = state.db.transaction(['projects'], 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.get(projectId);
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const project = request.result;
            if (project) {
                state.files = new Map(project.files);
                state.folders = new Map(project.folders);
                state.contextFiles = new Set(project.contextFiles);
                state.activeFile = project.activeFile;
                state.openTabs = project.openTabs;
                state.projectId = projectId;
                state.projectContextEnabled = project.projectContextEnabled !== false;
                state.promptContextEnabled = project.promptContextEnabled !== false;
                state.instructionsContextEnabled = project.instructionsContextEnabled !== false;
                
                updateFileList();
                updatePromptList();
                updateInstructionsList();
                updateContextIndicator();
                if (state.activeFile) {
                    openFile(state.activeFile);
                }
                updateEditorTabs();
            }
            resolve(project);
        };
        request.onerror = () => reject(request.error);
    });
}

// ============================================================================
// EDITOR FUNCTIONS (unchanged)
// ============================================================================

function initEditor() {
    const editorElement = document.getElementById('editor');
    
    // Clear any existing content
    editorElement.innerHTML = '';
    
    state.editor = CodeMirror(editorElement, {
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: true,
        lineWrapping: false,
        autoCloseBrackets: true,
        matchBrackets: true,
        styleActiveLine: true,
        viewportMargin: Infinity, // Render all content for better performance
        extraKeys: {
            "Ctrl-S": saveCurrentFile,
            "Cmd-S": saveCurrentFile,
            "Ctrl-F": showFindReplace,
            "Cmd-F": showFindReplace,
            "Ctrl-Z": undo,
            "Cmd-Z": undo,
            "Ctrl-Y": redo,
            "Cmd-Y": redo
        }
    });

    // CRITICAL: Force CodeMirror to fill the container
    const codeMirrorElement = editorElement.querySelector('.CodeMirror');
    if (codeMirrorElement) {
        codeMirrorElement.style.height = '100%';
        codeMirrorElement.style.width = '100%';
        codeMirrorElement.style.position = 'absolute';
        codeMirrorElement.style.top = '0';
        codeMirrorElement.style.left = '0';
        codeMirrorElement.style.right = '0';
        codeMirrorElement.style.bottom = '0';
    }

    // Track changes
    state.editor.on('change', (cm, change) => {
        if (state.activeFile && change.origin !== 'setValue') {
            const file = state.files.get(state.activeFile);
            if (file) {
                const currentContent = cm.getValue();
                const lastSaved = state.lastSaveContent.get(state.activeFile);
                if (lastSaved !== currentContent) {
                    saveToHistory();
                }
            }
        }
    });

    // Handle resize events to refresh CodeMirror
    window.addEventListener('resize', () => {
        if (state.editor) {
            setTimeout(() => {
                state.editor.refresh();
                fixEditorSizing();
            }, 100);
        }
    });

    // Initial sizing fix
    setTimeout(() => {
        if (state.editor) {
            state.editor.refresh();
            fixEditorSizing();
        }
    }, 100);
}

// New function to ensure proper editor sizing
function fixEditorSizing() {
    const editorElement = document.getElementById('editor');
    const codeMirrorElement = editorElement?.querySelector('.CodeMirror');
    
    if (codeMirrorElement && state.editor) {
        // Force recalculation of dimensions
        codeMirrorElement.style.height = '100%';
        codeMirrorElement.style.width = '100%';
        
        // Refresh CodeMirror to apply changes
        state.editor.refresh();
        
        // Fix background as well
        if (typeof fixEditorBackground === 'function') {
            fixEditorBackground();
        }
    }
}

function openFile(filepath) {
    const file = state.files.get(filepath);
    if (!file) return;
    
    if (!state.openTabs.includes(filepath)) {
        state.openTabs.push(filepath);
    }
    
    state.activeFile = filepath;
    updateEditorTabs();
    
    state.editor.setValue(file.content);
    state.editor.setOption('mode', file.type);
    
    // CRITICAL: Refresh editor after content change and fix sizing
    setTimeout(() => {
        if (state.editor) {
            state.editor.refresh();
            fixEditorSizing();
        }
    }, 50);
    
    updateFileList();
}

function updateEditorTabs() {
    const tabsContainer = document.getElementById('editorTabs');
    tabsContainer.innerHTML = '';
    
    state.openTabs.forEach(filepath => {
        const file = state.files.get(filepath);
        if (!file) return;
        
        const tab = document.createElement('div');
        tab.className = `editor-tab ${state.activeFile === filepath ? 'active' : ''}`;
        tab.onclick = () => openFile(filepath);
        
        const tabName = document.createElement('span');
        tabName.textContent = file.name;
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'editor-tab-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeTab(filepath);
        };
        
        tab.appendChild(tabName);
        tab.appendChild(closeBtn);
        tabsContainer.appendChild(tab);
    });
}

function closeTab(filepath) {
    const index = state.openTabs.indexOf(filepath);
    if (index > -1) {
        state.openTabs.splice(index, 1);
        
        if (state.activeFile === filepath) {
            if (state.openTabs.length > 0) {
                openFile(state.openTabs[Math.max(0, index - 1)]);
            } else {
                state.activeFile = null;
                state.editor.setValue('');
            }
        }
        
        updateEditorTabs();
    }
}

function saveCurrentFile() {
    if (!state.activeFile) return;
    
    const file = state.files.get(state.activeFile);
    if (file) {
        const newContent = state.editor.getValue();
        const lastSaved = state.lastSaveContent.get(state.activeFile) || file.content;
        
        if (newContent !== lastSaved) {
            file.content = newContent;
            file.modified = new Date().toISOString();
            
            if (supportsComments(file.path)) {
                file.revision = (file.revision || 1) + 1;
                file.content = addRevisionComment(file.path, newContent, file.revision, 'Content updated');
                state.editor.setValue(file.content);
            }
            
            state.lastSaveContent.set(state.activeFile, file.content);
        }
        
        downloadFile(file.name, file.content);
        saveProject();
    }
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// HISTORY MANAGEMENT (unchanged)
// ============================================================================

function saveToHistory() {
    if (state.history.length >= 10) {
        state.history.shift();
    }
    
    state.history.push({
        timestamp: new Date().toISOString(),
        files: new Map(state.files),
        activeFile: state.activeFile,
        cursorPos: state.editor.getCursor()
    });
}

function undo() {
    if (state.history.length > 0) {
        const previousState = state.history.pop();
        state.files = previousState.files;
        state.activeFile = previousState.activeFile;
        
        if (state.activeFile) {
            const file = state.files.get(state.activeFile);
            if (file) {
                state.editor.setValue(file.content);
                state.editor.setCursor(previousState.cursorPos);
            }
        }
        
        updateFileList();
    }
}

function redo() {
    // Implement redo functionality if needed
}

// ============================================================================
// FILE HANDLING (unchanged)
// ============================================================================

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        
        if (file.type && (file.type.startsWith('image/') || file.type.startsWith('application/pdf'))) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}

async function processFiles(files, autoContext = false) {
    for (const file of files) {
        const filename = file.name;
        let newPath = filename;
        let counter = 1;

        // Check for existing file with the same name and generate a new path
        while (state.files.has(newPath)) {
            const parts = filename.split('.');
            const name = parts.slice(0, -1).join('.');
            const ext = parts.pop();
            newPath = `${name} (${counter}).${ext}`;
            counter++;
        }

        const content = await readFile(file);
        const fileData = {
            name: newPath.split('/').pop(), // Use the new unique name
            path: newPath,
            content: content,
            size: file.size,
            type: file.type || detectFileType(filename),
            modified: new Date().toISOString(),
            includedInContext: autoContext,
            revision: 1
        };

        if (isCodeFile(filename) && !supportsComments(filename)) {
            fileData.revision = 0;
        } else if (isCodeFile(filename)) {
            fileData.content = addFileHeader(newPath, fileData.content);
        }

        state.files.set(newPath, fileData);
        state.lastSaveContent.set(newPath, fileData.content);

        if (autoContext) {
            state.contextFiles.add(newPath);
        }
    }
    updateFileList();
    updateContextIndicator();
    saveProject();
}


async function processFolderFiles(files, autoContext = false) {
    const folderStructure = new Map();
    
    for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        let newPath = path;
        let counter = 1;

        // Check for existing file and generate a new path
        while (state.files.has(newPath)) {
            const parts = path.split('.');
            const name = parts.slice(0, -1).join('.');
            const ext = parts.pop();
            newPath = `${name} (${counter}).${ext}`;
            counter++;
        }

        const content = await readFile(file);
        const parts = newPath.split('/');
        const fileName = parts.pop();
        const folderPath = parts.join('/');
        
        const fileData = {
            name: fileName,
            path: newPath,
            content: content,
            size: file.size,
            type: file.type || detectFileType(fileName),
            modified: new Date().toISOString(),
            includedInContext: autoContext,
            revision: 1
        };
        
        if (isCodeFile(fileName) && !supportsComments(fileName)) {
            fileData.revision = 0;
        } else if (isCodeFile(fileName)) {
            fileData.content = addFileHeader(newPath, fileData.content);
        }
        
        state.files.set(newPath, fileData);
        state.lastSaveContent.set(newPath, fileData.content);
        
        if (autoContext) {
            state.contextFiles.add(newPath);
        }
        
        // Build folder structure
        let currentPath = '';
        for (const part of parts) {
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!folderStructure.has(currentPath)) {
                folderStructure.set(currentPath, {
                    name: part,
                    path: currentPath,
                    parent: parentPath,
                    children: [],
                    expanded: true
                });
                if (parentPath && folderStructure.has(parentPath)) {
                    folderStructure.get(parentPath).children.push(currentPath);
                }
            }
            // Auto-contextualize folders
            if (autoContext) {
                state.contextFiles.add(currentPath);
            }
        }
        
        // Add file to folder
        if (folderPath && folderStructure.has(folderPath)) {
            const folder = folderStructure.get(folderPath);
            if (!folder.children.includes(newPath)) {
                folder.children.push(newPath);
            }
        }
    }
    
    state.folders = folderStructure;
    updateFileList();
    updateContextIndicator();
    saveProject();
}


async function createFileWithPath(filepath, content, autoContext = false) {
    console.log(`Creating file: ${filepath}`);
    const parts = filepath.split('/');
    const filename = parts.pop();
    const folders = parts;
    
    if (state.files.has(filepath)) {
        const existingFile = state.files.get(filepath);
        existingFile.content = content;
        existingFile.size = new Blob([content]).size;
        existingFile.modified = new Date().toISOString();
        
        const lastSaved = state.lastSaveContent.get(filepath);
        if (lastSaved !== content && supportsComments(filepath)) {
            existingFile.revision = (existingFile.revision || 1) + 1;
            existingFile.content = addRevisionComment(filepath, content, existingFile.revision, 'AI updated');
        }
        
        state.lastSaveContent.set(filepath, existingFile.content);
        
        if (state.activeFile === filepath) {
            state.editor.setValue(existingFile.content);
        }
        
        if (autoContext) {
            state.contextFiles.add(filepath);
        }
        
        updateFileList();
        updateContextIndicator();
        return;
    }
    
    let currentPath = '';
    for (let i = 0; i < folders.length; i++) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${folders[i]}` : folders[i];
        
        if (!state.folders.has(currentPath)) {
            const folderData = {
                name: folders[i],
                path: currentPath,
                parent: parentPath,
                children: [],
                expanded: true
            };
            
            state.folders.set(currentPath, folderData);
            
            if (parentPath && state.folders.has(parentPath)) {
                state.folders.get(parentPath).children.push(currentPath);
            }
            
            // Auto-contextualize folders
            if (autoContext) {
                state.contextFiles.add(currentPath);
            }
        }
    }
    
    const fileData = {
        name: filename,
        path: filepath,
        content: content,
        size: new Blob([content]).size,
        type: detectFileType(filename),
        modified: new Date().toISOString(),
        includedInContext: autoContext,
        revision: 1
    };
    
    if (isCodeFile(filename) && supportsComments(filename)) {
        fileData.content = addFileHeader(filepath, content);
    }
    
    state.files.set(filepath, fileData);
    state.lastSaveContent.set(filepath, fileData.content);
    
    if (autoContext) {
        state.contextFiles.add(filepath);
    }
    
    if (currentPath && state.folders.has(currentPath)) {
        const folder = state.folders.get(currentPath);
        if (!folder.children.includes(filepath)) {
            folder.children.push(filepath);
        }
    }
    
    updateFileList();
    updateContextIndicator();
}

// ============================================================================
// FILE UTILITIES (with updated getSizeIndicator)
// ============================================================================

function isCodeFile(filename) {
    const codeExtensions = [
        'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 
        'rb', 'php', 'swift', 'kt', 'rs', 'html', 'css', 'scss', 'json', 
        'xml', 'yaml', 'yml', 'md', 'sql', 'sh', 'bash'
    ];
    const ext = filename.split('.').pop().toLowerCase();
    return codeExtensions.includes(ext);
}

function supportsComments(filename) {
    const noCommentExtensions = ['json'];
    const ext = filename.split('.').pop().toLowerCase();
    return !noCommentExtensions.includes(ext);
}

function detectFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'javascript',
        'tsx': 'javascript',
        'py': 'python',
        'html': 'htmlmixed',
        'xml': 'xml',
        'css': 'css',
        'scss': 'css',

        'md': 'markdown',
        'json': 'javascript',
        'yaml': 'yaml',
        'yml': 'yaml',
        'java': 'text/x-java',
        'cpp': 'text/x-c++src',
        'c': 'text/x-csrc',
        'cs': 'text/x-csharp',
        'go': 'go',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'rs': 'rust',
        'sql': 'sql',
        'sh': 'shell',
        'bash': 'shell'
    };
    return typeMap[ext] || 'text';
}

function getCommentSyntax(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const commentMap = {
        'js': '//',
        'jsx': '//',
        'ts': '//',
        'tsx': '//',
        'java': '//',
        'cpp': '//',
        'c': '//',
        'cs': '//',
        'go': '//',
        'swift': '//',
        'rs': '//',
        'php': '//',
        'py': '#',
        'rb': '#',
        'sh': '#',
        'bash': '#',
        'yaml': '#',
        'yml': '#',
        'sql': '--',
        'html': '<!--',
        'xml': '<!--',
        'css': '/*',
        'scss': '/*'
    };
    return commentMap[ext] || '//';
}

function addFileHeader(path, content) {
    if (!supportsComments(path)) return content;
    
    const comment = getCommentSyntax(path);
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    const isHtml = path.endsWith('.html') || path.endsWith('.xml');
    const isCss = path.endsWith('.css') || path.endsWith('.scss');
    
    let header;
    if (isHtml) {
        header = `<!-- File: ${path} -->\n<!-- [${date}, ${time}] Revision 1 - Initial generation -->\n\n`;
    } else if (isCss) {
        header = `/* File: ${path} */\n/* [${date}, ${time}] Revision 1 - Initial generation */\n\n`;
    } else {
        header = `${comment} File: ${path}\n${comment} [${date}, ${time}] Revision 1 - Initial generation\n\n`;
    }
    
    return header + content;
}

function addRevisionComment(path, content, revision, message, lineNumbers = '') {
    if (!supportsComments(path)) return content;
    
    const comment = getCommentSyntax(path);
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    const isHtml = path.endsWith('.html') || path.endsWith('.xml');
    const isCss = path.endsWith('.css') || path.endsWith('.scss');
    
    const lineInfo = lineNumbers ? ` lines ${lineNumbers}` : '';
    let revComment;
    if (isHtml) {
        revComment = `<!-- [${date}, ${time}] Revision ${revision} - ${message}${lineInfo} -->`;
    } else if (isCss) {
        revComment = `/* [${date}, ${time}] Revision ${revision} - ${message}${lineInfo} */`;
    } else {
        revComment = `${comment} [${date}, ${time}] Revision ${revision} - ${message}${lineInfo}`;
    }
    
    const lines = content.split('\n');
    let insertIndex = -1;
    let fileHeaderEnd = -1;
    
    // Find the file header and existing revisions
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        if (lines[i].includes('File:')) {
            fileHeaderEnd = i;
        }
        if (lines[i].includes('Revision') || lines[i].includes('[20')) {
            insertIndex = i;
        }
    }
    
    if (insertIndex >= 0) {
        // Replace the last revision comment
        lines[insertIndex] = revComment;
    } else if (fileHeaderEnd >= 0) {
        // Insert after file header
        lines.splice(fileHeaderEnd + 1, 0, revComment);
    } else {
        // Insert at the beginning
        lines.unshift(revComment);
    }
    
    return lines.join('\n');
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'js': '📜',
        'jsx': '⚛️',
        'ts': '📘',
        'tsx': '⚛️',
        'html': '🌐',
        'css': '🎨',
        'scss': '🎨',
        'json': '📋',
        'md': '📝',
        'py': '🐍',
        'java': '☕',
        'cpp': '⚙️',
        'c': '⚙️',
        'cs': '🔷',
        'go': '🐹',
        'rb': '💎',
        'php': '🐘',
        'swift': '🦉',
        'rs': '🦀',
        'sql': '🗄️',
        'sh': '🐚',
        'bash': '🐚',
        'yaml': '⚙️',
        'yml': '⚙️',
        'xml': '📄',
        'txt': '📄',
        'env': '🔐',
        'gitignore': '🚫',
        'dockerfile': '🐳',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'pdf': '📑'
    };
    return iconMap[ext] || '📄';
}

// ============================================================================
// FILE TREE MANAGEMENT (unchanged)
// ============================================================================

function updateFileList() {
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    fileList.innerHTML = '';
    
    const projectFileCount = Array.from(state.files.values())
        .filter(f => !state.promptUploads.has(f.name) && !state.instructionsUploads.has(f.name)).length;
    fileCount.textContent = `(${projectFileCount})`;
    
    const rootFolders = [];
    const rootFiles = [];
    
    state.folders.forEach((folder, path) => {
        if (!folder.parent) {
            rootFolders.push(folder);
        }
    });
    
    state.files.forEach((file, path) => {
        if (!path.includes('/') && !state.promptUploads.has(file.name) && !state.instructionsUploads.has(file.name)) {
            rootFiles.push(file);
        }
    });
    
    rootFolders.sort((a, b) => a.name.localeCompare(b.name));
    rootFiles.sort((a, b) => a.name.localeCompare(b.name));
    
    rootFolders.forEach(folder => {
        renderFolder(fileList, folder, 0);
    });
    
    rootFiles.forEach(file => {
        renderFile(fileList, file, 0);
    });
    
    updateProjectContextToggle();
}

function updatePromptList() {
    const promptList = document.getElementById('promptList');
    const promptCount = document.getElementById('promptCount');
    promptList.innerHTML = '';
    
    promptCount.textContent = `(${state.promptUploads.size})`;
    
    state.promptUploads.forEach((file, name) => {
        renderPromptFile(promptList, file, name);
    });
    
    updatePromptContextToggle();
}

function updateInstructionsList() {
    const instructionsList = document.getElementById('instructionsList');
    const instructionsCount = document.getElementById('instructionsCount');
    instructionsList.innerHTML = '';
    
    instructionsCount.textContent = `(${state.instructionsUploads.size})`;
    
    state.instructionsUploads.forEach((file, name) => {
        renderInstructionsFile(instructionsList, file, name);
    });
    
    updateInstructionsContextToggle();
}

function renderFolder(container, folder, level) {
    const folderDiv = document.createElement('div');
    folderDiv.className = `folder-item ${folder.expanded ? 'folder-expanded' : 'folder-collapsed'}`;
    folderDiv.style.marginLeft = `${level * 20}px`;
    
    const contextToggle = document.createElement('div');
    contextToggle.className = `context-toggle ${state.contextFiles.has(folder.path) ? 'active' : ''}`;
    contextToggle.onclick = (e) => {
        e.stopPropagation();
        toggleFolderContext(folder.path);
    };
    
    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';
    
    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folder.name;
    
    const folderActions = document.createElement('div');
    folderActions.className = 'folder-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete folder';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteFolder(folder.path);
    };
    
    folderActions.appendChild(deleteBtn);
    
    folderDiv.appendChild(contextToggle);
    folderDiv.appendChild(folderIcon);
    folderDiv.appendChild(folderName);
    folderDiv.appendChild(folderActions);
    
    folderDiv.onclick = () => toggleFolder(folder.path);
    
    container.appendChild(folderDiv);
    
    if (folder.expanded) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'folder-content';
        
        const childFolders = [];
        const childFiles = [];
        
        folder.children.forEach(childPath => {
            if (state.folders.has(childPath)) {
                childFolders.push(state.folders.get(childPath));
            } else if (state.files.has(childPath)) {
                childFiles.push(state.files.get(childPath));
            }
        });
        
        childFolders.sort((a, b) => a.name.localeCompare(b.name));
        childFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        childFolders.forEach(childFolder => {
            renderFolder(contentDiv, childFolder, level + 1);
        });
        
        childFiles.forEach(childFile => {
            renderFile(contentDiv, childFile, level + 1);
        });
        
        container.appendChild(contentDiv);
    }
}

function renderFile(container, file, level) {
    if (file.isTemporary) return;
    
    const fileItem = document.createElement('div');
    fileItem.className = `file-item ${state.activeFile === file.path ? 'active' : ''}`;
    fileItem.style.marginLeft = `${level * 20}px`;
    
    const contextToggle = document.createElement('div');
    contextToggle.className = `context-toggle ${state.contextFiles.has(file.path) ? 'active' : ''}`;
    contextToggle.onclick = (e) => {
        e.stopPropagation();
        toggleFileContext(file.path);
    };
    
    const fileIcon = document.createElement('span');
    fileIcon.className = 'file-icon';
    fileIcon.textContent = getFileIcon(file.name);
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete file';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteFile(file.path);
    };
    
    fileActions.appendChild(deleteBtn);
    
    fileItem.appendChild(contextToggle);
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileActions);
    
    fileItem.onclick = () => {
        openFile(file.path);
        if (typeof toggleEditor === 'function' && state.editorCollapsed) {
            toggleEditor();
        }
    };
    
    container.appendChild(fileItem);
}

function renderPromptFile(container, file, name) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const contextToggle = document.createElement('div');
    const key = `prompt_${name}`;
    contextToggle.className = `context-toggle ${state.contextFiles.has(key) ? 'active' : ''}`;
    contextToggle.onclick = (e) => {
        e.stopPropagation();
        togglePromptFileContext(name);
    };
    
    const fileIcon = document.createElement('span');
    fileIcon.className = 'file-icon';
    fileIcon.textContent = file.isLongPrompt ? '📝' : getFileIcon(name);
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = file.isLongPrompt ? `${name} (long prompt)` : name;
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete attachment';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deletePromptFile(name);
    };
    
    fileActions.appendChild(deleteBtn);
    
    fileItem.appendChild(contextToggle);
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileActions);
    
    fileItem.onclick = () => showPromptFileContent(name);
    
    container.appendChild(fileItem);
}

function renderInstructionsFile(container, file, name) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const contextToggle = document.createElement('div');
    const key = `instructions_${name}`;
    contextToggle.className = `context-toggle ${state.contextFiles.has(key) ? 'active' : ''}`;
    contextToggle.onclick = (e) => {
        e.stopPropagation();
        toggleInstructionsFileContext(name);
    };
    
    const fileIcon = document.createElement('span');
    fileIcon.className = 'file-icon';
    fileIcon.textContent = '📋';
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = name;
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete instruction';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteInstructionsFile(name);
    };
    
    fileActions.appendChild(deleteBtn);
    
    fileItem.appendChild(contextToggle);
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileActions);
    
    fileItem.onclick = () => showInstructionsFileContent(name);
    
    container.appendChild(fileItem);
}

// ============================================================================
// ENHANCED CONTEXT MANAGEMENT WITH AGENT INSTRUCTIONS
// ============================================================================

function updateContextIndicator() {
    let contextSize = 0;
    let fileCount = 0;
    const contextFilesList = [];
    
    state.contextFiles.forEach(key => {
        if (key.startsWith('prompt_')) {
            const name = key.substring(7);
            const file = state.promptUploads.get(name);
            if (file) {
                contextSize += file.size;
                fileCount++;
                contextFilesList.push(`📎 ${file.name}`);
            }
        } else if (key.startsWith('instructions_')) {
            const name = key.substring(13);
            const file = state.instructionsUploads.get(name);
            if (file) {
                contextSize += file.size;
                fileCount++;
                contextFilesList.push(`📋 ${file.name}`);
            }
        } else if (key.startsWith('agent_')) {
            // Handle agent-specific instructions
            const parts = key.split('_');
            if (parts.length >= 3) {
                const agentId = parts[1];
                const fileName = parts.slice(2).join('_');
                const agent = state.agents[agentId];
                const file = agent?.instructions.get(fileName);
                if (file) {
                    contextSize += file.size;
                    fileCount++;
                    contextFilesList.push(`${agent.icon} ${file.name} (${agent.name})`);
                }
            }
        } else {
            const file = state.files.get(key);
            if (file && !file.isTemporary) {
                contextSize += file.size;
                fileCount++;
                contextFilesList.push(file.name);
            }
        }
    });
    
    if (state.activeFile && !state.contextFiles.has(state.activeFile)) {
        const file = state.files.get(state.activeFile);
        if (file && !file.isTemporary) {
            contextSize += file.size;
            fileCount++;
            contextFilesList.push(`✏️ ${file.name} (active)`);
        }
    }
    
    // Update large context indicator
    const indicatorLarge = document.getElementById('contextIndicatorLarge');
    if (indicatorLarge) {
        indicatorLarge.className = 'context-indicator-large ' + getSizeIndicator(contextSize);
    }
    
    // Keep existing small indicator for compatibility
    const indicator = document.getElementById('contextIndicator');
    const sizeText = document.getElementById('contextSize');
    const contextDetails = document.getElementById('contextFilesList');
    
    if (indicator && sizeText) {
        const sizeKB = (contextSize / 1024).toFixed(1);
        sizeText.textContent = `${sizeKB} KB`;
        indicator.className = 'context-indicator ' + getSizeIndicator(contextSize);
    }
    
    if (contextDetails) {
        if (contextFilesList.length > 0) {
            contextDetails.innerHTML = contextFilesList.map(f => `• ${f}`).join('<br>');
        } else {
            contextDetails.innerHTML = '<em>No files in context</em>';
        }
    }
}

function getSizeIndicator(size) {
    if (size < 150 * 1024) return 'indicator-green';    // < 150KB - Green
    if (size < 300 * 1024) return 'indicator-yellow';   // 150-300KB - Yellow
    if (size < 450 * 1024) return 'indicator-orange';   // 300-450KB - Orange
    if (size < 600 * 1024) return 'indicator-red';      // 450-600KB - Red
    return 'indicator-red-pulse';                        // > 600KB - Red blinking
}

function toggleFileContext(filePath) {
    if (state.contextFiles.has(filePath)) {
        state.contextFiles.delete(filePath);
    } else {
        state.contextFiles.add(filePath);
    }
    updateFileList();
    updateContextIndicator();
}

function toggleFolderContext(folderPath) {
    const folder = state.folders.get(folderPath);
    if (!folder) return;
    
    const isIncluded = state.contextFiles.has(folderPath);
    
    const toggleRecursive = (path) => {
        if (isIncluded) {
            state.contextFiles.delete(path);
        } else {
            state.contextFiles.add(path);
        }
        
        const f = state.folders.get(path);
        if (f && f.children) {
            f.children.forEach(childPath => {
                if (state.folders.has(childPath)) {
                    toggleRecursive(childPath);
                } else if (state.files.has(childPath)) {
                    if (isIncluded) {
                        state.contextFiles.delete(childPath);
                    } else {
                        state.contextFiles.add(childPath);
                    }
                }
            });
        }
    };
    
    toggleRecursive(folderPath);
    updateFileList();
    updateContextIndicator();
}

function togglePromptFileContext(name) {
    const key = `prompt_${name}`;
    if (state.contextFiles.has(key)) {
        state.contextFiles.delete(key);
    } else {
        state.contextFiles.add(key);
    }
    updatePromptList();
    updateContextIndicator();
}

function toggleInstructionsFileContext(name) {
    const key = `instructions_${name}`;
    if (state.contextFiles.has(key)) {
        state.contextFiles.delete(key);
    } else {
        state.contextFiles.add(key);
    }
    updateInstructionsList();
    updateContextIndicator();
}

function updateProjectContextToggle() {
    const toggle = document.getElementById('projectContextToggle');
    if (toggle) {
        if (state.projectContextEnabled) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
}

function updatePromptContextToggle() {
    const toggle = document.getElementById('promptContextToggle');
    if (toggle) {
        if (state.promptContextEnabled) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
}

function updateInstructionsContextToggle() {
    const toggle = document.getElementById('instructionsContextToggle');
    if (toggle) {
        if (state.instructionsContextEnabled) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
}

// ============================================================================
// FILE OPERATIONS (unchanged)
// ============================================================================

function toggleFolder(folderPath) {
    const folder = state.folders.get(folderPath);
    if (folder) {
        folder.expanded = !folder.expanded;
        updateFileList();
    }
}

function deleteFile(filepath) {
    if (confirm(`Delete ${filepath}?`)) {
        state.files.delete(filepath);
        state.contextFiles.delete(filepath);
        state.lastSaveContent.delete(filepath);
        
        const index = state.openTabs.indexOf(filepath);
        if (index > -1) {
            state.openTabs.splice(index, 1);
        }
        
        if (state.activeFile === filepath) {
            if (state.openTabs.length > 0) {
                openFile(state.openTabs[0]);
            } else {
                state.activeFile = null;
                state.editor.setValue('');
            }
        }
        
        updateFileList();
        updateEditorTabs();
        updateContextIndicator();
        saveProject();
    }
}

function deleteFolder(folderPath) {
    if (confirm(`Delete folder ${folderPath} and all its contents?`)) {
        const folder = state.folders.get(folderPath);
        if (!folder) return;
        
        const deleteRecursive = (path) => {
            const f = state.folders.get(path);
            if (f && f.children) {
                f.children.forEach(childPath => {
                    if (state.folders.has(childPath)) {
                        deleteRecursive(childPath);
                    } else if (state.files.has(childPath)) {
                        deleteFile(childPath);
                    }
                });
            }
            state.folders.delete(path);
            state.contextFiles.delete(path);
        };
        
        deleteRecursive(folderPath);
        
        if (folder.parent) {
            const parent = state.folders.get(folder.parent);
            if (parent) {
                const index = parent.children.indexOf(folderPath);
                if (index > -1) {
                    parent.children.splice(index, 1);
                }
            }
        }
        
        updateFileList();
        updateContextIndicator();
        saveProject();
    }
}

function deletePromptFile(name) {
    if (confirm(`Delete attachment ${name}?`)) {
        state.promptUploads.delete(name);
        state.contextFiles.delete(`prompt_${name}`);
        updatePromptList();
        updateContextIndicator();
    }
}

function deleteInstructionsFile(name) {
    if (confirm(`Delete instruction ${name}?`)) {
        state.instructionsUploads.delete(name);
        state.contextFiles.delete(`instructions_${name}`);
        updateInstructionsList();
        updateContextIndicator();
    }
}

function showPromptFileContent(name) {
    const file = state.promptUploads.get(name);
    if (!file) return;
    
    if (file.isLongPrompt || file.type.startsWith('text/')) {
        const tempPath = `[Attachment] ${name}`;
        state.files.set(tempPath, {
            name: name,
            path: tempPath,
            content: file.content,
            size: file.size,
            type: file.type,
            modified: new Date().toISOString(),
            isTemporary: true
        });
        openFile(tempPath);
    }
}

function showInstructionsFileContent(name) {
    const file = state.instructionsUploads.get(name);
    if (!file) return;
    
    if (file.type.startsWith('text/')) {
        const tempPath = `[Instruction] ${name}`;
        state.files.set(tempPath, {
            name: name,
            path: tempPath,
            content: file.content,
            size: file.size,
            type: file.type,
            modified: new Date().toISOString(),
            isTemporary: true
        });
        openFile(tempPath);
    }
}

// ============================================================================
// PROJECT UTILITIES (unchanged)
// ============================================================================

function generateFileTree() {
    const tree = [];
    const processedPaths = new Set();
    
    const addToTree = (path, level = 0) => {
        const indent = '  '.repeat(level);
        const parts = path.split('/');
        const name = parts[parts.length - 1];
        
        if (state.files.has(path) && !state.files.get(path).isTemporary && 
            !state.promptUploads.has(state.files.get(path).name) && 
            !state.instructionsUploads.has(state.files.get(path).name)) {
            tree.push(`${indent}├── ${name}`);
        } else if (state.folders.has(path)) {
            tree.push(`${indent}├── ${name}/`);
            const folder = state.folders.get(path);
            if (folder.children) {
                folder.children.forEach(child => {
                    if (!processedPaths.has(child)) {
                        processedPaths.add(child);
                        addToTree(child, level + 1);
                    }
                });
            }
        }
    };
    
    state.folders.forEach((folder, path) => {
        if (!folder.parent && !processedPaths.has(path)) {
            processedPaths.add(path);
            addToTree(path);
        }
    });
    
    state.files.forEach((file, path) => {
        if (!path.includes('/') && !processedPaths.has(path) && !file.isTemporary && 
            !state.promptUploads.has(file.name) && !state.instructionsUploads.has(file.name)) {
            processedPaths.add(path);
            addToTree(path);
        }
    });
    
    return tree.join('\n');
}