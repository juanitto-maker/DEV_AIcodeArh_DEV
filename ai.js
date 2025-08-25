// File: AIcodeArh-main/ai.js
// [2025-08-12, 19:59:39] Revision 1 - Initial generation

// AI integration with enhanced 3-agent system
// File: ai.js
// [2025-08-12, 23:51:07] Revision 6 - Content updated

// ============================================================================
// RESILIENT EXECUTION LOOP
// ============================================================================

async function executeWithStrategies(message, analysis, agent) {
    const loopState = state.executionLoop;
    loopState.errorLog = [];
    loopState.isRetrying = false;

    for (let attempt = 1; attempt <= loopState.maxAttempts; attempt++) {
        loopState.attemptCount = attempt;
        loopState.currentStrategy = loopState.strategies[attempt - 1] || 'Final Attempt';

        const statusMessage = `Calling AI... (Attempt ${attempt}/${loopState.maxAttempts}, Strategy: ${loopState.currentStrategy})`;
        updateConversationState(statusMessage);
        
        try {
            const simplifyContext = loopState.currentStrategy === 'Simplified Context';
            const context = prepareEnhancedAgentContext(agent, { simplify: simplifyContext });
            
            if (simplifyContext) {
                console.log(`Using simplified context for attempt ${attempt}`);
            }

            const response = await callAIWithAgent(message, context, analysis, agent);
            
            // Success! Reset state and return.
            loopState.isRetrying = false;
            updateConversationState(`✅ AI call successful on attempt ${attempt}`);
            setTimeout(() => updateConversationState(), 4000);
            return response;

        } catch (error) {
            console.error(`Attempt ${attempt} failed with strategy "${loopState.currentStrategy}":`, error);
            loopState.errorLog.push({ attempt, strategy: loopState.currentStrategy, error: error.message });

            const isRetriable = error.message.includes('503') || error.message.includes('UNAVAILABLE') || error.message.includes('overloaded');

            if (isRetriable && attempt < loopState.maxAttempts) {
                loopState.isRetrying = true;
                const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s
                const retryMessage = `⚠️ Model overloaded. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${loopState.maxAttempts})`;
                updateConversationState(retryMessage);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Go to next attempt
            } else {
                // Non-retriable error or final attempt failed
                console.error('AI call failed after all retries or due to a non-retriable error.');
                throw error; // Re-throw the last error to be caught by sendMessage
            }
        }
    }

    // This part should not be reached if logic is correct, but as a fallback:
    throw new Error('AI execution failed after all strategies.');
}

// ============================================================================
// ENHANCED CHAT AND AI INTEGRATION WITH AGENT-SPECIFIC CONTEXT
// ============================================================================

async function sendMessage() {

    const input = document.getElementById('messageInput');
    let message = input.value.trim();
    if (!message) return;
    
    // Check if any agents are enabled
    if (!hasEnabledAgents()) {
        addMessage('assistant', '⚠️ No agents are currently enabled! Please enable at least one agent (🔨 Generator, 🔧 Tweaker, or 🐛 Debugger) to continue.');
        return;
    }
    
    // Handle long prompts by converting to attachments
    if (message.length > 2000) {
        const filename = `prompt_${Date.now()}.txt`;
        state.promptUploads.set(filename, {
            name: filename,
            content: message,
            type: 'text/plain',
            size: new Blob([message]).size,
            isLongPrompt: true
        });
        state.contextFiles.add(`prompt_${filename}`);
        updatePromptList();
        updateContextIndicator();
        
        message = `[Long prompt converted to attachment: ${filename}]`;
    }
    
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner"></span>';
    
    addMessage('user', message);
    input.value = '';
    input.rows = 1;
    
    // Reset input expansion
    if (inputExpanded) {
        toggleInputExpansion();
    }
    
    // Add to chat context
    state.chatContext.push({ role: 'user', content: message });
    
    try {
        // ENHANCED: Smart agent detection and routing
        const selectedAgent = detectBestAgent(message);
        
        if (!selectedAgent) {
            addMessage('assistant', '❌ No suitable agent available for this request. Please enable the appropriate agents.');
            return;
        }
        
        // Show which agent is handling the request with model info
        const agentStatus = `${selectedAgent.icon} ${selectedAgent.name} Agent activated (${selectedAgent.model})`;
        updateConversationState(agentStatus);
        
        // Enhanced request analysis with agent context
        const requestAnalysis = analyzeRequest(message, selectedAgent);
        
        // Update conversation state based on request type and agent
        updateConversationStateForAgent(requestAnalysis, selectedAgent);
        
        // NEW: Call the resilient execution wrapper
        const response = await executeWithStrategies(message, requestAnalysis, selectedAgent);
        
        // Add AI response to chat context
        state.chatContext.push({ role: 'assistant', content: response });
        
        // Process response with agent-specific handling
        processAIResponseWithAgent(response, selectedAgent, requestAnalysis);
        
    } catch (error) {
        addMessage('assistant', `Error after ${state.executionLoop.attemptCount} attempt(s): ${error.message}`);
        updateConversationState('❌ AI call failed. Please try again.');
    } finally {

        sendBtn.disabled = false;
        sendBtn.innerHTML = '➤';
    }
}

// ============================================================================
// ENHANCED REQUEST ANALYSIS AND AGENT ROUTING
// ============================================================================

