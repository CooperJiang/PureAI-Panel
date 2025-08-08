/**
 * 消息处理模块 - 负责处理聊天消息的展示、交互和操作
 */
export class MessageHandler {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {HTMLElement} options.chatMessages - 聊天消息容器
     * @param {Object} options.chatComponent - 聊天消息组件
     * @param {Object} options.conversationManager - 对话管理器
     * @param {Function} options.onDeleteMessage - 删除消息回调
     * @param {Function} options.onEditMessage - 编辑消息回调
     */
    constructor(options) {
        this.chatMessages = options.chatMessages;
        this.chatComponent = options.chatComponent;
        this.conversationManager = options.conversationManager;
        this.onDeleteMessage = options.onDeleteMessage;
        this.onEditMessage = options.onEditMessage;
        
        // 初始化标志
        this.isWaitingForResponse = false;
    }
    
    /**
     * 初始化消息处理器
     */
    init() {
        // 初始化时绑定消息事件
        this.bindMessageEvents();
    }
    
    /**
     * 添加用户消息
     * @param {string} message - 用户消息内容
     * @param {boolean} scroll - 是否滚动到底部
     * @returns {HTMLElement|null} - 消息元素
     */
    addUserMessage(message, scroll = true) {
        if (!this.chatMessages) {
            return null;
        }
        
        // 如果存在欢迎消息，先移除它
        const welcomeMessage = document.getElementById('welcome-message-container');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        // 使用聊天组件创建用户消息
        const messageElement = this.chatComponent.createUserMessage(message);
        // 设置消息内容用于编辑
        if (messageElement instanceof HTMLElement) {
            messageElement.dataset.content = message;
        }
        
        this.chatMessages.appendChild(messageElement);
        
        // 需要时滚动到底部
        if (scroll) this.scrollToBottom();
        
        // 设置图片预览
        this.setupImagePreviews();
        
        // 绑定事件
        this.bindMessageEvents();
        
        return messageElement;
    }
    
    /**
     * 添加助手消息
     * @param {string} message - 消息内容
     * @param {boolean} isStream - 是否为流式输出
     * @param {string} modelName - 模型名称（可选）
     * @param {string|null} messageId - 消息ID（可选）
     * @return {Object} 包含创建的元素和ID的对象
     */
    addAssistantMessage(message = '', isStream = false, modelName = '', messageId = null) {
        if (!this.chatMessages) {
            return { element: null, id: null };
        }
        
        // 删除欢迎消息（如果存在）
        const welcomeMessage = document.getElementById('welcome-message-container');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        // 使用传入的messageId或生成新ID
        const result = this.chatComponent.createAssistantMessage(message, messageId, isStream);
        
        // 确保生成的元素存在
        if (!result.element || !result.id) {
            return { element: null, id: null };
        }
        
        // 设置消息内容用于编辑
        if (result.element instanceof HTMLElement) {
            result.element.dataset.content = message;
        }
        
        // 添加模型信息
        if (modelName && result.element) {
            const modelInfoEl = document.createElement('div');
            modelInfoEl.className = 'model-info text-xs text-openai-gray mt-1 ml-10 flex items-center gap-1';
            modelInfoEl.innerHTML = `
                <i class="fas fa-robot text-xs text-openai-green"></i>
                <span>${modelName}</span>
            `;
            result.element.appendChild(modelInfoEl);
        }
        
        this.chatMessages.appendChild(result.element);
        this.scrollToBottom();
        
        // 设置图片预览
        this.setupImagePreviews();
        
        return result;
    }
    
    /**
     * 更新流式消息内容
     * @param {string} messageId - 消息ID
     * @param {string} content - 消息内容
     */
    updateStreamMessage(messageId, content) {
        const contentElement = document.getElementById(`content-${messageId}`);
        if (!contentElement) return;
        
        // 使用Markdown格式化器将内容格式化为HTML
        const formatter = this.chatComponent.formatter;
        const formattedContent = formatter.formatMessage(content);
        
        // 更新内容
        contentElement.innerHTML = formattedContent;
        
        // 为新内容中的代码块添加交互按钮和高亮
        formatter.addCodeInteractionButtons();
        this.chatComponent.applyCodeHighlightingToElement(contentElement);
        
        // 处理图片预览
        this.setupImagePreviews();
        
        // 更新Token计数（估计值）
        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            const estimatedTokens = this.chatComponent.estimateTokenCount(content);
            tokenCountElement.textContent = `${estimatedTokens} tokens`;
            tokenCountElement.title = "估计的Token数量（将在完成后更新）";
        }
        
