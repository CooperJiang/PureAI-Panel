/**
 * 聊天UI管理模块 - 负责整合所有UI子模块并管理页面交互
 */
import { MessageHandler } from './MessageHandler.js';
import { SidebarManager } from './SidebarManager.js';
import { ModalManager } from './ModalManager.js';
import { StreamManager } from './StreamManager.js';
import { ModelManager } from './ModelManager.js';
import { ExportManager } from './ExportManager.js';
import { CodeBlockManager } from './CodeBlockManager.js';
import { MessageFormatter } from '../utils.js';

export class ChatUI {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.conversationManager - 对话管理器
     * @param {Object} options.apiClient - API客户端
     * @param {Object} options.settingsManager - 设置管理器
     */
    constructor(options) {
        // 保存核心依赖
        this.conversationManager = options.conversationManager;
        this.apiClient = options.apiClient;
        this.settingsManager = options.settingsManager;
        
        // 状态标志
        this.isGenerating = false;
        this.abortController = null;
        
        // 最近使用的助手消息ID跟踪器
        this._lastAssistantMessageId = null;
        
        // 缓存DOM元素
        this.cacheElements();
        
        // 初始化格式化器
        this.formatter = new MessageFormatter();
        
        // 创建聊天消息组件
        this.createChatMessageComponent();
        
        // 初始化子模块
        this.initSubmodules();
        
        // 绑定事件
        this.bindEvents();
        
        // 绑定快捷键
        this.bindShortcuts();
        
        // 检查是否有当前对话
        this.loadCurrentConversation();
    }
    
    /**
     * 缓存DOM元素
     */
    cacheElements() {
        // 消息相关
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.stopButton = document.getElementById('stopButton');
        this.sendingIndicator = document.getElementById('sendingIndicator');
        
        // 侧边栏相关
        this.sidebar = document.getElementById('sidebar');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.conversationList = document.getElementById('conversationList');
        
        // 模型相关
        this.modelSelect = document.getElementById('modelSelect');
        this.selectedModelText = document.getElementById('selectedModel');
        
        // 工具栏相关
        this.clearButton = document.getElementById('clearChat');
        this.settingsButton = document.getElementById('settingsBtn');
        
        // 底部API设置按钮
        this.apiSettingsBtn = document.getElementById('apiSettingsBtn');
    }
    