function analyzeRequest(message, selectedAgent) {
    const lowerMessage = message.toLowerCase();
    
    // Basic request type detection
    const isProjectRequest = checkProjectRequest(message);
    const isModificationRequest = checkModificationRequest(message);
    const isDebuggingRequest = checkDebuggingRequest(message);
    const isConfirmingGeneration = checkConfirmationRequest(message);
    
    // Enhanced analysis with agent context
    const analysis = {
        type: 'general',
        isProjectRequest,
        isModificationRequest,
        isDebuggingRequest,
        isConfirmingGeneration,
        agent: selectedAgent,
        priority: 'normal',
        complexity: 'simple',
        requiresFiles: state.files.size > 0,
        hasErrors: lowerMessage.includes('error') || lowerMessage.includes('not work') || lowerMessage.includes('fix'),
        isNewProject: lowerMessage.includes('new project') || lowerMessage.includes('create app') || lowerMessage.includes('build'),
        technologies: detectTechnologies(message),
        confidence: calculateAgentConfidence(message, selectedAgent),
        hasAgentInstructions: selectedAgent.instructions.size > 0
    };
    
    // Determine request type based on agent and content
    if (isConfirmingGeneration && state.conversationState === 'confirming') {
        analysis.type = 'confirmation';
    } else if (isProjectRequest && selectedAgent.id === 'generator') {
        analysis.type = 'project_creation';
        analysis.complexity = detectComplexity(message);
    } else if (isModificationRequest && selectedAgent.id === 'tweaker') {
        analysis.type = 'code_modification';
        analysis.priority = analysis.hasErrors ? 'high' : 'normal';
    } else if (isDebuggingRequest && selectedAgent.id === 'debugger') {
        analysis.type = 'debugging';
        analysis.priority = 'high';
    } else {
        analysis.type = 'general_assistance';
    }
    
    return analysis;
}

function checkProjectRequest(message) {
    const projectKeywords = [
        'build', 'create', 'make', 'develop', 'generate',
        'scaffold', 'setup', 'implement', 'design', 'architect',
        'start', 'initialize', 'new project'
    ];
    return projectKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

function checkModificationRequest(message) {
    const modifyKeywords = [
        'modify', 'update', 'change', 'edit', 'revise', 'fix',
        'add', 'remove', 'refactor', 'improve', 'enhance',
        'extend', 'customize', 'adjust', 'tweak'
    ];
    return modifyKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    ) && state.files.size > 0;
}

function checkDebuggingRequest(message) {
    const debugKeywords = [
        'debug', 'error', 'issue', 'problem', 'bug', 'broken',
        'not working', 'fix', 'solve', 'troubleshoot', 'repair',
        'crash', 'fail', 'exception'
    ];
    return debugKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

function checkConfirmationRequest(message) {
    const confirmKeywords = ['yes', 'generate', 'proceed', 'continue', 'go ahead', 'confirm'];
    return confirmKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    ) && state.conversationState === 'confirming';
}

function detectTechnologies(message) {
    const techMap = {
        'react': ['react', 'jsx', 'component'],
        'vue': ['vue', 'vuejs'],
        'angular': ['angular', 'ng'],
        'node': ['node', 'nodejs', 'express'],
        'python': ['python', 'django', 'flask'],
        'javascript': ['javascript', 'js', 'es6'],
        'typescript': ['typescript', 'ts'],
        'html': ['html', 'markup'],
        'css': ['css', 'styling', 'styles'],
        'database': ['database', 'sql', 'mongodb', 'mysql']
    };
    
    const detected = [];
    const lowerMessage = message.toLowerCase();
    
    Object.entries(techMap).forEach(([tech, keywords]) => {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
            detected.push(tech);
        }
    });
    
    return detected;
}

function detectComplexity(message) {
    const complexityIndicators = {
        simple: ['simple', 'basic', 'quick', 'small'],
        medium: ['medium', 'standard', 'typical'],
        complex: ['complex', 'advanced', 'enterprise', 'full', 'complete', 'comprehensive']
    };
    
    const lowerMessage = message.toLowerCase();
    
    if (complexityIndicators.complex.some(indicator => lowerMessage.includes(indicator))) {
        return 'complex';
    } else if (complexityIndicators.medium.some(indicator => lowerMessage.includes(indicator))) {
        return 'medium';
    }
    return 'simple';
}

function calculateAgentConfidence(message, agent) {
    let confidence = 0;
    const lowerMessage = message.toLowerCase();
    
    // Check keyword matches
    agent.keywords.forEach(keyword => {
        if (lowerMessage.includes(keyword.toLowerCase())) {
            confidence += 10;
        }
    });
    
    // Boost confidence for exact phrase matches
    agent.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
        const matches = lowerMessage.match(regex);
        if (matches) {
            confidence += matches.length * 5;
        }
    });
    
    return Math.min(confidence, 100);
}

// ============================================================================
// ENHANCED CONVERSATION STATE MANAGEMENT
// ============================================================================

function updateConversationStateForAgent(analysis, agent) {
    switch (analysis.type) {
        case 'project_creation':
            if (state.conversationState === 'ready') {
                state.conversationState = 'planning';
                updateConversationState(`${agent.icon} Planning project with ${agent.model}...`);
            }
            break;
        case 'confirmation':
            state.conversationState = 'generating';
            updateConversationState(`${agent.icon} Generating project with ${agent.model}...`);
            break;
        case 'code_modification':
            state.conversationState = 'modifying';
            updateConversationState(`${agent.icon} Modifying code with ${agent.model}...`);
            break;
        case 'debugging':
            state.conversationState = 'debugging';
            updateConversationState(`${agent.icon} Debugging with ${agent.model}...`);
            break;
        default:
            updateConversationState(`${agent.icon} ${agent.name} processing with ${agent.model}...`);
    }
}

function updateConversationState(customText = '') {
    const stateElement = document.getElementById('conversationState');
    if (!stateElement) return;
    
    const stateMap = {
        'ready': '',
        'planning': '📋 Planning...',
        'confirming': '❓ Awaiting confirmation...',
        'generating': '⚡ Generating project...',
        'modifying': '🔧 Modifying code...',
        'debugging': '🐛 Debugging...'
    };
    
    const displayText = customText || stateMap[state.conversationState] || '';
    stateElement.textContent = displayText;
}

// ============================================================================
// ENHANCED CONTEXT PREPARATION WITH AGENT-SPECIFIC INSTRUCTIONS
// ============================================================================

