// File: AIcodeArh-main/ui.js
// [2025-08-19, Fixed] - Removed duplicate functions, fixed agent handlers

// UI functionality extracted for mobile development
// File: ui.js

// ============================================================================
// ENHANCED FLOATING INPUT CONTAINER FUNCTIONS WITH AGENT INTEGRATION
// ============================================================================

let inputVisible = true;
let inputExpanded = false;
let contextDropdownVisible = false;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let containerStartX = 0;
let containerStartY = 0;
let longPressTimer = null;

function toggleInputVisibility() {
    const container = document.getElementById('floatingInput');
    const toggle = document.getElementById('showHideToggle');
    
    inputVisible = !inputVisible;
    
    if (inputVisible) {
        container.style.transform = 'translateX(-50%) translateY(0)';
        container.style.opacity = '1';
        toggle.textContent = '◐';
    } else {
        container.style.transform = 'translateX(-50%) translateY(100px)';
        container.style.opacity = '0.3';
        toggle.textContent = '○';
    }
}

function toggleInputExpansion() {
    const container = document.getElementById('floatingInput');
    const wrapper = document.getElementById('inputWrapper');
    const input = document.getElementById('messageInput');
    
    inputExpanded = !inputExpanded;
    
    if (inputExpanded) {
        container.classList.add('expanded');
        wrapper.classList.add('expanded');
        input.classList.add('expanded');
        input.rows = 4;
    } else {
        container.classList.remove('expanded');
        wrapper.classList.remove('expanded');
        input.classList.remove('expanded');
        input.rows = 1;
    }
}

// FIXED: Single unified context dropdown function
function toggleContextDropdown() {
    const dropdown = document.getElementById('contextDropdown');
    const button = document.querySelector('.context-button');
    
    contextDropdownVisible = !contextDropdownVisible;
    
    if (contextDropdownVisible) {
        dropdown.classList.add('show');
        updateEnhancedContextDropdownContent();
        
        // Add opening animation
        dropdown.style.opacity = '0';
        dropdown.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => {
            dropdown.style.opacity = '1';
            dropdown.style.transform = 'translateY(0) scale(1)';
        }, 10);
        
        // Highlight context button
        if (button) {
            button.style.transform = 'scale(1.1)';
            button.style.borderColor = 'var(--purple-400)';
        }
    } else {
        // Closing animation
        dropdown.style.opacity = '0';
        dropdown.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => {
            dropdown.classList.remove('show');
        }, 200);
        
        // Reset button state
        if (button) {
            button.style.transform = '';
            button.style.borderColor = '';
        }
    }
}

// ============================================================================
// ENHANCED CONTEXT DROPDOWN WITH AGENT INSTRUCTION SUPPORT
// ============================================================================