    /**
     * 创建聊天消息组件
     */
    createChatMessageComponent() {
        // 导入聊天消息相关处理对象
        try {
            // 创建聊天消息组件对象
            this.ChatMessageComponent = {
                formatter: this.formatter,
                
                // 创建用户消息
                createUserMessage(message) {
                    const messageId = `user-message-${Date.now()}`;
                    const messageElement = document.createElement('div');
                    messageElement.id = messageId;
                    messageElement.className = 'chat chat-end group mb-4';
                    messageElement.dataset.content = message;
                    messageElement.dataset.timestamp = Date.now().toString();
                    
                    // 获取当前时间
                    const now = new Date();
                    const timeStr = now.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).replace(/\//g, '-');
                    
                    // 构建消息内容
                    messageElement.innerHTML = `
                        <div class="chat-row">
                            <div class="avatar w-8 h-8 ml-2 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center">👤</div>
                            <div class="message-content bg-openai-green text-white p-3 rounded-lg rounded-br-sm">
                                <div id="content-${messageId}" class="markdown-content">${this.formatter.formatMessage(message)}</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mr-10 mt-1">
                            <div class="message-buttons flex space-x-1">
                                <button class="edit-message-btn p-1 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 rounded transition-all transform active:scale-95" title="编辑消息">
                                    <i class="fas fa-edit text-sm text-gray-500"></i>
                                </button>
                                <button class="copy-message-btn p-1 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 rounded transition-all transform active:scale-95" title="复制消息">
                                    <i class="fas fa-copy text-sm text-gray-500"></i>
                                </button>
                                <button class="delete-message-btn p-1 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 rounded transition-all transform active:scale-95" title="删除消息">
                                    <i class="fas fa-trash-alt text-sm text-gray-500"></i>
                                </button>
                            </div>
                            <span class="message-time text-xs text-gray-500">${timeStr}</span>
                        </div>
                    `;
                    
                    // 应用代码高亮
                    this.applyCodeHighlightingToElement(messageElement);
                    
                    return messageElement;
                },
                
                // 创建助手消息
                createAssistantMessage(message = '', messageId = null, isStream = false) {
                    if (!messageId) {
                        messageId = `assistant-message-${Date.now()}`;
                    }
                    
                    const messageElement = document.createElement('div');
                    messageElement.id = messageId;
                    messageElement.className = 'chat chat-start group mb-4';
                    messageElement.dataset.content = message;
                    messageElement.dataset.timestamp = Date.now().toString();
                    
                    // 获取当前时间
                    const now = new Date();
                    const timeStr = now.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).replace(/\//g, '-');
                    
                    // 构建消息内容
                    messageElement.innerHTML = `
                        <div class="chat-row">
                            <div class="avatar w-8 h-8 mr-2 flex-shrink-0 rounded-full bg-openai-green text-white flex items-center justify-center">🤖</div>
                            <div class="message-content bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-sm">
                                <div id="content-${messageId}" class="assistant-content markdown-content">
                                    ${isStream 
                                        ? '<span class="cursor-blink"></span>' 
                                        : this.formatter.formatMessage(message)}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between ml-10 mt-1">
                            <span class="message-time text-xs text-gray-500">${timeStr}</span>
                            <div class="message-buttons flex space-x-1">
                                <button class="edit-message-btn p-1 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 rounded transition-all transform active:scale-95" title="编辑消息">
                                    <i class="fas fa-edit text-sm text-gray-500"></i>
                                </button>
                                <button class="copy-message-btn p-1 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 rounded transition-all transform active:scale-95" title="复制消息">
                                    <i class="fas fa-copy text-sm text-gray-500"></i>
                                </button>
                                <button class="delete-message-btn p-1 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 rounded transition-all transform active:scale-95" title="删除消息">
                                    <i class="fas fa-trash-alt text-sm text-gray-500"></i>
                                </button>
                            </div>
                        </div>
                        <div class="ml-10 text-xs text-openai-gray token-count estimating">估算中...</div>
                    `;
                    
                    // 应用代码高亮
                    this.applyCodeHighlightingToElement(messageElement);
                    return { element: messageElement, id: messageId };
                },
                
                // 应用代码高亮
                applyCodeHighlightingToElement: (element) => {
                    // 先检查元素是否有效
                    if (!element || !(element instanceof Element)) {
                        return;
                    }
                    
                    // 减少高亮频率，降低性能压力
                    if (element.hasAttribute('data-highlighted')) {
                        return; // 避免重复高亮
                    }
                    element.setAttribute('data-highlighted', 'true');
                    
                    setTimeout(() => {
                        try {
                            if (typeof hljs !== 'undefined') {
                                const codeBlocks = element.querySelectorAll('pre code');
                                if (codeBlocks && codeBlocks.length > 0) {
                                    codeBlocks.forEach(block => {
                                        if (block && block instanceof Element) {
                                            // 检查是否是HTML代码块，HTML代码块不执行转义
                                            const language = block.className.match(/language-(\w+)/)?.[1];
                                            
                                            // 避免在正在生成的消息中进行代码高亮，减少性能消耗
                                            const messageElement = block.closest('.chat');
                                            const isGeneratingWithCursor = messageElement?.querySelector('.cursor-blink') !== null;
                                            
                                            if (!isGeneratingWithCursor) {
                                                try {
                                                    hljs.highlightElement(block);
                                                } catch (e) {
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                        }
                    }, 0);
                },
                
                // 估算token数量的方法
                estimateTokenCount: (text) => {
                    // 简单估算: 每个单词约1.3个token，每个中文字符约2个token
                    if (!text) return 0;
                    
                    // 计算单词数（英文）
                    const englishWordCount = (text.match(/\b\w+\b/g) || []).length;
                    
                    // 计算中文字符数
                    const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
                    
                    // 计算其他符号数
                    const symbolCount = text.length - englishWordCount - chineseCharCount;
                    
                    // 估算token数量
                    const tokenCount = Math.round(englishWordCount * 1.3 + chineseCharCount * 2 + symbolCount * 0.5);
                    
                    return tokenCount;
                },
                
                // 创建欢迎消息
                createWelcomeMessage: () => {
                    const welcomeDiv = document.createElement('div');
                    welcomeDiv.className = 'welcome-message text-center p-8 mb-4';
                    welcomeDiv.innerHTML = `
                        <div class="text-2xl font-medium mb-3">👋 欢迎使用 PureAI 聊天面板</div>
                        <p class="text-gray-500 mb-4">随时随地与AI助手对话，获取帮助与灵感</p>
                        <div class="flex justify-center gap-3 mt-4">
                            <div class="max-w-xs p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div class="text-lg font-medium mb-2">💬 开始对话</div>
                                <p class="text-sm text-gray-500">在下方输入框发送消息，开始与AI对话</p>
                            </div>
                            <div class="max-w-xs p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div class="text-lg font-medium mb-2">⚙️ 自定义设置</div>
                                <p class="text-sm text-gray-500">选择不同AI模型，调整应用设置</p>
                            </div>
                        </div>
                    `;
                    return welcomeDiv;
                }
            };
        } catch (error) {
        }
    }
    
    /**
     * 初始化子模块
     */
    initSubmodules() {
        try {
            // 初始化代码块管理模块（先初始化，让其他模块能使用它的组件）
            this.codeBlockManager = new CodeBlockManager();
            this.codeBlockManager.init();
            
            // 将代码块管理器设置为全局可访问对象
            window.codeBlockManager = this.codeBlockManager;
            
            // 确保格式化器使用相同的预览实例
            if (this.formatter && this.codeBlockManager.htmlPreview) {
                this.formatter.htmlPreview = this.codeBlockManager.htmlPreview;
            }
            
            // 初始化消息处理模块
            this.messageHandler = new MessageHandler({
                chatMessages: this.chatMessages,
                chatComponent: this.ChatMessageComponent,
                conversationManager: this.conversationManager,
                onDeleteMessage: (index) => this.handleDeleteMessage(index),
                onEditMessage: (index, content) => this.handleEditMessage(index, content)
            });
            // 初始化消息处理模块 - 绑定事件
            this.messageHandler.init();
            
            // 初始化流式响应管理模块
            this.streamManager = new StreamManager({
                chatComponent: this.ChatMessageComponent,
                onScroll: () => this.scrollToBottom()
            });
            
            // 初始化模型管理模块
            this.modelManager = new ModelManager({
                modelSelect: this.modelSelect,
                selectedModelText: this.selectedModelText,
                onModelChange: (modelId) => this.handleModelChange(modelId)
            });
            
            // 初始化侧边栏管理模块
            this.sidebarManager = new SidebarManager({
                sidebar: this.sidebar,
                conversationList: this.conversationList,
                newChatBtn: this.newChatBtn,
                conversationManager: this.conversationManager,
                onSwitchConversation: (conversationId) => this.loadConversation(conversationId),
                onNewChat: () => this.newChat()
            });
            
            // 初始化模态框管理模块
            this.modalManager = new ModalManager({
                settingsManager: this.settingsManager,
                chatComponent: this.ChatMessageComponent,
                conversationManager: this.conversationManager,
                modelManager: this.modelManager,
                onEditMessage: (index, content) => this.handleEditMessage(index, content),
                onSaveSettings: () => this.handleSettingsUpdate()
            });
            
            // 初始化导出管理模块
            this.exportManager = new ExportManager({
                conversationManager: this.conversationManager,
                chatComponent: this.ChatMessageComponent
            });
            
        } catch (error) {
        }
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 发送按钮事件
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => {
                if (!this.isGenerating) {
                    this.sendMessage();
                }
            });
        }
        
        // 停止按钮事件
        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stopGeneration());
        }
        
        // 消息输入框事件
        if (this.messageInput) {
            // 处理输入法事件
            let isComposing = false;
            
            this.messageInput.addEventListener('compositionstart', () => {
                isComposing = true;
            });
            
            this.messageInput.addEventListener('compositionend', () => {
                isComposing = false;
            });
            
            // 处理输入框高度自适应
            this.messageInput.addEventListener('input', () => {
                this.adjustTextareaHeight();
            });
            
            // 处理按键事件，避免中文输入法问题
            this.messageInput.addEventListener('keydown', (e) => {
                // 检查是否处于中文输入法状态
                if (e.key === 'Enter' && !e.shiftKey && !isComposing && e.keyCode !== 229) {
                    e.preventDefault();
                    if (!this.isGenerating) {
                        this.sendMessage();
                    }
                }
            });
        }
        
        // 清除按钮事件
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                if (confirm('确定要清除所有消息吗？这将创建一个新的对话。')) {
                    this.newChat();
                }
            });
        }
        
        // 设置按钮事件
        if (this.settingsButton) {
            this.settingsButton.addEventListener('click', () => this.modalManager.openSettingsModal());
        }
        
        // 底部快捷键按钮事件
        const keyboardShortcutsBtn = document.getElementById('keyboardShortcutsBtn');
        if (keyboardShortcutsBtn) {
            keyboardShortcutsBtn.addEventListener('click', () => {
                this.modalManager.showShortcutsHelp();
            });
        }
        
        // 底部API设置按钮事件
        if (this.apiSettingsBtn) {
            this.apiSettingsBtn.addEventListener('click', () => {
                this.modalManager.openSettingsModal();
            });
        }
        
        // 设置滚动检测
        this.setupScrollDetection();
        
        // 绑定快捷键
        this.bindShortcuts();
        
        // 初始调整输入框高度
        this.adjustTextareaHeight();
    }
    