function prepareEnhancedAgentContext(selectedAgent, options = { simplify: false }) {
    const contextParts = [];
    
    try {

        // Add agent-specific header with model and instructions info
        contextParts.push('=== ACTIVE AGENT CONTEXT ===');
        contextParts.push(`Agent: ${selectedAgent.name} (${selectedAgent.icon})`);
        contextParts.push(`Description: ${selectedAgent.description}`);
        contextParts.push(`Model: ${selectedAgent.model}`);
        contextParts.push(`Specialization: ${selectedAgent.keywords.slice(0, 10).join(', ')}`);
        contextParts.push(`Agent Instructions: ${selectedAgent.instructions.size} custom instruction(s)`);
        contextParts.push('');
        
        // Add agent-specific instructions first (highest priority)
        if (selectedAgent.instructions.size > 0) {
            contextParts.push('=== AGENT-SPECIFIC INSTRUCTIONS ===');
            selectedAgent.instructions.forEach((instruction, name) => {
                const key = `agent_${selectedAgent.id}_${name}`;
                if (state.contextFiles.has(key)) {
                    contextParts.push(`--- ${selectedAgent.name} Instruction: ${name} ---`);
                    contextParts.push(instruction.content);
                    contextParts.push('');
                }
            });
        }
        
        // Add chat context (unless simplifying)
        if (!options.simplify) {
            contextParts.push('=== CHAT CONTEXT ===');
            if (state.chatContext && state.chatContext.length > 0) {
                state.chatContext.slice(-10).forEach(msg => {
                    contextParts.push(`${msg.role.toUpperCase()}: ${msg.content}`);
                });
            }
            contextParts.push('');
        } else {
            contextParts.push('=== CHAT CONTEXT (SIMPLIFIED) ===');
            contextParts.push('Chat history omitted to reduce request size for this attempt.');
            contextParts.push('');
        }

        
        // Add project structure
        contextParts.push('=== PROJECT STRUCTURE ===');
        if (typeof generateFileTree === 'function') {
            contextParts.push(generateFileTree());
        } else {
            contextParts.push('File tree generation unavailable');
        }
        contextParts.push('');
        
        // Add agent system status
        const agentStatus = getAgentStatusText();
        contextParts.push('=== AGENT SYSTEM STATUS ===');
        contextParts.push(agentStatus);
        contextParts.push(`Selected Agent Model: ${selectedAgent.model}`);
        contextParts.push(`Agent Instructions Available: ${selectedAgent.instructions.size > 0 ? 'Yes' : 'No'}`);
        contextParts.push('');
        
        // Add general instructions (after agent-specific ones)
        if (state.contextFiles && state.instructionsUploads) {
            state.contextFiles.forEach(key => {
                if (key.startsWith('instructions_')) {
                    const name = key.substring(13);
                    const file = state.instructionsUploads.get(name);
                    if (file) {
                        contextParts.push(`=== GENERAL INSTRUCTION: ${name} ===`);
                        contextParts.push(file.content);
                        contextParts.push('');
                    }
                }
            });
        }
        
        // Add prompt attachments
        if (state.contextFiles && state.promptUploads) {
            state.contextFiles.forEach(key => {
                if (key.startsWith('prompt_')) {
                    const name = key.substring(7);
                    const file = state.promptUploads.get(name);
                    if (file) {
                        contextParts.push(`=== PROMPT ATTACHMENT: ${name} ===`);
                        if (file.type && file.type.startsWith('image/')) {
                            contextParts.push(`[Image: ${name}]`);
                        } else {
                            contextParts.push(file.content);
                        }
                        contextParts.push('');
                    }
                }
            });
        }
        
     // Replace the existing section in prepareEnhancedAgentContext function in ai.js
// Starting from line ~500 where it says "// Add contextualized files (prioritize by agent relevance)"

// Add contextualized files (prioritize by agent relevance)
if (state.contextFiles && state.files) {
    const relevantFiles = [];
    const otherFiles = [];
    
    // First, check if project context is enabled and add ALL project files if it is
    if (state.projectContextEnabled) {
        state.files.forEach((file, key) => {
            if (!file.isTemporary && 
                !state.promptUploads.has(file.name) && 
                !state.instructionsUploads.has(file.name)) {
                // Add all project files to context
                if (!state.contextFiles.has(key)) {
                    state.contextFiles.add(key);
                }
            }
        });
    }
    
    // Now process contextualized files
    state.contextFiles.forEach(key => {
        if (!key.startsWith('prompt_') && !key.startsWith('instructions_') && !key.startsWith('agent_')) {
            const file = state.files.get(key);
            if (file && !file.isTemporary) {
                // Prioritize files relevant to agent
                if (isFileRelevantToAgent(file, selectedAgent)) {
                    relevantFiles.push({ key, file });
                } else {
                    otherFiles.push({ key, file });
                }
            }
        }
    });
    
    // Add a debug log to see what's being included
    console.log('Context files being included:', {
        relevant: relevantFiles.length,
        other: otherFiles.length,
        total: relevantFiles.length + otherFiles.length,
        projectContextEnabled: state.projectContextEnabled,
        contextFilesSize: state.contextFiles.size
    });
    
    // Add relevant files first
    if (relevantFiles.length > 0) {
        contextParts.push('=== PROJECT FILES (RELEVANT) ===');
        relevantFiles.forEach(({ key, file }) => {
            contextParts.push(`=== FILE: ${key} ===`);
            contextParts.push(file.content || '');
            contextParts.push('');
        });
    }
    
    // Then add other files
    if (otherFiles.length > 0) {
        contextParts.push('=== PROJECT FILES (OTHER) ===');
        otherFiles.forEach(({ key, file }) => {
            contextParts.push(`=== FILE: ${key} ===`);
            contextParts.push(file.content || '');
            contextParts.push('');
        });
    }
    
    // If no files were added, explicitly state this
    if (relevantFiles.length === 0 && otherFiles.length === 0) {
        contextParts.push('=== NO PROJECT FILES IN CONTEXT ===');
        contextParts.push('Project files exist: ' + (state.files.size > 0 ? 'Yes' : 'No'));
        contextParts.push('Context enabled: ' + state.projectContextEnabled);
        contextParts.push('Files in context set: ' + state.contextFiles.size);
        contextParts.push('');
    }
}
        
        // Add active file if not in context
        if (state.activeFile && state.files && (!state.contextFiles || !state.contextFiles.has(state.activeFile))) {
            const file = state.files.get(state.activeFile);
            if (file && !file.isTemporary) {
                contextParts.push(`=== ACTIVE FILE: ${state.activeFile} ===`);
                contextParts.push(file.content || '');
                contextParts.push('');
            }
        }
        
        // Add enhanced agent-specific context guidance
        const agentContext = getEnhancedAgentSpecificContext(selectedAgent);
        if (agentContext) {
            contextParts.push('=== ENHANCED AGENT GUIDANCE ===');
            contextParts.push(agentContext);
            contextParts.push('');
        }
        
    } catch (error) {
        console.error('Error preparing enhanced agent context:', error);
        contextParts.push('=== ERROR IN CONTEXT PREPARATION ===');
        contextParts.push('Basic context only');
        contextParts.push('');
    }
    
    return contextParts.join('\n');
}