        this.scrollToBottom();
    }
    
    /**
     * 设置图片预览功能
     */
    setupImagePreviews() {
        try {
            const imageViewer = window['imageViewer'];
            if (imageViewer && typeof imageViewer.setupImagePreviews === 'function') {
                setTimeout(() => {
                    imageViewer.setupImagePreviews();
                }, 100); // 延迟100ms确保DOM已更新
            }
        } catch (e) {
        }
    }
    
    /**
     * 显示编辑消息的模态框
     * @param {number} messageIndex - 消息索引
     * @param {string} originalContent - 原始内容
     * @param {boolean} isAiMessage - 是否为AI消息
     */
    showEditMessageModal(messageIndex, originalContent, isAiMessage = false) {
        // 创建或获取模态框
        let modal = document.getElementById('editMessageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'editMessageModal';
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm hidden';
            
            modal.innerHTML = `
                <div class="bg-white dark:bg-[#202123] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto transform transition-transform duration-300">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 id="editModalTitle" class="text-lg font-semibold text-openai-text dark:text-white">
                                编辑消息
                            </h3>
                            <button id="closeEditModal" class="text-openai-gray hover:text-openai-text dark:hover:text-white transition-colors">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <textarea id="editMessageContent" class="w-full p-3 border border-openai-border rounded-md focus:outline-none focus:ring-1 focus:ring-openai-green dark:bg-[#343541] dark:text-white" rows="6"></textarea>
                        
                        <div class="flex justify-end mt-4 gap-2">
                            <button id="cancelEditMessage" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-openai-text dark:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                取消
                            </button>
                            <button id="saveEditMessage" class="px-4 py-2 bg-openai-green text-white rounded-md hover:bg-opacity-90 transition-colors">
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        // 显示模态框并填充内容
        modal.classList.remove('hidden');
        
        // 设置标题
        const titleElement = document.getElementById('editModalTitle');
        if (titleElement) {
            titleElement.textContent = isAiMessage ? '编辑AI回复' : '编辑消息';
        }
        
        // 填充内容
        const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('editMessageContent'));
        if (textarea) {
            textarea.value = originalContent;
            textarea.focus();
            
            // 如果是AI消息，显示token计数
            if (isAiMessage) {
                const tokenCount = this.chatComponent.estimateTokenCount(originalContent);
                const countInfo = document.createElement('div');
                countInfo.className = 'text-xs text-openai-gray mt-1';
                countInfo.textContent = `估计token数量：约${tokenCount}`;
                textarea.parentNode?.insertBefore(countInfo, textarea.nextSibling);
                
                // 添加实时token计数
                textarea.addEventListener('input', () => {
                    const currentContent = textarea.value;
                    const currentTokens = this.chatComponent.estimateTokenCount(currentContent);
                    countInfo.textContent = `估计token数量：约${currentTokens}`;
                });
            }
        }
        
        // 保存按钮
        const saveButton = document.getElementById('saveEditMessage');
        if (saveButton) {
            const newSaveButton = saveButton.cloneNode(true);
            saveButton.parentNode?.replaceChild(newSaveButton, saveButton);
            
            newSaveButton.addEventListener('click', () => {
                if (!textarea) return;
                const newContent = textarea.value.trim();
                if (newContent) {
                    if (this.onEditMessage && typeof this.onEditMessage === 'function') {
                        this.onEditMessage(messageIndex, newContent);
                    }
                    modal.classList.add('hidden');
                    
                    // 移除token计数元素
                    const countInfo = document.querySelector('#editMessageModal .text-xs.text-openai-gray');
                    if (countInfo) countInfo.remove();
                }
            });
        }
        
        // 关闭和取消按钮
        const closeButton = document.getElementById('closeEditModal');
        const cancelButton = document.getElementById('cancelEditMessage');
        
        const closeModal = () => {
            modal.classList.add('hidden');
            // 移除token计数元素
            const countInfo = document.querySelector('#editMessageModal .text-xs.text-openai-gray');
            if (countInfo) countInfo.remove();
        };
        
        if (closeButton) {
            const newCloseButton = closeButton.cloneNode(true);
            closeButton.parentNode?.replaceChild(newCloseButton, closeButton);
            newCloseButton.addEventListener('click', closeModal);
        }
        
        if (cancelButton) {
            const newCancelButton = cancelButton.cloneNode(true);
            cancelButton.parentNode?.replaceChild(newCancelButton, cancelButton);
            newCancelButton.addEventListener('click', closeModal);
        }
    }
    
    /**
     * 绑定消息操作事件
     */
    bindMessageEvents() {
        if (!this.chatMessages) return;
        
        // 清除旧的事件监听器（通过替换元素的克隆版本）
        const removeOldListeners = (selector) => {
            const elements = this.chatMessages.querySelectorAll(selector);
            elements.forEach(element => {
                const clone = element.cloneNode(true);
                if (element.parentNode) {
                    element.parentNode.replaceChild(clone, element);
                }
            });
        };
        
        // 移除所有旧的事件监听器
        removeOldListeners('.edit-message-btn');
        removeOldListeners('.copy-message-btn');
        removeOldListeners('.delete-message-btn');
        removeOldListeners('.retry-from-here-btn');
        
        // 重新绑定编辑按钮事件
        const editButtons = this.chatMessages.querySelectorAll('.edit-message-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 找到消息元素和索引
                const messageElement = button.closest('.chat');
                if (!messageElement || !messageElement.dataset.index) return;
                
                const index = parseInt(messageElement.dataset.index);
                if (isNaN(index)) return;
                
                // 获取原始内容
                const content = messageElement.dataset.content || '';
                const isAi = messageElement.classList.contains('chat-start');
                
                // 显示编辑模态框
                this.showEditMessageModal(index, content, isAi);
            });
        });
        
        // 重新绑定复制按钮事件
        const copyButtons = this.chatMessages.querySelectorAll('.copy-message-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 找到消息元素
                const messageElement = button.closest('.chat');
                if (!messageElement) return;
                
                // 获取内容
                const content = messageElement.dataset.content || '';
                
                // 复制到剪贴板
                navigator.clipboard.writeText(content)
                    .then(() => {
                        // 显示复制成功反馈
                        const originalText = button.querySelector('i').classList.toString();
                        button.querySelector('i').className = 'fas fa-check text-sm text-green-500';
                        
                        // 使用Toast提示
                        if (window.toast) {
                            window.toast.success('已复制到剪贴板');
                        }
                        
                        // 2秒后恢复原样
                        setTimeout(() => {
                            if (originalText) {
                                button.querySelector('i').className = originalText;
                            } else {
                                button.querySelector('i').className = 'fas fa-copy text-sm text-gray-500';
                            }
                        }, 2000);
                    })
                    .catch(err => {
                        if (window.toast) {
                            window.toast.error('复制失败，请重试');
                        }
                    });
            });
        });
        
        // 重新绑定删除按钮事件
        const deleteButtons = this.chatMessages.querySelectorAll('.delete-message-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 找到消息元素和索引
                const messageElement = button.closest('.chat');
                if (!messageElement || !messageElement.dataset.index) {
                    console.warn('删除消息失败 - 消息元素不存在或没有索引属性', messageElement);
                    // 尝试通过消息ID识别索引
                    if (messageElement && messageElement.id) {
                        // 在当前对话中搜索匹配ID的消息
                        const conversation = this.conversationManager.getCurrentConversation();
                        if (conversation && conversation.messages) {
                            for (let i = 0; i < conversation.messages.length; i++) {
                                // 如果ID中包含消息ID的一部分，认为是匹配的
                                if (messageElement.id.includes(conversation.messages[i].id) || 
                                    (conversation.messages[i].id && messageElement.id.includes(conversation.messages[i].id.split('-')[1]))) {
                                    this.onDeleteMessage(i);
                                    return;
                                }
                            }
                        }
                    }
                    return;
                }
                
                const index = parseInt(messageElement.dataset.index);
                if (isNaN(index)) {
                    console.warn('删除消息失败 - 索引不是有效数字:', messageElement.dataset.index);
                    return;
                }
                this.onDeleteMessage(index);
            });
        });

        // 绑定“从这里重发”按钮
        const retryButtons = this.chatMessages.querySelectorAll('.retry-from-here-btn');
        retryButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const messageElement = button.closest('.chat');
                if (!messageElement || !messageElement.dataset.index) return;
                const index = parseInt(messageElement.dataset.index);
                if (isNaN(index)) return;

                // 仅允许在“用户消息”上使用该功能
                const isUser = messageElement.classList.contains('chat-end');
                if (!isUser) return;

                // 将断点设在该用户消息之后
                try {
                    const conv = this.conversationManager.getCurrentConversation();
                    if (!conv) return;
                    // 设置断点位置 = 该消息索引 + 1
                    if (!Array.isArray(conv.breakpoints)) conv.breakpoints = [];
                    const breakpointIndex = index + 1;
                    if (!conv.breakpoints.includes(breakpointIndex)) {
                        conv.breakpoints.push(breakpointIndex);
                        conv.breakpoints.sort((a, b) => a - b);
                    }
                    this.conversationManager.saveConversations();
                } catch {}

                // 触发重新发送（使用该条消息内容作为当前输入）
                const content = messageElement.dataset.content || '';
                const chatUI = /** @type {any} */ (window.chatUI);
                if (chatUI && chatUI.messageInput) {
                    chatUI.messageInput.value = content;
                    chatUI.adjustTextareaHeight && chatUI.adjustTextareaHeight();
                    chatUI.sendMessage && chatUI.sendMessage();
                }
            });
        });
    }
    
    /**
     * 滚动到底部
     */
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    /**
     * 清空聊天区域并添加欢迎消息
     */
    clearChatArea() {
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
            
            // 获取当前对话
            const conversation = this.conversationManager.getCurrentConversation();
            
            // 只有当对话为空时，才显示欢迎消息
            if (!conversation.messages || conversation.messages.length === 0) {
                // 添加欢迎提示
                if (this.chatComponent && typeof this.chatComponent.createWelcomeMessage === 'function') {
                    const welcomeMessage = this.chatComponent.createWelcomeMessage();
                    welcomeMessage.id = 'welcome-message-container';
                    this.chatMessages.appendChild(welcomeMessage);
                } else {
                    // 如果不存在欢迎消息方法，创建一个默认的欢迎消息
                    const welcomeDiv = document.createElement('div');
                    welcomeDiv.id = 'welcome-message-container';
                    welcomeDiv.className = 'welcome-message text-center p-6 animate__animated animate__fadeIn';
                    welcomeDiv.innerHTML = `
                        <div class="text-xl font-medium mb-2">欢迎使用PureAI聊天面板</div>
                        <p class="text-openai-gray">与AI助手开始一段对话吧</p>
                    `;
                    this.chatMessages.appendChild(welcomeDiv);
                }
            }
        }
    }
    
    /**
     * 加载当前对话的消息
     */
    loadCurrentConversation() {
        // 清空聊天区域
        this.chatMessages.innerHTML = '';
        
        const conversation = this.conversationManager.getCurrentConversation();
        if (!conversation.messages || conversation.messages.length === 0) {
            // 如果没有消息，添加欢迎消息
            if (this.chatComponent && typeof this.chatComponent.createWelcomeMessage === 'function') {
                const welcomeMessage = this.chatComponent.createWelcomeMessage();
                welcomeMessage.id = 'welcome-message-container';
                this.chatMessages.appendChild(welcomeMessage);
            } else {
                // 如果不存在欢迎消息方法，创建一个默认的欢迎消息
                const welcomeDiv = document.createElement('div');
                welcomeDiv.id = 'welcome-message-container';
                welcomeDiv.className = 'welcome-message text-center p-6 animate__animated animate__fadeIn';
                welcomeDiv.innerHTML = `
                    <div class="text-xl font-medium mb-2">欢迎使用PureAI聊天面板</div>
                    <p class="text-openai-gray">与AI助手开始一段对话吧</p>
                `;
                this.chatMessages.appendChild(welcomeDiv);
            }
            return;
        }
        
        // 添加所有消息到界面
        conversation.messages.forEach((message, index) => {
            if (message.role === 'user') {
                const messageElement = this.addUserMessage(message.content, false);
                // 给用户消息添加索引属性，用于后续编辑和删除
                if (messageElement instanceof HTMLElement) {
                    messageElement.dataset.index = index.toString();
                }
            } else if (message.role === 'assistant') {
                const result = this.addAssistantMessage(message.content, false);
                // 给助手消息添加索引属性，用于后续删除
                if (result.element instanceof HTMLElement) {
                    result.element.dataset.index = index.toString();
                }
            }
        });
        
        // 绑定编辑和删除消息事件
        this.bindMessageEvents();
        
        // 滚动到底部
        this.scrollToBottom();
        
        // 处理图片预览
        this.setupImagePreviews();
    }
    
    /**
     * 在消息生成完成后，将HTML代码块转换为预览模式
     */
    convertHtmlToPreview() {
        try {
            // 使用CodeBlockManager进行HTML预览处理
            const codeBlockManager = /** @type {any} */ (window['codeBlockManager']);
            if (codeBlockManager && typeof codeBlockManager.convertHtmlToPreview === 'function') {
                codeBlockManager.convertHtmlToPreview();
                return;
            }
            
            // 回退方案：直接使用htmlPreview
            const htmlPreview = /** @type {any} */ (window["htmlPreview"]);
            if (htmlPreview) {
                // 找到所有HTML代码块
                const htmlBlocks = document.querySelectorAll('.code-block');
                htmlBlocks.forEach(block => {
                    const headerElement = block.querySelector('.code-header span');
                    if (headerElement && ['html', 'htm'].includes(headerElement.textContent.toLowerCase())) {
                        // 检查是否处于源代码模式
                        if (block.getAttribute('data-preview-mode') === 'false') {
                            // 找到源代码/预览切换按钮并模拟点击
                            const viewButton = block.querySelector('.source-button');
                            if (viewButton && viewButton instanceof HTMLElement) {
                                viewButton.click(); // 自动切换到预览模式
                            }
                        }
                    }
                });
            }
            
            // 处理图片预览
            try {
                const imageViewer = /** @type {any} */ (window['imageViewer']);
                if (imageViewer && typeof imageViewer.setupImagePreviews === 'function') {
                    imageViewer.setupImagePreviews();
                }
            } catch (e) {
            }
        } catch (e) {
        }
    }
    
    /**
     * 更新流式消息内容完成后，绑定操作按钮事件
     * @param {string} messageId - 消息ID
     * @param {string} finalContent - 最终内容
     */
    completeStreamMessage(messageId, finalContent) {
        const contentElement = document.getElementById(`content-${messageId}`);
        if (!contentElement) return;
        
        // 更新Token计数
        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            // 使用聊天组件的token估算方法
            if (this.chatComponent && typeof this.chatComponent.estimateTokenCount === 'function') {
                const estimatedTokens = this.chatComponent.estimateTokenCount(finalContent);
                tokenCountElement.textContent = `${estimatedTokens} tokens`;
                tokenCountElement.title = "Token数量";
            } else {
                tokenCountElement.textContent = `${Math.round(finalContent.length * 0.75)} tokens`;
                tokenCountElement.title = "估算的Token数量";
            }
        } else {
        }
        
        // 确保设置消息内容属性用于后续编辑
        const messageElement = document.getElementById(messageId);
        if (messageElement instanceof HTMLElement) {
            messageElement.dataset.content = finalContent;
            
            // 更新代码块UI
            const codeBlockManager = /** @type {any} */ (window['codeBlockManager']);
            if (codeBlockManager && typeof codeBlockManager.updateCodeBlocks === 'function') {
                codeBlockManager.updateCodeBlocks(messageElement);
            }
        }
    }
    
    /**
     * 处理思考标签，包装成思考容器
     * @param {string} content - 消息内容
     * @returns {string} - 处理后的内容
     */
    processThinkContent(content) {
        if (!content) return content;

        // 检查是否包含思考标签
        if (content.includes('<think>') && content.includes('</think>')) {
            // 提取所有思考内容
            const regex = /<think>([\s\S]*?)<\/think>/g;
            return content.replace(regex, (match, thinkContent) => {
                return `<div class="think-container">${thinkContent}</div>`;
            });
        }
        
        return content;
    }

    /**
     * 处理消息内容中的特殊标记
     * @param {string} content - 消息内容
     * @returns {string} - 处理后的内容
     */
    processMessageContent(content) {
        if (!content) return '';
        
        // 首先处理思考内容
        content = this.processThinkContent(content);
        
        // 其他处理...
        
        return content;
    }
} 