    /**
     * 自动调整输入框高度
     */
    adjustTextareaHeight() {
        if (!this.messageInput) return;
        
        // 重置高度
        this.messageInput.style.height = 'auto';
        
        // 计算新高度
        const newHeight = Math.min(Math.max(this.messageInput.scrollHeight, 40), 200); // 最小高度40px，最大高度200px
        
        // 设置新高度
        this.messageInput.style.height = newHeight + 'px';
    }
    
    /**
     * 绑定键盘快捷键
     */
    bindShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K/Cmd+K: 聚焦到输入框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (this.messageInput) {
                    this.messageInput.focus();
                }
            }
            
            // Ctrl+N/Cmd+N: 新建对话
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.newChat();
            }
            
            // Esc: 停止生成
            if (e.key === 'Escape' && this.isGenerating) {
                e.preventDefault();
                this.stopGeneration();
            }
            
            // Alt+T: 切换暗/亮模式
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                document.body.classList.toggle('dark');
                localStorage.setItem('dark_mode', document.body.classList.contains('dark') ? 'true' : 'false');
            }
            
            // Ctrl+E/Cmd+E: 导出为Markdown
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'e') {
                e.preventDefault();
                this.exportManager.exportChat('markdown');
            }
            
            // Ctrl+Shift+E/Cmd+Shift+E: 导出为PDF
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.exportManager.exportChat('pdf');
            }
            
            // ?: 显示快捷键帮助
            if (e.key === '?' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.modalManager.showShortcutsHelp();
            }
        });
    }
    
    /**
     * 加载当前对话
     */
    loadCurrentConversation() {
        const currentConversation = this.conversationManager.getCurrentConversation();
        
        // 如果没有当前对话，创建一个新对话
        if (!currentConversation) {
            this.newChat();
            return;
        }
        
        // 清空聊天区域
        this.messageHandler.clearChatArea();
        
        // 加载对话中的所有消息
        if (currentConversation.messages && currentConversation.messages.length > 0) {
            currentConversation.messages.forEach((message, index) => {
                if (message.role === 'user') {
                    // 添加用户消息并设置索引
                    const userMessageElement = this.messageHandler.addUserMessage(message.content, false);
                    if (userMessageElement && userMessageElement instanceof HTMLElement) {
                        userMessageElement.dataset.index = String(index);
                    }
                } else if (message.role === 'assistant') {
                    // 添加AI消息并设置索引
                    const assistantResult = this.messageHandler.addAssistantMessage(message.content);
                    if (assistantResult && assistantResult.element instanceof HTMLElement) {
                        assistantResult.element.dataset.index = String(index);
                        
                        // 计算并更新token数量，解决"估算中..."问题
                        this.updateTokenCount(assistantResult.id, message.content);
                    }
                }
            });
            
            // 确保绑定所有消息的事件
            this.messageHandler.bindMessageEvents();
            
            // 应用代码高亮和互动功能
            this.formatter.addCodeInteractionButtons();
            
            // 重新初始化代码块UI和交互
            if (this.codeBlockManager) {
                this.codeBlockManager.reinitializeCodeBlocks();
            }
            
            // 滚动到底部
            this.scrollToBottom();
        }
        
        // 设置页面标题
        document.title = currentConversation.title || 'PureAI Panel';
        
        // 选择当前对话使用的模型
        if (currentConversation.config && currentConversation.config.model) {
            // 使用对话特定的配置中的模型
            this.modelManager.selectModel(currentConversation.config.model);
        } else if (currentConversation.model) {
            // 兼容旧版数据格式
            this.modelManager.selectModel(currentConversation.model);
            
            // 将旧格式数据迁移到新配置对象中
            if (!currentConversation.config) {
                currentConversation.config = {
                    model: currentConversation.model,
                    temperature: 0.7,
                    systemMessage: ''
                };
                this.conversationManager.saveConversations();
            }
        }
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
    }
    
    /**
     * 保存当前对话（如果需要）
     */
    saveCurrentConversationIfNeeded() {
        // 这个方法只是一个兼容层，在ConversationManager中已经在每次修改后自动保存
        // 不需要额外操作，但保留此方法以维持API兼容性
    }
    
    /**
     * 加载指定对话
     * @param {string} conversationId - 对话ID
     */
    loadConversation(conversationId) {
        // 保存当前对话
        this.saveCurrentConversationIfNeeded();
        
        // 设置当前对话
        if (conversationId) {
            this.conversationManager.switchConversation(conversationId);
        } else {
            // 如果没有指定对话ID，则创建新对话
            this.newChat();
            return;
        }
        
        // 加载对话内容
        this.loadCurrentConversation();
    }
    
    /**
     * 新建对话
     */
    newChat() {
        // 创建新对话
        this.conversationManager.createNewConversation();
        
        // 清空聊天区域
        this.messageHandler.clearChatArea();
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
        
        // 设置页面标题
        document.title = '新对话 - PureAI Panel';
        
        // 聚焦输入框
        if (this.messageInput) {
            this.messageInput.focus();
        }
    }
    
    /**
     * 发送消息
     */
    async sendMessage() {
        if (!this.messageInput || !this.messageInput.value.trim()) return;
        
        // 检查API设置是否有效
        const apiKey = this.settingsManager.get('apiKey');
        if (!apiKey) {
            alert('请先在设置中配置API密钥，否则无法与AI对话');
            if (this.modalManager) {
                this.modalManager.openSettingsModal();
            }
            return;
        }
        
        // 获取用户消息内容
        const userMessage = this.messageInput.value.trim();
        
        // 清空输入框
        this.messageInput.value = '';
        
        // 添加用户消息到界面
        const userMessageElement = this.messageHandler.addUserMessage(userMessage);
        
        // 保存消息到当前对话 - 这里添加用户消息
        const userMsg = this.conversationManager.addMessage('user', userMessage);
        // 同时提前添加一个空的助手消息占位符，避免在generateResponse中重复添加
        const assistantMsg = this.conversationManager.addMessage('assistant', '');
        
        // 记录消息索引便于后续更新
        const userIndex = this.conversationManager.getCurrentConversation().messages.length - 2;
        const assistantIndex = this.conversationManager.getCurrentConversation().messages.length - 1;
        
        // 重要：设置用户消息的索引属性
        if (userMessageElement instanceof HTMLElement) {
            userMessageElement.dataset.index = userIndex.toString();
        }
        
        // 更新对话列表
        this.sidebarManager.renderConversationList();
        
        // 重置临时数据，确保每次都能重新生成响应
        this._currentStreamContent = '';
        this._lastAssistantMessageId = null;
        
        // 发送到API获取回复，传入索引便于更新
        await this.generateResponse(userMessage, userIndex, assistantIndex);
    }
    
    /**
     * 生成AI响应
     * @param {string} userMessage - 用户消息
     * @param {number} userIndex - 用户消息在对话中的索引
     * @param {number} assistantIndex - 助手消息在对话中的索引
     */
    async generateResponse(userMessage, userIndex, assistantIndex) {
        // 防止重复生成
        if (this.isGenerating) return;
        
        try {
            // 设置生成状态
            this.isGenerating = true;
            // 设置全局生成状态
            this.streamManager.setGlobalGeneratingState(true);
            
            // 更新UI状态
            this.showStopButton(true);
            if (this.sendingIndicator) {
                this.sendingIndicator.classList.remove('hidden');
            }
            
            // 重置之前的消息状态数据
            this._currentStreamContent = '';
            
            // 创建新的消息元素
            const { element: assistantElement, id: assistantId } = this.ChatMessageComponent.createAssistantMessage('', null, true);
            this.chatMessages.appendChild(assistantElement);
            this._lastAssistantMessageId = assistantId;
            
            // 为助手消息设置索引属性
            if (assistantElement instanceof HTMLElement) {
                assistantElement.dataset.index = assistantIndex.toString();
            }
            
            // 请求响应
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            
            // 获取当前对话的配置
            const currentConversation = this.conversationManager.getCurrentConversation();
            
            // 获取对话特定的模型或全局模型
            let selectedModel;
            if (currentConversation.config && currentConversation.config.model) {
                // 使用对话特定的模型
                const modelId = currentConversation.config.model;
                selectedModel = {
                    id: modelId,
                    name: this.modelManager.getModelNameById(modelId) || modelId
                };
            } else {
                // 使用全局模型
                selectedModel = this.modelManager.getSelectedModel();
                
                // 如果对话没有配置，初始化它
                if (!currentConversation.config) {
                    currentConversation.config = {
                        model: selectedModel.id,
                        temperature: 0.7,
                        systemMessage: ''
                    };
                    this.conversationManager.saveConversations();
                }
            }
            
            // 获取特定于对话的设置
            const config = {
                temperature: currentConversation.config?.temperature || 0.7,
                systemMessage: currentConversation.config?.systemMessage || ''
            };
            
            // 处理流式响应
            const handleStreamResponse = (chunk) => {
                if (signal.aborted) return;
                
                try {
                    // 更新流消息
                    this.streamManager.updateStreamMessage(assistantId, chunk);
                    
                    // 保存最新内容到临时变量，用于最终更新
                    this._currentStreamContent = chunk;
                    
                    // 尝试获取代码块，应用代码高亮和交互功能
                    this.codeBlockManager.updateCodeBlocks();
                    
                    // 滚动到底部
                    this.scrollToBottom();
                } catch (e) {
                }
            };
            
            // 完成处理函数
            const handleStreamEnd = () => {
                if (signal.aborted) return;
                
                try {
                    // 获取完整的流式内容
                    const finalContent = this._currentStreamContent || '';
                    
                    // 完成流式动画
                    this.streamManager.completeStreaming(assistantId, finalContent);
                    
                    // 确保更新消息元素的内容属性
                    const assistantElement = document.getElementById(assistantId);
                    if (assistantElement) {
                        assistantElement.dataset.content = finalContent;
                    }
                    
                    // 更新对话管理器中的助手消息内容并确保保存
                    if (this.conversationManager) {
                        this.conversationManager.editMessage(assistantIndex, finalContent);
                    }
                    
                    // 预估并显示token数量
                    this.updateTokenCount(assistantId, finalContent);
                    
                    // 结束消息后的回调
                    const handleStreamingComplete = () => {
                        // 重置生成状态
                        this.isGenerating = false;
                        this.streamManager.setGlobalGeneratingState(false);
                        this.abortController = null;
                        
                        // 添加消息索引，用于编辑和删除
                        const assistantElement = document.getElementById(assistantId);
                        if (assistantElement) {
                            // 获取当前会话中最新消息的索引
                            const currentConversation = this.conversationManager.getCurrentConversation();
                            if (currentConversation && currentConversation.messages) {
                                // 设置消息索引为最后一条消息的索引
                                const messageIndex = currentConversation.messages.length - 1;
                                assistantElement.dataset.index = messageIndex.toString();
                            }
                        }
                        
                        // 更新UI状态 - 强制将停止按钮隐藏，将发送按钮显示
                        this.showStopButton(false);
                        if (this.sendingIndicator) {
                            this.sendingIndicator.classList.add('hidden');
                        }
                        if (this.sendButton) {
                            this.sendButton.classList.remove('hidden');
                            this.sendButton.disabled = false;
                        }
                        
                        // 保存当前对话
                        this.saveCurrentConversationIfNeeded();
                        
                        // 最终处理代码块
                        setTimeout(() => {
                            try {
                                // 应用代码高亮和交互功能
                                this.codeBlockManager.updateCodeBlocks();
                                this.ChatMessageComponent.applyCodeHighlightingToElement(assistantElement);
                                
                                // 添加预览功能到HTML代码块
                                this.formatter.addCodeInteractionButtons();
                                
                                // 重新初始化代码块UI和交互
                                if (this.codeBlockManager) {
                                    this.codeBlockManager.reinitializeCodeBlocks();
                                    this.codeBlockManager.setupCodeBlockInteractions();
                                }
                                
                                // 应用图片预览功能和重新绑定消息事件
                                if (this.messageHandler && typeof this.messageHandler.bindMessageEvents === 'function') {
                                    this.messageHandler.bindMessageEvents();
                                }
                                if (this.messageHandler && typeof this.messageHandler.setupImagePreviews === 'function') {
                                    this.messageHandler.setupImagePreviews();
                                }
                                
                                // 再次检查并确保输入框状态被重置
                                this.showStopButton(false);
                            } catch (e) {
                            }
                        }, 100);
                    };
                    
                    // 设置流动完成回调
                    this.streamManager.setAnimationCompleteCallback(handleStreamingComplete);
                    
                    // 直接执行一次回调，确保状态被重置
                    // 这样即使流式动画回调出问题，UI状态也能恢复
                    setTimeout(() => {
                        this.isGenerating = false;
                        this.streamManager.setGlobalGeneratingState(false);
                        this.showStopButton(false);
                    }, 500);
                } catch (e) {
                    
                    // 确保状态正确重置
                    this.isGenerating = false;
                    this.streamManager.setGlobalGeneratingState(false);
                    this.showStopButton(false);
                    this.sendingIndicator.classList.add('hidden');
                }
            };
            
            // 错误处理函数
            const handleStreamError = (error) => {
                
                // 重置状态
                this.isGenerating = false;
                this.streamManager.setGlobalGeneratingState(false);
                this.showStopButton(false);
                this.sendingIndicator.classList.add('hidden');
                
                // 显示错误消息
                const errorMsg = '⚠️ 生成回复时出现错误，请稍后再试。';
                const errorElement = document.createElement('div');
                errorElement.className = 'error-message text-red-500 text-sm mt-1 ml-12';
                errorElement.textContent = errorMsg;
                
                // 添加错误到助手消息下方
                const msgElement = document.getElementById(assistantId);
                if (msgElement) {
                    msgElement.appendChild(errorElement);
                }
            };
            
            // 获取当前对话的所有消息
            const conversationMessages = this.conversationManager.getCurrentConversation().messages;
            
            // 确保消息格式正确
            const formattedMessages = conversationMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            // 发送API请求
            await this.apiClient.generateChatCompletion(
                formattedMessages,
                selectedModel.id,
                handleStreamResponse,
                handleStreamEnd,
                handleStreamError,
                signal,
                config
            );
        } catch (error) {
            
            // 重置状态
            this.isGenerating = false;
            this.streamManager.setGlobalGeneratingState(false);
            this.showStopButton(false);
            this.sendingIndicator.classList.add('hidden');
        }
    }
    
    /**
     * 停止生成
     */
    stopGeneration() {
        if (!this.isGenerating || !this.abortController) return;
        
        // 中止当前请求
        this.abortController.abort();
        
        // 停止流式动画
        this.streamManager.stopAllAnimations();
        
        // 更新状态
        this.isGenerating = false;
        
        // 确保UI完全重置
        this.showStopButton(false);
        if (this.sendingIndicator) {
            this.sendingIndicator.classList.add('hidden');
        }
        if (this.sendButton) {
            this.sendButton.classList.remove('hidden');
            this.sendButton.disabled = false;
        }
        
        // 移除生成中的全局状态类
        document.body.classList.remove('isGenerating');
        
    }
    
    /**
     * 显示或隐藏停止按钮，同时控制发送按钮状态
     * @param {boolean} show - 是否显示停止按钮
     */
    showStopButton(show) {
        if (this.stopButton) {
            this.stopButton.classList.toggle('hidden', !show);
        }
        
        if (this.sendingIndicator) {
            this.sendingIndicator.classList.toggle('hidden', !show);
        }
        
        if (this.sendButton) {
            if (show) {
                // 生成中状态
                this.sendButton.classList.add('hidden');
                this.sendButton.disabled = true;
            } else {
                // 可发送状态
                this.sendButton.classList.remove('hidden');
                this.sendButton.disabled = false;
            }
        }
        
        // 更新全局生成状态
        document.body.classList.toggle('isGenerating', show);
        
        // 将this.isGenerating与UI状态同步
        this.isGenerating = show;
        
    }
    
    /**
     * 添加用户滚动检测
     */
    setupScrollDetection() {
        if (!this.chatMessages) return;
        
        // 添加用户是否手动滚动的标志
        this.userHasScrolled = false;
        this.lastScrollTop = 0;
        this.scrollThreshold = 100; // 滚动阈值，超过这个值才判定为用户主动滚动
        
        // 监听滚动事件
        this.chatMessages.addEventListener('scroll', () => {
            // 当前滚动位置
            const currentScrollTop = this.chatMessages.scrollTop;
            
            // 最大可滚动距离
            const maxScrollTop = this.chatMessages.scrollHeight - this.chatMessages.clientHeight;
            
            // 如果用户往上滚动了超过阈值，标记为用户手动滚动
            if (maxScrollTop - currentScrollTop > this.scrollThreshold && 
                currentScrollTop < this.lastScrollTop) {
                if (!this.userHasScrolled) {
                    this.userHasScrolled = true;
                }
            }
            
            // 如果用户滚动到了接近底部，重新启用自动滚动
            if (maxScrollTop - currentScrollTop < 30) {
                if (this.userHasScrolled) {
                    this.userHasScrolled = false;
                }
            }
            
            // 更新上次滚动位置
            this.lastScrollTop = currentScrollTop;
        });
        
        // 添加鼠标滚轮事件监听，更精确地检测用户滚动意图
        this.chatMessages.addEventListener('wheel', (e) => {
            // 检测是否是向上滚动
            if (e.deltaY < 0) {
                this.userHasScrolled = true;
            }
            // 如果用户已经接近底部并向下滚动，重新启用自动滚动
            const maxScrollTop = this.chatMessages.scrollHeight - this.chatMessages.clientHeight;
            if (maxScrollTop - this.chatMessages.scrollTop < 30 && e.deltaY > 0) {
                this.userHasScrolled = false;
            }
        });
        
    }
    
    /**
     * 滚动到底部
     */
    scrollToBottom() {
        if (!this.chatMessages) return;
        
        // 如果用户正在查看历史消息（手动滚动了），则不自动滚动
        if (this.userHasScrolled) {
            // 显示新消息提示
            this._showNewMessageIndicator();
            return;
        }
        
        // 使用平滑滚动效果，提高用户体验
        this.chatMessages.scrollTo({
            top: this.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }
    
    /**
     * 显示新消息提示
     * @private
     */
    _showNewMessageIndicator() {
        // 检查是否已经有提示
        let indicator = document.getElementById('new-message-indicator');
        
        if (!indicator) {
            // 创建一个新的提示元素
            indicator = document.createElement('div');
            indicator.id = 'new-message-indicator';
            indicator.className = 'fixed bottom-20 right-6 bg-openai-green text-white px-3 py-2 rounded-full shadow-lg cursor-pointer z-50 flex items-center';
            indicator.innerHTML = '<i class="fas fa-arrow-down mr-2"></i> 新消息';
            
            // 点击滚动到底部并移除提示
            indicator.addEventListener('click', () => {
                this.userHasScrolled = false;
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                indicator.remove();
            });
            
            document.body.appendChild(indicator);
            
            // 5秒后自动消失
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 5000);
        }
    }
    
    /**
     * 处理删除消息
     * @param {number} index - 消息索引
     */
    handleDeleteMessage(index) {
        // 删除指定索引的消息
        this.conversationManager.deleteMessage(index);
        
        // 重新加载当前对话
        this.loadCurrentConversation();
    }
    
    /**
     * 处理编辑消息
     * @param {number} index - 消息索引
     * @param {string} content - 新消息内容
     */
    handleEditMessage(index, content) {
        // 更新指定索引的消息
        this.conversationManager.editMessage(index, content);
        
        // 重新加载当前对话
        this.loadCurrentConversation();
    }
    
    /**
     * 处理模型变更
     * @param {string} modelId - 模型ID
     */
    handleModelChange(modelId) {
        // 更新当前对话使用的模型
        const currentConversation = this.conversationManager.getCurrentConversation();
        if (currentConversation) {
            // 更新旧版模型字段（兼容性）
            currentConversation.model = modelId;
            
            // 更新新版配置对象
            if (!currentConversation.config) {
                currentConversation.config = {
                    model: modelId,
                    temperature: 0.7,
                    systemMessage: ''
                };
            } else {
                currentConversation.config.model = modelId;
            }
            
            // 保存更改
            this.conversationManager.saveConversations();
        }
    }
    
    /**
     * 处理设置更新
     */
    handleSettingsUpdate() {
        // 这里可以实现设置更新后的逻辑
    }
    
    /**
     * 更新消息的token计数
     * @param {string} messageId - 消息ID
     * @param {string} content - 消息内容
     */
    updateTokenCount(messageId, content) {
        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
            try {
                // 使用ChatMessageComponent的估算方法计算token数量
                const estimatedTokens = this.ChatMessageComponent.estimateTokenCount(content);
                // 更新UI显示
                tokenCountElement.textContent = `${estimatedTokens} tokens`;
                tokenCountElement.title = "估计的Token数量";
                // 移除"估算中..."状态
                tokenCountElement.classList.remove('estimating');
            } catch (e) {
                tokenCountElement.textContent = "计算错误";
            }
        } else {
        }
    }
} 