function isFileRelevantToAgent(file, agent) {
    const fileExt = file.path.split('.').pop().toLowerCase();
    const fileName = file.name.toLowerCase();
    const fileContent = (file.content || '').toLowerCase();
    
    // Check file relevance based on agent type
    switch (agent.id) {
        case 'generator':
            // Generator cares about all files for project creation
            return true;
        case 'tweaker':
            // Tweaker cares about code files and configuration
            const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rb', 'php', 'swift', 'rs'];
            return codeExtensions.includes(fileExt) || fileName.includes('config') || fileName.includes('package');
        case 'debugger':
            // Debugger cares about error logs, tests, and problematic files
            return fileName.includes('error') || fileName.includes('log') || fileName.includes('test') || 
                   fileContent.includes('error') || fileContent.includes('exception') || fileContent.includes('bug');
        default:
            return false;
    }
}

function getEnhancedAgentSpecificContext(agent) {
    const baseGuidance = getAgentSpecificContext(agent);
    
    // Add instruction-specific guidance if agent has custom instructions
    let instructionGuidance = '';
    if (agent.instructions.size > 0) {
        instructionGuidance = `

CUSTOM INSTRUCTIONS INTEGRATION:
- You have ${agent.instructions.size} custom instruction(s) loaded for this agent
- These instructions should guide your behavior and decision-making
- Follow custom instructions while maintaining your core agent specialization
- If custom instructions conflict with core behavior, prioritize custom instructions`;
    }
    
    // Add model-specific guidance
    const modelGuidance = `

MODEL-SPECIFIC OPTIMIZATION:
- Current model: ${agent.model}
- Optimize responses for this model's strengths and capabilities
- Maintain consistent quality regardless of model selection`;
    
    return baseGuidance + instructionGuidance + modelGuidance;
}

function getAgentSpecificContext(agent) {
    switch (agent.id) {
        case 'generator':
            return `Project Creation Guidelines:
- Always use gemini-1.5-flash as default model for API dependencies unless custom instructions specify otherwise
- Focus on clean, modern, production-ready code
- Include proper project structure and documentation
- Consider scalability and best practices
- Create comprehensive file structures with proper organization`;
        case 'tweaker':
            return `Code Modification Guidelines:
- Use MODIFY_START/MODIFY_END format for all changes
- Preserve existing code style and patterns
- Focus on incremental improvements
- Maintain backward compatibility when possible
- Test modifications mentally before applying`;
        case 'debugger':
            return `Debugging Guidelines:
- Identify root causes, not just symptoms
- Provide clear explanations of issues found
- Suggest preventive measures for future issues
- Test fixes mentally before applying
- Document debugging process and solutions`;
        default:
            return null;
    }
}

// ============================================================================
// ENHANCED AI API CALLING WITH AGENT CONFIGURATION
// ============================================================================

async function callAIWithAgent(message, context, analysis, selectedAgent) {
    // Use the selected agent's preferred model (from dropdown selection)
    const model = selectedAgent.model;
    const apiKey = getApiKeyForModel(model);
    
    if (!apiKey) {
        throw new Error(`Please set up API keys for ${model.split('-')[0]} first`);
    }
    
    // Build enhanced system prompt with agent specialization and instructions
    const systemPrompt = buildEnhancedAgentSystemPrompt(selectedAgent, analysis);
    
    const fullPrompt = `${systemPrompt}\n\nContext:\n${context}\n\nUser: ${message}`;
    
    // Log agent selection with model and instructions info for debugging
    console.log(`🤖 ${selectedAgent.name} Agent selected for request:`, {
        type: analysis.type,
        confidence: analysis.confidence,
        model: model,
        complexity: analysis.complexity,
        hasInstructions: selectedAgent.instructions.size > 0,
        instructionCount: selectedAgent.instructions.size
    });
    
    // Call appropriate API based on model
    if (model.startsWith('claude')) {
        return await callClaude(fullPrompt, apiKey, model);
    } else if (model.startsWith('gemini')) {
        return await callGemini(fullPrompt, apiKey, model);
    } else if (model.startsWith('llama') || model.startsWith('mixtral') || model.startsWith('gemma') || model.startsWith('openai/')) {
        return await callGroq(fullPrompt, apiKey, model);
    }
    
    throw new Error(`Unknown model: ${model}`);
}