function updateEnhancedContextDropdownContent() {
    const sizeText = document.getElementById('contextSizeText');
    const filesList = document.getElementById('contextFilesList');
    
    let contextSize = 0;
    const contextFilesList = [];
    
    // Calculate context including agent instructions
    state.contextFiles.forEach(key => {
        if (key.startsWith('prompt_')) {
            const name = key.substring(7);
            const file = state.promptUploads.get(name);
            if (file) {
                contextSize += file.size;
                contextFilesList.push(`📎 ${file.name}`);
            }
        } else if (key.startsWith('instructions_')) {
            const name = key.substring(13);
            const file = state.instructionsUploads.get(name);
            if (file) {
                contextSize += file.size;
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
                    contextFilesList.push(`${agent.icon} ${file.name} (${agent.name})`);
                }
            }
        } else {
            const file = state.files.get(key);
            if (file && !file.isTemporary) {
                contextSize += file.size;
                contextFilesList.push(file.name);
            }
        }
    });
    
    // Add active file if not in context
    if (state.activeFile && !state.contextFiles.has(state.activeFile)) {
        const file = state.files.get(state.activeFile);
        if (file && !file.isTemporary) {
            contextSize += file.size;
            contextFilesList.push(`✏️ ${file.name} (active)`);
        }
    }
    
    const sizeKB = (contextSize / 1024).toFixed(1);
    if (sizeText) sizeText.textContent = `${sizeKB} KB`;
    
    // Enhanced display with agent status
    if (filesList) {
        if (contextFilesList.length > 0) {
            const agentStatus = getAgentStatusText();
            filesList.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 600; color: var(--accent-blue);">
                    ${agentStatus}
                </div>
                ${contextFilesList.map(f => `• ${f}`).join('<br>')}
            `;
        } else {
            filesList.innerHTML = `
                <div style="margin-bottom: 8px; color: var(--text-secondary);">
                    ${getAgentStatusText()}
                </div>
                <em>No files in context</em>
            `;
        }
    }
}

// Alias for backward compatibility
function updateContextDropdownContent() {
    updateEnhancedContextDropdownContent();
}

// ============================================================================
// PROJECT MANAGEMENT FUNCTIONS (Added missing functions)
// ============================================================================

function downloadProject() {
    // This function should be called downloadProjectAsZip based on core.js
    if (typeof downloadProjectAsZip === 'function') {
        downloadProjectAsZip();
    } else {
        console.error('downloadProjectAsZip function not found in core.js');
    }
}

function clearProjectFiles() {
    // This function should be called deleteAllFilesAndFolders based on core.js
    if (typeof deleteAllFilesAndFolders === 'function') {
        deleteAllFilesAndFolders();
    } else {
        console.error('deleteAllFilesAndFolders function not found in core.js');
    }
}

function clearChatContext() {
    // Clear the chat context
    if (state.chatContext) {
        state.chatContext = [];
        addMessage('assistant', '💬 Chat context has been cleared. Starting fresh conversation.');
    }
}

// ============================================================================
// ENHANCED INPUT CONTAINER DRAG FUNCTIONALITY
// ============================================================================

function initInputContainerDrag() {
    const container = document.getElementById('floatingInput');
    
    // Mouse events for desktop
    container.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events for mobile with long-press detection
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    function handleTouchStart(e) {
        const touch = e.touches[0];
        
        // Clear any existing timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }
        
        // Start long press timer
        longPressTimer = setTimeout(() => {
            // Start drag after long press
            startDrag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        }, 500); // 500ms long press
        
        // Store initial touch position
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
    }
    
    function handleTouchMove(e) {
        if (longPressTimer && !isDragging) {
            const touch = e.touches[0];
            const moveThreshold = 10; // pixels
            
            // Cancel long press if moved too much
            if (Math.abs(touch.clientX - dragStartX) > moveThreshold || 
                Math.abs(touch.clientY - dragStartY) > moveThreshold) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
        
        if (isDragging) {
            const touch = e.touches[0];
            drag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        }
    }
    
    function handleTouchEnd(e) {
        // Clear long press timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        
        if (isDragging) {
            endDrag();
        }
    }
    
    function startDrag(e) {
        // Don't start drag if clicking on input elements
        if (e.target.matches('input, textarea, button, select')) {
            return;
        }
        
        isDragging = true;
        container.classList.add('dragging');
        
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const containerRect = container.getBoundingClientRect();
        containerStartX = containerRect.left + containerRect.width / 2;
        containerStartY = containerRect.bottom;
        
        e.preventDefault();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        const newX = containerStartX + deltaX;
        const newY = containerStartY + deltaY;
        
        // Convert to percentage for responsive positioning
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const leftPercent = (newX / viewportWidth) * 100;
        const bottomPercent = ((viewportHeight - newY) / viewportHeight) * 100;
        
        // Constrain to viewport bounds
        const constrainedLeft = Math.max(10, Math.min(90, leftPercent));
        const constrainedBottom = Math.max(5, Math.min(80, bottomPercent));
        
        container.style.left = `${constrainedLeft}%`;
        container.style.bottom = `${constrainedBottom}%`;
        container.style.transform = 'translateX(-50%)';
        
        e.preventDefault();
    }
    
    function endDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        container.classList.remove('dragging');
        
        // Snap to edges if close
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const viewportWidth = window.innerWidth;
        
        const leftPercent = (centerX / viewportWidth) * 100;
        
        // Snap to center if within 20% of center
        if (leftPercent > 40 && leftPercent < 60) {
            container.style.left = '50%';
        }
    }
}

// ============================================================================
// PROGRESSIVE INPUT GROWTH
// ============================================================================

function initProgressiveInputGrowth() {
    const messageInput = document.getElementById('messageInput');
    const container = document.getElementById('floatingInput');
    const wrapper = document.getElementById('inputWrapper');
    
    if (!messageInput) return;
    
    // Enhanced input handling with progressive growth
    messageInput.addEventListener('input', function() {
        // Calculate lines and adjust height progressively
        const lineHeight = 20; // Base line height
        const maxLines = 6; // Maximum lines before scrolling
        const minHeight = lineHeight;
        const maxHeight = lineHeight * maxLines;
        
        // Reset height to measure scroll height
        this.style.height = 'auto';
        const scrollHeight = this.scrollHeight;
        
        // Calculate number of lines
        const lines = Math.max(1, Math.ceil((scrollHeight - 8) / lineHeight)); // Account for padding
        
        // Set height based on content, up to max
        const newHeight = Math.min(scrollHeight, maxHeight);
        this.style.height = newHeight + 'px';
        
        // Update container classes based on growth
        if (lines > 1) {
            container.classList.add('expanded');
            wrapper.classList.add('expanded');
        } else {
            container.classList.remove('expanded');
            wrapper.classList.remove('expanded');
        }
        
        // Enable scrolling when content exceeds max height
        if (scrollHeight > maxHeight) {
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
    });
    
    // FIXED: Enter adds new line, Shift+Enter sends
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        // Regular Enter will now add a new line naturally
    });
    
    // Focus handling - no auto-expansion
    messageInput.addEventListener('focus', function() {
        // Don't auto-expand on focus anymore
        // Let content determine the size
    });
    
    // Blur handling - reset if empty
    messageInput.addEventListener('blur', function() {
        if (!this.value.trim()) {
            this.style.height = 'auto';
            container.classList.remove('expanded');
            wrapper.classList.remove('expanded');
        }
    });
}

// ============================================================================
// FIXED: Single unified handleAgentToggle function
// ============================================================================

function handleAgentToggle(agentId, event) {
    if (event) event.stopPropagation();
    
    const wasEnabled = state.agents[agentId].enabled;
    const isNowEnabled = toggleAgent(agentId);
    
    const agent = state.agents[agentId];
    const statusText = isNowEnabled ? 'activated' : 'deactivated';
    const emoji = isNowEnabled ? '✅' : '❌';
    
    console.log(`${emoji} ${agent.name} Agent ${statusText}`);
    
    const prevState = state.conversationState;
    updateConversationState(`${agent.icon} ${agent.name} ${statusText}`);
    
    // Handle agent instructions in context
    if (isNowEnabled) {
        if (agent.instructions.size > 0) {
            agent.instructions.forEach((instruction, name) => {
                const key = `agent_${agentId}_${name}`;
                state.contextFiles.add(key);
            });
            console.log(`📎 Added ${agent.instructions.size} instruction(s) to context for ${agent.name} Agent.`);
        }
    } else {
        if (agent.instructions.size > 0) {
            agent.instructions.forEach((instruction, name) => {
                const key = `agent_${agentId}_${name}`;
                state.contextFiles.delete(key);
            });
            console.log(`🗑️ Removed ${agent.instructions.size} instruction(s) from context for ${agent.name} Agent.`);
        }
    }
    
    // Check if no agents are enabled
    if (!hasEnabledAgents()) {
        addMessage('assistant', '⚠️ **All agents disabled!** You need to enable at least one agent to use the AI features. Click the agent buttons in the header to activate them.');
    } else if (!wasEnabled && isNowEnabled) {
        const instructionCount = agent.instructions.size;
        const instructionText = instructionCount > 0 ? ` with ${instructionCount} custom instruction(s)` : '';
        
        addMessage('assistant', `${agent.icon} **${agent.name} Agent activated!** ${agent.description}${instructionText}

**Model:** ${agent.model}
**Specializes in:** ${agent.keywords.slice(0, 5).join(', ')}...

Ready to help with your ${agent.name.toLowerCase()} needs!`);
    }
    
    updateContextIndicator();
    updateEnhancedContextDropdownContent();
    
    setTimeout(() => {
        state.conversationState = prevState;
        updateConversationState();
    }, 2000);
}

// ============================================================================
// ENHANCED AGENT DROPDOWN INTEGRATION
// ============================================================================

function toggleAgentDropdown(agentId, event) {
    if (event) event.stopPropagation();
    
    const dropdown = document.getElementById(`${agentId}Dropdown`);
    const allDropdowns = document.querySelectorAll('.agent-dropdown');
    
    // Close other dropdowns
    allDropdowns.forEach(d => {
        if (d.id !== `${agentId}Dropdown`) {
            d.classList.remove('show');
        }
    });
    
    // Toggle current dropdown
    dropdown.classList.toggle('show');
    
    // Update active dropdown state
    if (dropdown.classList.contains('show')) {
        state.agentSystem.activeDropdown = agentId;
    } else {
        state.agentSystem.activeDropdown = null;
    }
}

// ============================================================================
// ENHANCED EDITOR BACKGROUND FIX
// ============================================================================

function fixEditorBackground() {
    // Ensure consistent transparent green background and proper sizing for CodeMirror
    const editor = document.getElementById('editor');
    if (editor && state.editor) {
        const codeMirrorElement = editor.querySelector('.CodeMirror');
        if (codeMirrorElement) {
            // Force transparent background
            codeMirrorElement.style.background = 'transparent';
            
            // CRITICAL: Ensure full container coverage
            codeMirrorElement.style.height = '100%';
            codeMirrorElement.style.width = '100%';
            codeMirrorElement.style.position = 'absolute';
            codeMirrorElement.style.top = '0';
            codeMirrorElement.style.left = '0';
            codeMirrorElement.style.right = '0';
            codeMirrorElement.style.bottom = '0';
            
            // Fix gutter background
            const gutters = codeMirrorElement.querySelector('.CodeMirror-gutters');
            if (gutters) {
                gutters.style.background = 'rgba(10, 40, 15, 0.8)';
            }
            
            // Ensure scroll areas fill space
            const scrollElement = codeMirrorElement.querySelector('.CodeMirror-scroll');
            if (scrollElement) {
                scrollElement.style.height = '100%';
                scrollElement.style.width = '100%';
            }
            
            // Fix sizer element
            const sizerElement = codeMirrorElement.querySelector('.CodeMirror-sizer');
            if (sizerElement) {
                sizerElement.style.minHeight = '100%';
            }
        }
        
        // Refresh editor to apply changes
        setTimeout(() => {
            if (state.editor) {
                state.editor.refresh();
                // Force another sizing check
                const cmEl = editor.querySelector('.CodeMirror');
                if (cmEl) {
                    cmEl.style.height = '100%';
                    cmEl.style.width = '100%';
                }
            }
        }, 50);
    }
}

// ============================================================================
// ENHANCED RESIZABLE PANELS WITH AGENT-AWARE INTERACTIONS
// ============================================================================

function initResizablePanels() {
    const verticalResizer = document.getElementById('resizerVertical');
    const leftColumn = document.getElementById('leftColumn');
    const rightColumn = document.getElementById('rightColumn');
    
    verticalResizer.addEventListener('mousedown', (e) => {
        state.resizing.vertical = true;
        verticalResizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
        
        // Close any open agent dropdowns during resize
        closeAllAgentDropdowns();
    });
    
    const horizontalResizer = document.getElementById('resizerHorizontal');
    const editorContainer = document.getElementById('editorContainer');
    const chatContainer = document.getElementById('chatContainer');
    
    horizontalResizer.addEventListener('mousedown', (e) => {
        if (!state.editorCollapsed) {
            state.resizing.horizontal = true;
            horizontalResizer.classList.add('active');
            document.body.style.cursor = 'row-resize';
            e.preventDefault();
            
            // Close any open agent dropdowns during resize
            closeAllAgentDropdowns();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (state.resizing.vertical) {
            const containerRect = document.getElementById('mainContent').getBoundingClientRect();
            const newWidth = e.clientX - containerRect.left;
            
            if (newWidth > 150 && newWidth < containerRect.width - 300) {
                leftColumn.style.width = newWidth + 'px';
            }
        }
        
        if (state.resizing.horizontal && !state.editorCollapsed) {
            const containerRect = rightColumn.getBoundingClientRect();
            const relativeY = e.clientY - containerRect.top;
            const percentage = (relativeY / containerRect.height) * 100;
            
            if (percentage > 10 && percentage < 90) {
                editorContainer.style.height = percentage + '%';
                chatContainer.style.height = (100 - percentage) + '%';
                
                // CRITICAL: Refresh editor after horizontal resize
                setTimeout(() => {
                    if (state.editor) {
                        state.editor.refresh();
                        fixEditorBackground();
                    }
                }, 50);
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (state.resizing.vertical || state.resizing.horizontal) {
            state.resizing.vertical = false;
            state.resizing.horizontal = false;
            document.body.style.cursor = 'default';
            verticalResizer.classList.remove('active');
            horizontalResizer.classList.remove('active');
        }
    });
    
    // Enhanced touch support with agent dropdown awareness
    verticalResizer.addEventListener('touchstart', (e) => {
        state.resizing.vertical = true;
        verticalResizer.classList.add('active');
        e.preventDefault();
        closeAllAgentDropdowns();
    });
    
    horizontalResizer.addEventListener('touchstart', (e) => {
        if (!state.editorCollapsed) {
            state.resizing.horizontal = true;
            horizontalResizer.classList.add('active');
            e.preventDefault();
            closeAllAgentDropdowns();
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (state.resizing.vertical) {
            const touch = e.touches[0];
            const containerRect = document.getElementById('mainContent').getBoundingClientRect();
            const newWidth = touch.clientX - containerRect.left;
            
            if (newWidth > 150 && newWidth < containerRect.width - 300) {
                leftColumn.style.width = newWidth + 'px';
            }
        }
        
        if (state.resizing.horizontal && !state.editorCollapsed) {
            const touch = e.touches[0];
            const containerRect = rightColumn.getBoundingClientRect();
            const relativeY = touch.clientY - containerRect.top;
            const percentage = (relativeY / containerRect.height) * 100;
            
            if (percentage > 10 && percentage < 90) {
                editorContainer.style.height = percentage + '%';
                chatContainer.style.height = (100 - percentage) + '%';
            }
        }
    });
    
    document.addEventListener('touchend', () => {
        state.resizing.vertical = false;
        state.resizing.horizontal = false;
        verticalResizer.classList.remove('active');
        horizontalResizer.classList.remove('active');
    });
}

// ============================================================================
// ENHANCED DIALOG MANAGEMENT WITH AGENT AWARENESS
// ============================================================================

function showFindReplace() {
    // Close agent dropdowns when opening dialogs
    closeAllAgentDropdowns();
    
    document.getElementById('dialogOverlay').style.display = 'block';
    document.getElementById('findReplaceDialog').style.display = 'block';
    document.getElementById('findInput').focus();
}

function closeFindReplace() {
    document.getElementById('dialogOverlay').style.display = 'none';
    document.getElementById('findReplaceDialog').style.display = 'none';
}

function executeReplace() {
    const find = document.getElementById('findInput').value;
    const replace = document.getElementById('replaceInput').value;
    
    if (!find || !state.activeFile) return;
    
    const content = state.editor.getValue();
    const newContent = content.split(find).join(replace);
    
    if (content !== newContent) {
        state.editor.setValue(newContent);
        
        const file = state.files.get(state.activeFile);
        if (file) {
            file.content = newContent;
            file.modified = new Date().toISOString();
            
            if (supportsComments(file.path)) {
                file.revision = (file.revision || 1) + 1;
                file.content = addRevisionComment(file.path, newContent, file.revision, 'Find & Replace');
                state.editor.setValue(file.content);
            }
            
            state.lastSaveContent.set(state.activeFile, file.content);
        }
        
        closeFindReplace();
        saveProject();
        
        // Fix editor background after operations
        fixEditorBackground();
    }
}

// ============================================================================
// ENHANCED MOBILE VIEW MANAGEMENT WITH AGENT SUPPORT
// ============================================================================

function showMobileView(view) {
    const leftColumn = document.getElementById('leftColumn');
    const editor = document.getElementById('editorContainer');
    const chat = document.getElementById('chatContainer');
    
    // Close agent dropdowns when switching mobile views
    closeAllAgentDropdowns();
    
    leftColumn.classList.remove('mobile-show');
    chat.classList.remove('mobile-show');
    
    switch(view) {
        case 'files':
            leftColumn.classList.add('mobile-show');
            break;
        case 'editor':
            // Fix editor background when switching to editor view
            setTimeout(() => fixEditorBackground(), 100);
            break;
        case 'chat':
            chat.classList.add('mobile-show');
            break;
    }
    
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// ============================================================================
// ENHANCED CONTEXT TOGGLE FUNCTIONS WITH AGENT SUPPORT
// ============================================================================

function toggleProjectContext() {
    state.projectContextEnabled = !state.projectContextEnabled;
    
    state.files.forEach((file, path) => {
        if (!state.promptUploads.has(file.name) && !state.instructionsUploads.has(file.name)) {
            if (state.projectContextEnabled) {
                state.contextFiles.add(path);
            } else {
                state.contextFiles.delete(path);
            }
        }
    });
    
    // Also toggle folder context
    state.folders.forEach((folder, path) => {
        if (state.projectContextEnabled) {
            state.contextFiles.add(path);
        } else {
            state.contextFiles.delete(path);
        }
    });
    
    updateProjectContextToggle();
    updateFileList();
    updateContextIndicator();
    updateEnhancedContextDropdownContent();
}

function togglePromptContext() {
    state.promptContextEnabled = !state.promptContextEnabled;
    
    state.promptUploads.forEach((file, name) => {
        const key = `prompt_${name}`;
        if (state.promptContextEnabled) {
            state.contextFiles.add(key);
        } else {
            state.contextFiles.delete(key);
        }
    });
    
    updatePromptContextToggle();
    updatePromptList();
    updateContextIndicator();
    updateEnhancedContextDropdownContent();
}

function toggleInstructionsContext() {
    state.instructionsContextEnabled = !state.instructionsContextEnabled;
    
    state.instructionsUploads.forEach((file, name) => {
        const key = `instructions_${name}`;
        if (state.instructionsContextEnabled) {
            state.contextFiles.add(key);
        } else {
            state.contextFiles.delete(key);
        }
    });
    
    updateInstructionsContextToggle();
    updateInstructionsList();
    updateContextIndicator();
    updateEnhancedContextDropdownContent();
}

// ============================================================================
// ENHANCED EDITOR TOGGLE FUNCTION WITH AGENT AWARENESS
// ============================================================================

function toggleEditor() {
    const editorContainer = document.getElementById('editorContainer');
    const toggleBtn = document.getElementById('toggleText');
    const iconBtn = document.getElementById('editorToggleIcon');
    
    // Close agent dropdowns when toggling editor
    closeAllAgentDropdowns();
    
    state.editorCollapsed = !state.editorCollapsed;
    
    if (state.editorCollapsed) {
        // Collapse editor - only show toggle bar
        editorContainer.classList.add('collapsed');
        
        // Update button icons
        if (toggleBtn) toggleBtn.textContent = '▲';
        if (iconBtn) {
            const svg = iconBtn; // iconBtn IS the svg element with id="editorToggleIcon"
            if (svg) {
                svg.style.transform = 'rotate(180deg)';
                svg.style.transition = 'transform 0.3s ease';
            }
        }
        
        // Add click handler to collapsed container to expand
        editorContainer.style.cursor = 'pointer';
        editorContainer.onclick = function(e) {
            // Only trigger if clicking the container itself, not child elements
            if (e.target === editorContainer || e.target.closest('.editor-container.collapsed') === editorContainer) {
                toggleEditor();
            }
        };
        
    } else {
        // Expand editor - show full functionality
        editorContainer.classList.remove('collapsed');
        
        // Update button icons
        if (toggleBtn) toggleBtn.textContent = '▼';
        if (iconBtn) {
            const svg = iconBtn; // iconBtn IS the svg element
            if (svg) {
                svg.style.transform = 'rotate(0deg)';
                svg.style.transition = 'transform 0.3s ease';
            }
        }
        
        // Remove click handler and reset cursor
        editorContainer.style.cursor = 'default';
        editorContainer.onclick = null;
        
        // Refresh editor and fix background after expansion
        setTimeout(() => {
            if (state.editor) {
                state.editor.refresh();
                fixEditorBackground();
            }
        }, 300);
    }
}

// ============================================================================
// DEFAULT MINIMIZE EDITOR ON INIT
// ============================================================================

function initializeEditorMinimized() {
    // Set editor to minimized state by default
    const editorContainer = document.getElementById('editorContainer');
    const toggleBtn = document.getElementById('toggleText');
    const iconBtn = document.getElementById('editorToggleIcon');
    
    // Set state and UI to collapsed
    state.editorCollapsed = true;
    editorContainer.classList.add('collapsed');
    
    // Update button icons
    if (toggleBtn) toggleBtn.textContent = '▲';
    if (iconBtn) {
        const svg = iconBtn;
        if (svg) {
            svg.style.transform = 'rotate(180deg)';
            svg.style.transition = 'none'; // No animation on init
        }
    }
    
    // Add click handler to collapsed container to expand
    editorContainer.style.cursor = 'pointer';
    editorContainer.onclick = function(e) {
        if (e.target === editorContainer || e.target.closest('.editor-container.collapsed') === editorContainer) {
            toggleEditor();
        }
    };
}

// ============================================================================
// CONTEXT TOGGLE HANDLERS FOR SECTION HEADERS
// ============================================================================

function initContextToggleHandlers() {
    const projectHeader = document.querySelector('#projectSection .section-header');
    if (projectHeader) {
        projectHeader.addEventListener('click', (event) => {
            // Check if the click originated from a button inside the header
            if (event.target.closest('.file-tree-actions')) {
                // If it's a button, let the button's event handler run and do nothing here
                return;
            }
            // If the click is on the header itself, toggle the context
            toggleProjectContext();
        });
    }

    const instructionsHeader = document.querySelector('#instructionsSection .section-header');
    if (instructionsHeader) {
        instructionsHeader.addEventListener('click', (event) => {
            if (event.target.closest('.file-tree-actions')) {
                return;
            }
            toggleInstructionsContext();
        });
    }

    const promptHeader = document.querySelector('#promptSection .section-header');
    if (promptHeader) {
        promptHeader.addEventListener('click', (event) => {
            if (event.target.closest('.file-tree-actions')) {
                return;
            }
            togglePromptContext();
        });
    }
}

// ============================================================================
// ENHANCED INITIALIZATION WITH COMPLETE AGENT INTEGRATION
// ============================================================================

function initEnhancedUI() {
    console.log('🚀 Initializing Enhanced UI with 3-Agent System...');
    
    // Core UI initialization
    initInputContainerDrag();
    initProgressiveInputGrowth();
    
    // Context toggle handlers for section headers
    initContextToggleHandlers();
    
    // Initialize editor as minimized by default
    initializeEditorMinimized();
    
    console.log('✅ Enhanced UI initialized successfully');
}