function buildEnhancedAgentSystemPrompt(agent, analysis) {
    // Start with agent's base system prompt
    let systemPrompt = agent.systemPrompt;
    
    // Add agent-specific instructions if they exist and are in context
    if (agent.instructions.size > 0) {
        const activeInstructions = [];
        agent.instructions.forEach((instruction, name) => {
            const key = `agent_${agent.id}_${name}`;
            if (state.contextFiles.has(key)) {
                activeInstructions.push(`${name}: ${instruction.content}`);
            }
        });
        
        if (activeInstructions.length > 0) {
            systemPrompt += `\n\n=== AGENT-SPECIFIC CUSTOM INSTRUCTIONS ===\nThese custom instructions override default behavior when applicable:\n\n${activeInstructions.join('\n\n')}`;
        }
    }
    
    // Add request-specific enhancements
    const requestContext = `

REQUEST ANALYSIS:
- Type: ${analysis.type}
- Complexity: ${analysis.complexity}
- Priority: ${analysis.priority}
- Agent Confidence: ${analysis.confidence}%
- Technologies Detected: ${analysis.technologies.join(', ') || 'None'}
- Has Existing Files: ${analysis.requiresFiles}
- Contains Errors: ${analysis.hasErrors}
- Is New Project: ${analysis.isNewProject}
- Agent Model: ${agent.model}
- Custom Instructions: ${analysis.hasAgentInstructions ? 'Active' : 'None'}`;
    
    // Add universal rules
    const universalRules = `

UNIVERSAL CRITICAL RULES:
1. ALWAYS use gemini-1.5-flash as the default model for all API dependencies unless explicitly specified otherwise or overridden by custom instructions.
2. When users request project creation, first propose a detailed plan, then when confirmed, generate files using FILE_START/FILE_END format.
3. ALL generated code goes directly to the editor using FILE_START/FILE_END markers - NEVER show code in chat responses.
4. Chat responses should only contain discussions, plans, and reports - NO code blocks.
5. For modifications, use MODIFY_START/MODIFY_END format with exact matching text.
6. Follow agent-specific custom instructions when they are provided and active.
7. CRITICAL: Never use markdown code block syntax ('''html, '''js, '''css, etc.) inside FILE_START/FILE_END blocks.
8. CRITICAL: File content must be clean code without any markdown formatting or code block markers.
9. CRITICAL: Do not wrap generated file content in backticks, code blocks, or markdown syntax.`;
    
    // Add modification rules if relevant
    const modificationRules = analysis.type === 'code_modification' ? `

MODIFICATION RULES:
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
5. If unsure about exact content, ask to see the current file first` : '';
    
    // Add generation rules if relevant
    const generationRules = analysis.type === 'project_creation' ? `

PROJECT GENERATION RULES:
For project generation, use this format:
FILE_START: path/to/file.ext
[complete file content]
FILE_END

For project plans, include:
- Clear project structure
- Technology stack (default: gemini-1.5-flash for APIs unless overridden)
- Key features
- Implementation approach` : '';
    
    return systemPrompt + requestContext + universalRules + modificationRules + generationRules;
}

// ============================================================================
// API CALLING FUNCTIONS (unchanged but enhanced with error handling)
// ============================================================================

async function callClaude(prompt, apiKey, model) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
}

async function callGemini(prompt, apiKey, model) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callGroq(prompt, apiKey, model) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

function getApiKeyForModel(model) {
    if (model.startsWith('claude')) return state.apiKeys.claude;
    if (model.startsWith('gemini')) return state.apiKeys.gemini;
    if (model.startsWith('llama') || model.startsWith('mixtral') || model.startsWith('gemma') || model.startsWith('openai/')) return state.apiKeys.groq;
    return null;
}

// ============================================================================
// ENHANCED AI RESPONSE PROCESSING WITH AGENT FEEDBACK
// ============================================================================

function processAIResponseWithAgent(response, selectedAgent, analysis) {
    console.log(`Processing ${selectedAgent.name} Agent response for ${analysis.type} with ${selectedAgent.model}:`, response.substring(0, 200) + '...');
    
    // Show agent completion message with performance info
    if (selectedAgent) {
        console.log(`✅ Response processed by ${selectedAgent.name} Agent (${selectedAgent.icon}) using ${selectedAgent.model} - Confidence: ${analysis.confidence}%`);
    }
    
    // Check for modifications first
    const modifyMatches = response.match(/MODIFY_START:\s*(.+?)\nFIND:\n([\s\S]*?)\nREPLACE:\n([\s\S]*?)MODIFY_END/g);
    if (modifyMatches && modifyMatches.length > 0) {
        console.log(`🔧 ${selectedAgent.name} Agent found ${modifyMatches.length} modification blocks`);
        state.conversationState = 'modifying';
        updateConversationState(`${selectedAgent.icon} Applying modifications with ${selectedAgent.model}...`);
        
        const modifications = applyModifications(response);
        
        // Extract and show modification report
        const reportMatch = response.match(/MODIFICATION_REPORT_START([\s\S]*?)MODIFICATION_REPORT_END/);
        if (reportMatch) {
            addModificationReport(reportMatch[1].trim());
        }
        
        // Show any additional text (excluding code blocks and reports)
        const cleanedResponse = response
            .replace(/MODIFY_START[\s\S]*?MODIFY_END/g, '')
            .replace(/MODIFICATION_REPORT_START[\s\S]*?MODIFICATION_REPORT_END/g, '')
            .replace(/FILE_START[\s\S]*?FILE_END/g, '')
            .trim();
        
        if (cleanedResponse) {
            addMessage('assistant', cleanedResponse);
        }
        
        // Show enhanced agent performance summary
        showEnhancedAgentPerformanceSummary(selectedAgent, 'modification', modifications.length);
        
        state.conversationState = 'ready';
        updateConversationState();
        return;
    }
    
    // Check for file generation
    const fileMatches = response.match(/FILE_START:\s*(.+?)\n([\s\S]*?)FILE_END/g);
    if (fileMatches && fileMatches.length > 0) {
        console.log(`🔨 ${selectedAgent.name} Agent found ${fileMatches.length} file generation blocks`);
        state.conversationState = 'generating';
        updateConversationState(`${selectedAgent.icon} Generating files with ${selectedAgent.model}...`);
        
        // Extract text part (without code)
        const textPart = response.replace(/FILE_START[\s\S]*?FILE_END/g, '').trim();
        if (textPart) {
            addMessage('assistant', textPart);
        }
        
        // Generate files directly to editor
        generateProjectFiles(response, selectedAgent);
        
        // Show enhanced agent performance summary
        showEnhancedAgentPerformanceSummary(selectedAgent, 'generation', fileMatches.length);
        
        state.conversationState = 'ready';
        updateConversationState();
        return;
    }
    
    // Check for project plan with proper button generation
    if (response.includes('Project Structure:') || response.includes('## Project Plan') || 
        response.includes('### Project Overview') || response.includes('## Project Overview') ||
        (response.includes('project') && response.includes('structure') && response.includes('implement'))) {
        console.log(`📋 ${selectedAgent.name} Agent detected project plan`);
        state.conversationState = 'confirming';
        updateConversationState(`${selectedAgent.icon} Awaiting confirmation...`);
        addEnhancedProjectPlanMessage(response, selectedAgent);
        return;
    }
    
    // Normal response (no code blocks shown in chat)
    const cleanedResponse = response.replace(/```[\s\S]*?```/g, '[Code applied to editor]');
    addMessage('assistant', cleanedResponse);
    
    // Show enhanced agent completion status with model and instruction info
    if (selectedAgent) {
        const instructionInfo = selectedAgent.instructions.size > 0 ? ` + ${selectedAgent.instructions.size} custom instructions` : '';
        const performanceText = `${selectedAgent.icon} ${selectedAgent.name} completed using ${selectedAgent.model}${instructionInfo} (${analysis.confidence}% confidence)`;
        updateConversationState(performanceText);
        setTimeout(() => updateConversationState(), 6000); // Clear after 6 seconds
    }
}

function showEnhancedAgentPerformanceSummary(agent, actionType, itemCount) {
    const actionMap = {
        'modification': 'modified',
        'generation': 'generated',
        'debugging': 'debugged'
    };
    
    const action = actionMap[actionType] || 'processed';
    const itemText = itemCount === 1 ? 'item' : 'items';
    const instructionInfo = agent.instructions.size > 0 ? `\n**Custom Instructions:** ${agent.instructions.size} active` : '';
    
    addMessage('assistant', `✅ **${agent.icon} ${agent.name} Agent Performance Summary**

**Action:** ${action} ${itemCount} ${itemText}
**Model Used:** ${agent.model}
**Specialization:** ${agent.description}${instructionInfo}

${agent.name} Agent completed the ${actionType} successfully using ${agent.model}!`);
}

// ============================================================================
// ENHANCED MODIFICATION SYSTEM (unchanged but logged with agent info)
// ============================================================================

function applyModifications(response) {
    const modifyRegex = /MODIFY_START:\s*(.+?)\nFIND:\n([\s\S]*?)\nREPLACE:\n([\s\S]*?)MODIFY_END/g;
    const modifications = [];
    let match;
    
    console.log('=== APPLYING MODIFICATIONS ===');
    console.log('Full response length:', response.length);
    
    while ((match = modifyRegex.exec(response)) !== null) {
        const filepath = match[1].trim();
        const findText = match[2];  // Don't trim - preserve exact whitespace
        const replaceText = match[3]; // Don't trim - preserve exact whitespace
        
        console.log(`\n--- Processing modification for: ${filepath} ---`);
        console.log('Find text length:', findText.length);
        console.log('Replace text length:', replaceText.length);
        console.log('Find text preview:', findText.substring(0, 100) + '...');
        
        const file = state.files.get(filepath);
        if (!file) {
            console.error(`❌ File not found: ${filepath}`);
            continue;
        }
        
        const originalContent = file.content;
        console.log('Original file content length:', originalContent.length);
        
        // Method 1: Try exact match first
        let newContent = originalContent.replace(findText, replaceText);
        
        if (originalContent === newContent) {
            console.log('❌ Exact match failed, trying normalized matching...');
            
            // Method 2: Try with normalized whitespace
            const normalizedFind = findText.replace(/\s+/g, ' ').trim();
            const normalizedOriginal = originalContent.replace(/\s+/g, ' ');
            
            if (normalizedOriginal.includes(normalizedFind)) {
                console.log('✅ Found with normalized whitespace');
                
                // Find the actual position in original content
                const findLines = findText.split('\n');
                const originalLines = originalContent.split('\n');
                
                // Try to find matching lines
                let startLine = -1;
                for (let i = 0; i <= originalLines.length - findLines.length; i++) {
                    let matches = true;
                    for (let j = 0; j < findLines.length; j++) {
                        if (originalLines[i + j].trim() !== findLines[j].trim()) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) {
                        startLine = i;
                        break;
                    }
                }
                
                if (startLine >= 0) {
                    console.log(`✅ Found matching lines starting at line ${startLine + 1}`);
                    
                    // Replace the lines
                    const newLines = [...originalLines];
                    const replacementLines = replaceText.split('\n');
                    newLines.splice(startLine, findLines.length, ...replacementLines);
                    newContent = newLines.join('\n');
                }
            }
        }
        
        if (originalContent === newContent) {
            console.log('❌ All matching attempts failed');
            
            // Method 3: Try partial matching for debugging
            const findFirstLine = findText.split('\n')[0].trim();
            const originalContentLines = originalContent.split('\n');
            const matchingLines = originalContentLines
                .map((line, index) => ({ line: line.trim(), index }))
                .filter(item => item.line.includes(findFirstLine) || findFirstLine.includes(item.line))
                .slice(0, 5);
            
            console.log('Potential matching lines:', matchingLines);
            
            // Show user a helpful error
            addMessage('assistant', `⚠️ Could not apply modification to ${filepath}

**Find text not found:**
\`\`\`
${findText.substring(0, 200)}${findText.length > 200 ? '...' : ''}
\`\`\`

**Possible similar lines found:**
${matchingLines.map(item => `Line ${item.index + 1}: ${item.line}`).join('\n')}

The AI may have referenced outdated code. Try asking the AI to check the current file content first.`);
            
            continue;
        }
        
        // Apply the successful modification
        const changeInfo = {
            file: filepath,
            originalLength: originalContent.length,
            newLength: newContent.length,
            linesChanged: Math.abs(originalContent.split('\n').length - newContent.split('\n').length)
        };
        
        console.log(`✅ Successfully modified ${filepath}:`, changeInfo);
        
        // Update file content
        file.content = cleanFileContent (file.content, filepath);
        file.modified = new Date().toISOString();
        
        // Add revision comment if supported
        if (supportsComments(file.path)) {
            file.revision = (file.revision || 1) + 1;
            const lineInfo = `~${changeInfo.linesChanged} lines`;
            file.content = addRevisionComment(file.path, newContent, file.revision, 'AI modification', lineInfo);
        }
        
        // Update saved content tracking
        state.lastSaveContent.set(filepath, file.content);
        
        // Update editor if this is the active file
        if (state.activeFile === filepath && state.editor) {
            console.log(`🔄 Updating editor for active file: ${filepath}`);
            state.editor.setValue(file.content);
            
            // Fix editor background after update
            setTimeout(() => {
                if (typeof fixEditorBackground === 'function') {
                    fixEditorBackground();
                }
            }, 100);
        }
        
        // Auto-contextualize modified files
        if (!state.contextFiles.has(filepath)) {
            state.contextFiles.add(filepath);
            console.log(`📎 Auto-added ${filepath} to context`);
        }
        
        modifications.push({
            file: filepath,
            description: `Modified ${changeInfo.linesChanged} lines`,
            success: true
        });
    }
    
    if (modifications.length > 0) {
        console.log(`✅ Successfully applied ${modifications.length} modifications`);
        
        // Update UI
        updateFileList();
        updateContextIndicator();
        saveProject();
        
        // Show success message with agent context
        addMessage('assistant', `✅ Successfully modified ${modifications.length} file(s):

${modifications.map(mod => `• ${mod.file} - ${mod.description}`).join('\n')}

All changes have been applied and saved!`);
        
    } else {
        console.log('❌ No modifications were successfully applied');
        addMessage('assistant', `❌ No modifications could be applied. This usually means the AI referenced code that doesn't exactly match your current files. 

**To fix this:**
1. Ask the AI to first examine the current file content
2. Request modifications with more specific line references
3. Or ask the AI to show you the exact current content before making changes`);
    }
    
    return modifications;
}

// ============================================================================
// ENHANCED MESSAGE FUNCTIONS (with agent integration)
// ============================================================================

function addModificationReport(reportText) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-assistant';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const reportDiv = document.createElement('div');
    reportDiv.className = 'modification-report';
    reportDiv.innerHTML = `<h3>🔧 Modification Report</h3>`;
    
    const lines = reportText.split('\n');
    lines.forEach(line => {
        if (line.trim().startsWith('- File:')) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'modification-item';
            
            const parts = line.split(/\s{2,}|\n/);
            let fileInfo = '', locationInfo = '', featureInfo = '', changeInfo = '';
            
            parts.forEach(part => {
                if (part.includes('File:')) fileInfo = part;
                if (part.includes('Location:')) locationInfo = part;
                if (part.includes('Feature:')) featureInfo = part;
                if (part.includes('Change:')) changeInfo = part;
            });
            
            itemDiv.innerHTML = `
                <div class="modification-file">${fileInfo}</div>
                <div class="modification-details">${locationInfo}</div>
                <div class="modification-details">${featureInfo}</div>
                <div class="modification-description">${changeInfo}</div>
            `;
            
            reportDiv.appendChild(itemDiv);
        }
    });
    
    contentDiv.appendChild(reportDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addMessage(role, content) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Simple text content for chat (no code blocks)
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    state.messages.push({ role, content, timestamp: new Date().toISOString() });
}

function addEnhancedProjectPlanMessage(content, selectedAgent = null) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-assistant';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const planDiv = document.createElement('div');
    planDiv.className = 'project-plan';
    
    // Add enhanced agent header with model and instructions info
    if (selectedAgent) {
        const instructionCount = selectedAgent.instructions.size;
        const instructionInfo = instructionCount > 0 ? ` (${instructionCount} custom instructions active)` : '';
        
        const agentHeader = document.createElement('div');
        agentHeader.style.fontSize = '14px';
        agentHeader.style.marginBottom = '10px';
        agentHeader.style.color = 'var(--accent-blue)';
        agentHeader.innerHTML = `${selectedAgent.icon} <strong>${selectedAgent.name} Agent</strong> - ${selectedAgent.description}
        <br><small style="color: var(--text-secondary);">Model: ${selectedAgent.model}${instructionInfo}</small>`;
        planDiv.appendChild(agentHeader);
    }
    
    const lines = content.split('\n');
    let html = '';
    let inList = false;
    
    lines.forEach(line => {
        if (line.startsWith('##')) {
            html += `<h3>${line.replace(/^##\s*/, '')}</h3>`;
        } else if (line.startsWith('#')) {
            html += `<h3>${line.replace(/^#\s*/, '')}</h3>`;
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += `<li>${line.replace(/^[-*]\s*/, '')}</li>`;
        } else if (inList && line.trim() === '') {
            html += '</ul>';
            inList = false;
        } else if (line.trim()) {
            html += `<p>${line}</p>`;
        }
    });
    
    if (inList) html += '</ul>';
    
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = html;
    planDiv.appendChild(contentContainer);
    
    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'confirm-buttons';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm-btn';
    confirmBtn.innerHTML = `${selectedAgent?.icon || '✅'} Generate with ${selectedAgent?.model || 'AI'}`;
    confirmBtn.onclick = () => {
        const input = document.getElementById('messageInput');
        input.value = 'Yes, please generate the project with this structure.';
        sendMessage();
    };
    
    const modifyBtn = document.createElement('button');
    modifyBtn.className = 'confirm-btn modify-btn';
    modifyBtn.textContent = '✏️ Modify Plan';
    modifyBtn.onclick = () => {
        const input = document.getElementById('messageInput');
        input.focus();
        input.placeholder = 'Describe what changes you want to the plan...';
    };
    
    confirmDiv.appendChild(confirmBtn);
    confirmDiv.appendChild(modifyBtn);
    
    contentDiv.appendChild(planDiv);
    contentDiv.appendChild(confirmDiv);
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Step 2: Add this function in ai.js BEFORE generateProjectFiles function (around line 1150)

/**
 * Clean file content by removing markdown artifacts and code block syntax
 * @param {string} content - Raw file content
 * @param {string} filepath - File path for context
 * @returns {string} - Cleaned content
 */
function cleanFileContent(content, filepath) {
    if (!content) return content;
    
    // Remove markdown code block markers
    let cleaned = content;
    
    // Remove starting markdown code blocks ('''language or ```language)
    cleaned = cleaned.replace(/^'''[a-zA-Z]*\n?/, '');
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    
    // Remove ending markdown code blocks
    cleaned = cleaned.replace(/\n?'''$/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
    
    // Remove any remaining standalone ''' or ``` lines
    cleaned = cleaned.replace(/^\s*'''?\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*```?\s*$/gm, '');
    
    // Specific cleanup for HTML files
    if (filepath.endsWith('.html') || filepath.endsWith('.htm')) {
        // Remove any '''html at the start
        cleaned = cleaned.replace(/^'''html\s*\n?/i, '');
        cleaned = cleaned.replace(/^```html\s*\n?/i, '');
        
        // Ensure it starts with <!DOCTYPE or <html>
        cleaned = cleaned.trim();
        if (cleaned.startsWith('html\n')) {
            cleaned = cleaned.substring(5); // Remove 'html\n'
        }
    }
    
    // Specific cleanup for JavaScript files
    if (filepath.endsWith('.js') || filepath.endsWith('.jsx')) {
        cleaned = cleaned.replace(/^'''javascript\s*\n?/i, '');
        cleaned = cleaned.replace(/^```javascript\s*\n?/i, '');
        cleaned = cleaned.replace(/^'''js\s*\n?/i, '');
        cleaned = cleaned.replace(/^```js\s*\n?/i, '');
    }
    
    // Specific cleanup for CSS files
    if (filepath.endsWith('.css') || filepath.endsWith('.scss')) {
        cleaned = cleaned.replace(/^'''css\s*\n?/i, '');
        cleaned = cleaned.replace(/^```css\s*\n?/i, '');
    }
    
    // Remove extra leading/trailing whitespace but preserve intentional formatting
    cleaned = cleaned.replace(/^\s*\n/, ''); // Remove leading empty lines
    cleaned = cleaned.replace(/\n\s*$/, '\n'); // Normalize trailing whitespace
    
    return cleaned;
}

async function generateProjectFiles(response, selectedAgent = null) {
    console.log(`Starting project file generation with ${selectedAgent?.name || 'Unknown'} Agent using ${selectedAgent?.model || 'Unknown model'}`);
    
    if (!state.projectId) {
        state.projectId = 'project-' + Date.now();
    }
    
    const progressDiv = document.createElement('div');
    progressDiv.className = 'progress-bar';
    const modelInfo = selectedAgent?.model ? ` using ${selectedAgent.model}` : '';
    progressDiv.innerHTML = `
        <div class="progress-bar-header">${selectedAgent?.icon || '⚡'} ${selectedAgent?.name || 'AI'} Agent generating project files${modelInfo}...</div>
        <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: 0%"></div>
        </div>
        <div class="progress-bar-status">Starting...</div>
    `;
    
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.appendChild(progressDiv);
    
    const fileRegex = /FILE_START:\s*(.+?)\n([\s\S]*?)FILE_END/g;
    const files = [];
    let match;
    
    while ((match = fileRegex.exec(response)) !== null) {
    const filepath = match[1].trim();
    const rawContent = match[2];
    const cleanedContent = cleanFileContent(rawContent, filepath);
    
    files.push({
        path: filepath,
        content: cleanedContent
    });
}
    
    console.log(`Found ${files.length} files to generate`);
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i + 1) / files.length) * 100;
        
        progressDiv.querySelector('.progress-bar-fill').style.width = `${progress}%`;
        progressDiv.querySelector('.progress-bar-status').textContent = `Creating ${file.path}...`;
        
        await createFileWithPath(file.path, file.content, true); // Auto-contextualize
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const completionMessage = selectedAgent?.model ? ` using ${selectedAgent.model}` : '';
    progressDiv.querySelector('.progress-bar-header').innerHTML = `${selectedAgent?.icon || '✅'} Project generated successfully by ${selectedAgent?.name || 'AI'} Agent${completionMessage}!`;
    progressDiv.querySelector('.progress-bar-fill').style.width = '100%';
    progressDiv.querySelector('.progress-bar-status').textContent = `Created ${files.length} files`;
    
    const readmePath = Array.from(state.files.keys()).find(path => 
        path.toLowerCase() === 'readme.md' || path.toLowerCase().endsWith('/readme.md')
    );
    
    if (readmePath) {
        openFile(readmePath);
    } else if (files.length > 0) {
        openFile(files[0].path);
    }
    
    if (state.editorCollapsed && state.files.size > 0) {
        toggleEditor();
    }
    
    saveProject();
    console.log(`Project generation completed by ${selectedAgent?.name || 'AI'} Agent using ${selectedAgent?.model || 'Unknown model'}`);
}

// ============================================================================
// API KEY MANAGEMENT (unchanged)
// ============================================================================

function showApiKeySetup() {
    document.getElementById('claudeApiKey').value = state.apiKeys.claude || '';
    document.getElementById('geminiApiKey').value = state.apiKeys.gemini || '';
    document.getElementById('groqApiKey').value = state.apiKeys.groq || '';
    
    document.getElementById('dialogOverlay').style.display = 'block';
    document.getElementById('apiKeySetup').style.display = 'block';
}

function closeApiKeySetup() {
    document.getElementById('dialogOverlay').style.display = 'none';
    document.getElementById('apiKeySetup').style.display = 'none';
}

function saveApiKeys() {
    state.apiKeys.claude = document.getElementById('claudeApiKey').value;
    state.apiKeys.gemini = document.getElementById('geminiApiKey').value;
    state.apiKeys.groq = document.getElementById('groqApiKey').value;
    
    localStorage.setItem('apiKeys', JSON.stringify(state.apiKeys));
    
    closeApiKeySetup();
}