import { MessageFormatter } from './utils.js';

export class ChatUI {
    constructor(apiService, settingsManager, ChatMessageComponent, conversationManager) {
        this.apiService = apiService;
        this.settingsManager = settingsManager;
        this.ChatMessageComponent = ChatMessageComponent;
        this.conversationManager = conversationManager;
        this.isWaitingForResponse = false;
        this.mobileMenuOpen = false;
        
        // 模型列表 - 只保留用户指定的模型
        this.models = [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini (2024-07-18)' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
            { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini (2025-04-14)' },
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
            { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano (2025-04-14)' }
        ];
    }
    
    // HTML预览初始化标志
    static didInitPreview = false;
    
    // 初始化UI
    init() {
        // 聊天区域元素
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.stopButton = document.getElementById('stopButton');
        this.clearButton = document.getElementById('clearChat');
        this.modelSelect = document.getElementById('modelSelect');
        this.selectedModelText = document.getElementById('selectedModel');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.sidebar = document.getElementById('sidebar');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.conversationList = document.getElementById('conversationList');
        
        if (!this.chatMessages || !this.messageInput || !this.sendButton || 
            !this.clearButton || !this.modelSelect || !this.selectedModelText || !this.settingsBtn) {
            console.error('UI元素未找到，请检查DOM结构');
            return;
        }
        
        // 初始化模型下拉框
        this.initModelSelect();
        
        // 绑定事件
        this.bindEvents();
        
        // 自动调整文本框高度
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(200, Math.max(40, this.messageInput.scrollHeight)) + 'px';
        });
        
        // 添加移动设备菜单按钮
        this.addMobileMenuButton();
        
        // 加载对话历史
        this.renderConversationList();
        
        // 加载当前对话的消息
        this.loadCurrentConversation();
    }
    
    // 添加移动设备菜单按钮
    addMobileMenuButton() {
        // 检查是否在移动设备上
        if (window.innerWidth <= 768) {
            const menuButton = document.createElement('button');
            menuButton.className = 'h-8 w-8 flex items-center justify-center rounded-md hover:bg-openai-hover transition-all text-openai-gray mr-2';
            menuButton.innerHTML = '<i class="fas fa-bars"></i>';
            menuButton.addEventListener('click', () => this.toggleMobileMenu());
            
            // 将按钮添加到顶部导航栏
            const header = document.querySelector('header');
            if (header) {
                header.insertBefore(menuButton, header.firstChild);
            }
            
            // 添加遮罩层
            this.addSidebarOverlay();
        }
        
        // 监听窗口大小变化，根据需要添加或删除菜单按钮
        window.addEventListener('resize', () => {
            const existingButton = document.querySelector('header button:first-child');
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile && !existingButton) {
                this.addMobileMenuButton();
            } else if (!isMobile && existingButton && existingButton.querySelector('.fa-bars')) {
                existingButton.remove();
                
                // 移除遮罩层
                const overlay = document.querySelector('.sidebar-overlay');
                if (overlay) {
                    overlay.remove();
                }
                
                // 确保侧边栏在大屏幕上显示
                if (this.sidebar) {
                    this.sidebar.style.left = '';
                    this.sidebar.classList.remove('open');
                }
            }
        });
    }
    
    // 添加侧边栏遮罩层
    addSidebarOverlay() {
        // 检查是否已存在遮罩层
        if (document.querySelector('.sidebar-overlay')) return;
        
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        
        // 点击遮罩层关闭侧边栏
        overlay.addEventListener('click', () => {
            this.toggleMobileMenu(false);
        });
        
        // 添加到DOM
        document.body.appendChild(overlay);
    }
    
    // 切换移动菜单
    toggleMobileMenu(forceState) {
        this.mobileMenuOpen = forceState !== undefined ? forceState : !this.mobileMenuOpen;
        
        if (this.sidebar) {
            this.sidebar.classList.toggle('open', this.mobileMenuOpen);
            
            // 控制遮罩层显示
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) {
                overlay.classList.toggle('active', this.mobileMenuOpen);
            }
            
            // 防止底层内容滚动
            document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
        }
    }
    
    // 初始化模型下拉框
    initModelSelect() {
        // 清空现有选项
        this.modelSelect.innerHTML = '';
        
        // 从localStorage获取保存的模型
        const savedModel = localStorage.getItem('selected_model');
        
        // 默认选择第一个模型或已保存的模型
        this.currentModel = savedModel || this.models[0].id;
        
        // 添加模型选项
        this.models.forEach(model => {
            const listItem = document.createElement('li');
            const button = document.createElement('a');
            button.textContent = model.name;
            button.dataset.modelId = model.id;
            
            // 选中已保存的模型或默认选中第一个
            if (model.id === this.currentModel) {
                button.classList.add('active');
                this.selectedModelText.textContent = model.name;
            }
            
            button.addEventListener('click', () => {
                this.currentModel = model.id;
                this.selectedModelText.textContent = model.name;
                // 保存模型选择到本地存储
                localStorage.setItem('selected_model', model.id);
                
                // 找到下拉框的触发按钮并手动关闭下拉菜单
                const dropdownButton = document.querySelector('.dropdown [role="button"]');
                if (dropdownButton) {
                    // 移除dropdown-open类以关闭下拉框
                    document.querySelectorAll('.dropdown').forEach(dropdown => {
                        dropdown.classList.remove('dropdown-open');
                    });
                }
            });
            
            listItem.appendChild(button);
            this.modelSelect.appendChild(listItem);
        });
    }
    
    // 渲染对话列表
    renderConversationList() {
        if (!this.conversationList) return;
        
        // 清空对话列表容器
        this.conversationList.innerHTML = '';
        
        // 获取所有对话
        const conversations = this.conversationManager.getAllConversations();
        
        // 获取当前对话ID
        const currentConversation = this.conversationManager.getCurrentConversation();
        const currentConversationId = currentConversation ? currentConversation.id : null;
        
        // 添加所有对话到列表
        conversations.forEach(conversation => {
            const conversationItem = document.createElement('div');
            conversationItem.className = `flex items-center justify-between p-2 rounded-md hover:bg-openai-hover cursor-pointer group ${
                conversation.id === currentConversationId ? 'bg-openai-hover' : ''
            } ${conversation.isPinned ? 'pinned-conversation' : ''}`;
            conversationItem.dataset.id = conversation.id;
            
            // 格式化日期
            const date = new Date(conversation.updatedAt);
            const formattedDate = new Intl.DateTimeFormat('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
            
            // 构建左侧内容 - 包含标题和时间
            const contentDiv = document.createElement('div');
            contentDiv.className = 'flex-1 truncate mr-2';
            
            // 标题行 - 包含置顶图标和标题文本
            const titleRow = document.createElement('div');
            titleRow.className = 'flex items-center';
            
            // 置顶图标
            if (conversation.isPinned) {
                const pinnedIcon = document.createElement('span');
                pinnedIcon.className = 'mr-1 text-openai-green';
                pinnedIcon.innerHTML = '<i class="fas fa-thumbtack text-xs"></i>';
                titleRow.appendChild(pinnedIcon);
            }
            
            // 标题文本
            const titleText = document.createElement('div');
            titleText.className = 'text-sm font-medium truncate';
            titleText.textContent = conversation.title;
            titleRow.appendChild(titleText);
            
            contentDiv.appendChild(titleRow);
            
            // 时间显示
            const timeDiv = document.createElement('div');
            timeDiv.className = 'text-xs text-openai-gray truncate';
            timeDiv.textContent = formattedDate;
            contentDiv.appendChild(timeDiv);
            
            // 构建右侧操作按钮区
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex opacity-0 group-hover:opacity-100 transition-opacity';
            
            // 置顶按钮
            const pinBtn = document.createElement('button');
            pinBtn.className = 'h-6 w-6 flex items-center justify-center rounded-md hover:bg-openai-hover text-openai-gray mr-1';
            pinBtn.title = conversation.isPinned ? '取消置顶' : '置顶对话';
            pinBtn.innerHTML = conversation.isPinned ? 
                '<i class="fas fa-thumbtack text-xs text-openai-green"></i>' : 
                '<i class="fas fa-thumbtack text-xs"></i>';
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'h-6 w-6 flex items-center justify-center rounded-md hover:bg-openai-hover text-openai-gray';
            deleteBtn.title = '删除对话';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt text-xs"></i>';
            
            actionsDiv.appendChild(pinBtn);
            actionsDiv.appendChild(deleteBtn);
            
            // 组装对话项
            conversationItem.appendChild(contentDiv);
            conversationItem.appendChild(actionsDiv);
            
            // 切换对话事件
            contentDiv.addEventListener('click', () => {
                this.switchConversation(conversation.id);
            });
            
            // 置顶按钮事件
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.conversationManager.togglePinStatus(conversation.id);
                this.renderConversationList();
            });
            
            // 删除对话事件
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 确认删除
                if (confirm('确定要删除这个对话吗？')) {
                    this.conversationManager.deleteConversation(conversation.id);
                    this.renderConversationList();
                    
                    // 如果删除的是当前对话，加载新的当前对话
                    if (conversation.id === currentConversationId) {
                        this.loadCurrentConversation();
                    }
                }
            });
            
            this.conversationList.appendChild(conversationItem);
        });
    }
    
    // 切换对话
    switchConversation(conversationId) {
        this.conversationManager.switchConversation(conversationId);
        this.loadCurrentConversation();
        this.renderConversationList();
        
        // 移动端自动关闭侧边栏
        if (window.innerWidth <= 768) {
            this.sidebar.classList.remove('open');
            this.mobileMenuOpen = false;
        }
    }
    
    // 创建新对话
    createNewConversation() {
        this.conversationManager.createNewConversation();
        this.loadCurrentConversation();
        this.renderConversationList();
    }
    
    // 加载当前对话的消息
    loadCurrentConversation() {
        // 清空聊天区域
        this.chatMessages.innerHTML = '';
        
        const conversation = this.conversationManager.getCurrentConversation();
        if (!conversation.messages || conversation.messages.length === 0) {
            // 如果没有消息，添加欢迎消息
            this.chatMessages.appendChild(
                this.ChatMessageComponent.createWelcomeMessage()
            );
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
    }
    
    // 绑定消息编辑和删除事件
    bindMessageEvents() {
        // 编辑消息 - 包括用户和AI消息
        this.chatMessages.querySelectorAll('.edit-message-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageElement = button.closest('.chat');
                if (!messageElement || !(messageElement instanceof HTMLElement)) return;
                
                const messageIndex = parseInt(messageElement.dataset.index || '-1');
                if (messageIndex === -1) return;
                
                const originalContent = messageElement.dataset.content || '';
                const isAiMessage = messageElement.classList.contains('chat-start');
                
                this.showEditMessageModal(messageIndex, originalContent, isAiMessage);
            });
        });
        
        // 删除消息
        this.chatMessages.querySelectorAll('.delete-message-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageElement = button.closest('.chat');
                if (!messageElement || !(messageElement instanceof HTMLElement)) return;
                
                const messageIndex = parseInt(messageElement.dataset.index || '-1');
                if (messageIndex === -1) return;
                
                const isAiMessage = messageElement.classList.contains('chat-start');
                const confirmMessage = isAiMessage ? '确认删除此AI回复？' : '确认删除此消息？';
                
                if (confirm(confirmMessage)) {
                    this.deleteMessage(messageIndex);
                }
            });
        });
    }
    
    // 显示编辑消息的模态框
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
                const tokenCount = this.ChatMessageComponent.estimateTokenCount(originalContent);
                const countInfo = document.createElement('div');
                countInfo.className = 'text-xs text-openai-gray mt-1';
                countInfo.textContent = `估计token数量：约${tokenCount}`;
                textarea.parentNode?.insertBefore(countInfo, textarea.nextSibling);
                
                // 添加实时token计数
                textarea.addEventListener('input', () => {
                    const currentContent = textarea.value;
                    const currentTokens = this.ChatMessageComponent.estimateTokenCount(currentContent);
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
                    this.editMessage(messageIndex, newContent);
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
    
    // 编辑消息
    editMessage(messageIndex, newContent) {
        // 更新存储
        if (this.conversationManager.editMessage(messageIndex, newContent)) {
            // 重新加载对话以反映更改
            this.loadCurrentConversation();
            // @ts-ignore - window.toast在全局定义
            window.toast.success('消息已更新');
        } else {
            // @ts-ignore - window.toast在全局定义
            window.toast.error('更新消息失败');
        }
    }
    
    // 删除消息
    deleteMessage(messageIndex) {
        // 更新存储
        if (this.conversationManager.deleteMessage(messageIndex)) {
            // 重新加载对话以反映更改
            this.loadCurrentConversation();
            // @ts-ignore - window.toast在全局定义
            window.toast.success('消息已删除');
        } else {
            // @ts-ignore - window.toast在全局定义
            window.toast.error('删除消息失败');
        }
    }
    
    // 绑定事件
    bindEvents() {
        // 发送消息
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // 停止生成
        this.stopButton.addEventListener('click', () => this.stopGeneration());
        
        // 清空聊天
        this.clearButton.addEventListener('click', () => this.clearChat());
        
        // 打开设置
        this.settingsBtn.addEventListener('click', () => this.openSettingsModal());
        
        // 创建新对话
        this.newChatBtn.addEventListener('click', () => this.createNewConversation());
        
        // 按Enter发送消息 - 增加对中文输入法的支持
        this.messageInput.addEventListener('keydown', (e) => {
            // 检查是否正在使用输入法
            const isIMEComposing = e.isComposing || e.keyCode === 229;
            
            // 只有当不是在输入法编辑状态，且按下了Enter键（不带Shift）时才发送消息
            if (e.key === 'Enter' && !e.shiftKey && !isIMEComposing) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 添加导出按钮及事件
        this.addExportButton();
        
        // 添加全局键盘快捷键
        this.bindKeyboardShortcuts();
    }
    
    // 绑定键盘快捷键
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 如果在输入框中，不处理特殊快捷键（除了Enter发送）
            const activeElement = document.activeElement;
            const isInputActive = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
            
            // Ctrl+K 或 Cmd+K：聚焦到消息输入框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !isInputActive) {
                e.preventDefault();
                this.messageInput.focus();
            }
            
            // Ctrl+N 或 Cmd+N：新建对话
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.createNewConversation();
            }
            
            // Esc：停止生成回复
            if (e.key === 'Escape' && this.isWaitingForResponse) {
                e.preventDefault();
                this.stopGeneration();
            }
            
            // Ctrl+S 或 Cmd+S：保存设置
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                // 检查是否在设置弹窗中
                const settingsModal = document.getElementById('settingsModal');
                if (settingsModal && !settingsModal.classList.contains('hidden')) {
                    e.preventDefault();
                    this.saveSettings();
                }
            }
            
            // Ctrl+E 或 Cmd+E：导出为Markdown
            if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !isInputActive) {
                e.preventDefault();
                this.exportChat('markdown');
            }
            
            // Ctrl+Shift+E 或 Cmd+Shift+E：导出为PDF
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E' && !isInputActive) {
                e.preventDefault();
                this.exportChat('pdf');
            }
            
            // Alt+T：切换主题
            if (e.altKey && e.key === 't' && !isInputActive) {
                e.preventDefault();
                const themeBtn = document.getElementById('themeBtn');
                if (themeBtn) themeBtn.click();
            }
        });
        
        // 添加帮助按钮以显示快捷键列表
        this.addShortcutsHelpButton();
    }
    
    // 添加快捷键帮助按钮
    addShortcutsHelpButton() {
        const header = document.querySelector('header');
        if (!header) return;
        
        // 检查是否已存在帮助按钮
        if (document.getElementById('helpBtn')) return;
        
        // 创建帮助按钮
        const helpBtn = document.createElement('button');
        helpBtn.id = 'helpBtn';
        helpBtn.className = 'h-8 w-8 flex items-center justify-center rounded-md hover:bg-openai-hover transition-all text-openai-gray';
        helpBtn.title = '键盘快捷键帮助';
        helpBtn.innerHTML = '<i class="fas fa-keyboard text-sm"></i>';
        
        // 在导出按钮旁边插入帮助按钮
        const toolbar = header.querySelector('.flex.items-center.gap-2');
        if (toolbar) {
            toolbar.appendChild(helpBtn);
            
            // 添加点击事件显示帮助弹窗
            helpBtn.addEventListener('click', () => this.showShortcutsHelp());
        }
    }
    
    // 显示快捷键帮助弹窗
    showShortcutsHelp() {
        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.id = 'shortcutsModal';
        
        // 创建弹窗内容
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto';
        
        // 快捷键列表
        const shortcuts = [
            { key: 'Ctrl/Cmd + K', description: '聚焦到消息输入框' },
            { key: 'Ctrl/Cmd + N', description: '创建新对话' },
            { key: 'Esc', description: '停止生成回复' },
            { key: 'Enter', description: '发送消息' },
            { key: 'Shift + Enter', description: '在消息中插入换行' },
            { key: 'Ctrl/Cmd + E', description: '导出对话为Markdown' },
            { key: 'Ctrl/Cmd + Shift + E', description: '导出对话为PDF' },
            { key: 'Alt + T', description: '切换明暗主题' },
            { key: 'Ctrl/Cmd + S', description: '在设置界面保存设置' }
        ];
        
        // 构建弹窗内容
        modalContent.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium">键盘快捷键</h3>
                <button id="closeShortcutsBtn" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <ul class="space-y-2">
                    ${shortcuts.map(s => `
                        <li class="flex justify-between items-center py-1">
                            <span class="text-sm font-medium">${s.description}</span>
                            <span class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">${s.key}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        
        // 添加关闭按钮事件
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 添加关闭按钮事件
        const closeBtn = document.getElementById('closeShortcutsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            // 点击弹窗外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
            
            // ESC键关闭
            document.addEventListener('keydown', function closeOnEsc(e) {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', closeOnEsc);
                }
            });
        }
    }
    
    // 打开设置模态框
    openSettingsModal() {
        // 获取模态框元素
        let modal = document.getElementById('settingsModal');
        
        // 如果不存在，则创建一个新的模态框
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'settingsModal';
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm hidden';
            
            // 设置模态框内容
            modal.innerHTML = `
                <div class="bg-white dark:bg-[#202123] rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto transform transition-transform duration-300" id="modalContent">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-lg font-semibold text-openai-text dark:text-white flex items-center">
                                <i class="fas fa-cog mr-2 text-openai-gray"></i>
                                API 设置
                            </h3>
                            <button id="closeSettings" class="text-openai-gray hover:text-openai-text dark:hover:text-white transition-colors">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-openai-gray">
                                    Base URL
                                </label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <i class="fas fa-link text-openai-gray"></i>
                                    </div>
                                    <input 
                                        type="text" 
                                        id="baseUrl" 
                                        class="w-full pl-10 pr-4 py-2 border border-openai-border rounded-md focus:outline-none focus:ring-1 focus:ring-openai-green dark:bg-[#343541] dark:text-white" 
                                        placeholder="例如: https://api.openai.com">
                                </div>
                            </div>
                            
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-openai-gray">
                                    API Key
                                </label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <i class="fas fa-key text-openai-gray"></i>
                                    </div>
                                    <input 
                                        type="password" 
                                        id="apiKey" 
                                        class="w-full pl-10 pr-12 py-2 border border-openai-border rounded-md focus:outline-none focus:ring-1 focus:ring-openai-green dark:bg-[#343541] dark:text-white" 
                                        placeholder="输入你的 API Key">
                                    <button id="toggleKeyVisibility" class="absolute inset-y-0 right-0 flex items-center pr-3 text-openai-gray hover:text-openai-text transition-colors">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                                <p class="text-xs text-openai-gray mt-1">你的API密钥将只会保存在本地浏览器中</p>
                            </div>
                            
                            <div class="flex items-center">
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="streamEnabled" class="sr-only peer">
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-openai-green"></div>
                                    <span class="ml-3 text-sm font-medium text-openai-text dark:text-white">启用流式响应（打字效果）</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="flex justify-end mt-8">
                            <button id="saveSettings" class="px-4 py-2 bg-openai-green text-white rounded-md hover:bg-opacity-90 transition-colors flex items-center gap-2">
                                <i class="fas fa-save"></i>
                                保存设置
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到DOM
            document.body.appendChild(modal);
        }
        
        modal.classList.remove('hidden');
        
        // 加载当前设置
        const baseUrlInput = /** @type {HTMLInputElement} */ (document.getElementById('baseUrl'));
        const apiKeyInput = /** @type {HTMLInputElement} */ (document.getElementById('apiKey'));
        const streamEnabledInput = /** @type {HTMLInputElement} */ (document.getElementById('streamEnabled'));
        
        if (baseUrlInput) {
            baseUrlInput.value = this.settingsManager.get('baseUrl') || '';
        }
        
        if (apiKeyInput) {
            apiKeyInput.value = this.settingsManager.get('apiKey') || '';
        }
        
        if (streamEnabledInput) {
            streamEnabledInput.checked = this.settingsManager.get('streamEnabled') !== false;
        }
        
        // 保存设置按钮
        const saveButton = document.getElementById('saveSettings');
        if (saveButton) {
            // 移除现有事件监听器
            const newSaveButton = saveButton.cloneNode(true);
            saveButton.parentNode.replaceChild(newSaveButton, saveButton);
            
            // 添加新的事件监听器
            newSaveButton.addEventListener('click', () => {
                this.saveSettings();
                modal.classList.add('hidden');
            });
        }
        
        // 关闭按钮
        const closeButton = document.getElementById('closeSettings');
        if (closeButton) {
            // 移除现有事件监听器
            const newCloseButton = closeButton.cloneNode(true);
            closeButton.parentNode.replaceChild(newCloseButton, closeButton);
            
            // 添加新的事件监听器
            newCloseButton.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
        
        // 密码显示切换
        const toggleKeyBtn = document.getElementById('toggleKeyVisibility');
        if (toggleKeyBtn && toggleKeyBtn instanceof HTMLElement) {
            // 移除现有事件监听器
            const newToggleBtn = toggleKeyBtn.cloneNode(true);
            toggleKeyBtn.parentNode.replaceChild(newToggleBtn, toggleKeyBtn);
            
            // 添加新的事件监听器
            if (newToggleBtn instanceof HTMLElement) {
                newToggleBtn.addEventListener('click', () => {
                    const icon = newToggleBtn.querySelector('i');
                    if (icon && apiKeyInput) {
                        if (apiKeyInput.type === 'password') {
                            apiKeyInput.type = 'text';
                            icon.classList.remove('fa-eye');
                            icon.classList.add('fa-eye-slash');
                        } else {
                            apiKeyInput.type = 'password';
                            icon.classList.remove('fa-eye-slash');
                            icon.classList.add('fa-eye');
                        }
                    }
                });
            }
        }
    }
    
    // 保存设置
    saveSettings() {
        const baseUrlInput = /** @type {HTMLInputElement} */ (document.getElementById('baseUrl'));
        const apiKeyInput = /** @type {HTMLInputElement} */ (document.getElementById('apiKey'));
        const streamEnabledInput = /** @type {HTMLInputElement} */ (document.getElementById('streamEnabled'));
        
        if (baseUrlInput) {
            this.settingsManager.set('baseUrl', baseUrlInput.value);
        }
        
        if (apiKeyInput) {
            this.settingsManager.set('apiKey', apiKeyInput.value);
        }
        
        if (streamEnabledInput) {
            this.settingsManager.set('streamEnabled', streamEnabledInput.checked);
        }
        
        // 保存设置
        this.settingsManager.save();
    }
    
    // 停止生成
    stopGeneration() {
        if (this.isWaitingForResponse) {
            this.apiService.cancelCurrentStream();
            this.isWaitingForResponse = false;
            this.updateSendButtonState();
            
            // 移除聊天消息中的光标
            const cursorElements = document.querySelectorAll('.cursor-blink');
            cursorElements.forEach(el => el.remove());
        }
    }
    
    // 发送消息
    sendMessage() {
        // 获取消息内容并去除前后空白
        const messageInputElement = /** @type {HTMLTextAreaElement} */ (this.messageInput);
        const message = messageInputElement.value.trim();
        
        // 如果消息为空，不处理
        if (!message) return;
        
        // 清空输入框
        messageInputElement.value = '';
        this.messageInput.style.height = 'auto';
        
        // 禁用输入框和发送按钮，显示停止按钮
        this.isWaitingForResponse = true;
        this.updateSendButtonState();
        
        // 如果有欢迎消息，先清空
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            this.chatMessages.innerHTML = '';
        }
        
        // 添加用户消息到界面
        this.addUserMessage(message);
        
        // 添加用户消息到对话
        this.conversationManager.addMessage('user', message);
        
        // 获取当前选择的模型
        const model = this.currentModel || 'gpt-4o-mini';
        
        // 是否使用流式响应
        const useStream = this.settingsManager.get('streamEnabled');
        
        // 调用 OpenAI API
        if (useStream) {
            let messageId = null;
            let assistantMessageContent = '';
            
            this.apiService.sendMessageStream(
                model,
                // 开始回调
                () => {
                    const result = this.addAssistantMessage('', true);
                    messageId = result.id;
                },
                // 每次接收到新的标记
                (token, fullText) => {
                    assistantMessageContent = fullText; // 保存最终内容
                    this.updateStreamMessage(messageId, fullText);
                },
                // 错误回调
                (error) => {
                    if (messageId) {
                        document.querySelector(`#${messageId} .cursor-blink`)?.remove();
                    } else {
                        this.addAssistantMessage(error);
                    }
                    this.isWaitingForResponse = false;
                    this.updateSendButtonState();
                },
                // 完成回调
                () => {
                    if (messageId) {
                        document.querySelector(`#${messageId} .cursor-blink`)?.remove();
                        
                        // 高亮代码
                        this.ChatMessageComponent.applyCodeHighlighting(messageId);
                        
                        // 消息生成完毕后，将HTML代码块转换为预览模式
                        this.convertHtmlToPreview();
                        
                        // 更新消息元素的数据，便于后续编辑
                        const messageElement = document.getElementById(messageId);
                        if (messageElement instanceof HTMLElement) {
                            messageElement.dataset.content = assistantMessageContent;
                            
                            // 更新索引
                            const currentConversation = this.conversationManager.getCurrentConversation();
                            if (currentConversation && currentConversation.messages) {
                                messageElement.dataset.index = (currentConversation.messages.length - 1).toString();
                            }
                        }
                        
                        // 仅当有完整消息时才保存到历史记录
                        if (assistantMessageContent) {
                            // 保存完整的响应到对话历史
                            this.conversationManager.addMessage('assistant', assistantMessageContent);
                            this.renderConversationList();
                            
                            // 获取实际的token用量
                            this.apiService.getLastTokenUsage()
                                .then(tokenInfo => {
                                    if (tokenInfo && tokenInfo.total > 0) {
                                        // 更新token显示
                                        const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
                                        if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
                                            tokenCountElement.textContent = `${tokenInfo.total} tokens`;
                                            tokenCountElement.title = `提示: ${tokenInfo.prompt} | 完成: ${tokenInfo.completion}`;
                                        }
                                    }
                                })
                                .catch(err => console.error('获取token信息失败:', err));
                        }
                        
                        // 重新绑定消息事件
                        this.bindMessageEvents();
                    }
                    
                    this.isWaitingForResponse = false;
                    this.updateSendButtonState();
                }
            );
        } else {
            this.apiService.sendMessage(
                model,
                // 开始回调
                () => {},
                // 成功回调
                (response) => {
                    const result = this.addAssistantMessage(response);
                    
                    // 高亮代码
                    setTimeout(() => {
                        this.ChatMessageComponent.applyCodeHighlighting(result.id);
                    }, 100);
                    
                    // 保存响应到对话历史
                    this.conversationManager.addMessage('assistant', response);
                    this.renderConversationList();
                    
                    // 重新绑定消息事件
                    this.bindMessageEvents();
                },
                // 错误回调
                (error) => {
                    this.addAssistantMessage(error);
                },
                // 完成回调
                () => {
                    this.isWaitingForResponse = false;
                    this.updateSendButtonState();
                }
            );
        }
    }
    
    // 更新发送按钮状态
    updateSendButtonState() {
        if (this.isWaitingForResponse) {
            // 禁用发送按钮
            this.sendButton.classList.add('opacity-50', 'cursor-not-allowed');
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';
            
            // 禁用输入框
            const messageInputElement = /** @type {HTMLTextAreaElement} */ (this.messageInput);
            messageInputElement.disabled = true;
            messageInputElement.placeholder = "AI 正在回复中...";
            
            // 显示停止按钮
            this.stopButton.classList.remove('hidden');
            this.stopButton.classList.add('show');
        } else {
            // 启用发送按钮
            this.sendButton.classList.remove('opacity-50', 'cursor-not-allowed');
            this.sendButton.innerHTML = '<i class="fas fa-paper-plane text-sm"></i>';
            
            // 启用输入框
            const messageInputElement = /** @type {HTMLTextAreaElement} */ (this.messageInput);
            messageInputElement.disabled = false;
            messageInputElement.placeholder = "发送消息...";
            
            // 隐藏停止按钮
            this.stopButton.classList.add('hidden');
            this.stopButton.classList.remove('show');
        }
    }
    
    // 添加用户消息到聊天界面
    addUserMessage(message, scroll = true) {
        const messageElement = this.ChatMessageComponent.createUserMessage(message);
        this.chatMessages.appendChild(messageElement);
        if (scroll) this.scrollToBottom();
        return messageElement;
    }
    
    // 添加助手消息到聊天界面
    addAssistantMessage(message = '', isStream = false) {
        const result = this.ChatMessageComponent.createAssistantMessage(message, null, isStream);
        this.chatMessages.appendChild(result.element);
        this.scrollToBottom();
        return result;
    }
    
    // 更新流式消息内容
    updateStreamMessage(messageId, content) {
        const contentElement = document.getElementById(`content-${messageId}`);
        if (contentElement) {
            // 使用Markdown格式化器将内容格式化为HTML
            const formatter = this.ChatMessageComponent.formatter;
            const formattedContent = formatter.formatMessage(content);
            
            // 更新内容
            contentElement.innerHTML = formattedContent;
            
            // 确保光标在最后
            const cursorElement = document.createElement('span');
            cursorElement.className = 'cursor-blink';
            contentElement.appendChild(cursorElement);
            
            // 为新内容中的代码块添加交互按钮和高亮
            formatter.addCodeInteractionButtons();
            this.ChatMessageComponent.applyCodeHighlightingToElement(contentElement);
            
            // 仅在初始化时应用HTML预览框架，但在AI回复中不启用自动预览
            try {
                const htmlPreview = window["htmlPreview"];
                if (htmlPreview) {
                    // 确保设置为非自动预览模式（回复过程中不显示预览）
                    if (typeof htmlPreview.setAutoPreview === 'function') {
                        htmlPreview.setAutoPreview(false);
                    }
                    
                    // 第一次处理时添加预览容器和按钮（但在回复中显示源代码而非预览）
                    if (!ChatUI.didInitPreview) {
                        if (typeof htmlPreview.addPreviewButtonsToHtmlBlocks === 'function') {
                            // 初始化但不强制启用预览
                            htmlPreview.addPreviewButtonsToHtmlBlocks(false);
                            ChatUI.didInitPreview = true;
                        }
                    }
                }
            } catch (e) {
                console.error('应用HTML预览失败:', e);
            }
            
            // 临时更新Token计数（最终会从API获取实际数值）
            const tokenCountElement = document.querySelector(`#${messageId} .token-count`);
            if (tokenCountElement && tokenCountElement instanceof HTMLElement) {
                const estimatedTokens = this.ChatMessageComponent.estimateTokenCount(content);
                tokenCountElement.textContent = `${estimatedTokens} tokens`;
                tokenCountElement.title = "估计的Token数量（将在完成后更新）";
            }
            
            this.scrollToBottom();
        }
    }
    
    // 滚动到底部
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    // 在消息生成完成后，将HTML代码块转换为预览模式
    convertHtmlToPreview() {
        try {
            const htmlPreview = window["htmlPreview"];
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
        } catch (e) {
            console.error('自动转换HTML预览失败:', e);
        }
    }
    
    // 清空聊天记录
    clearChat() {
        // 取消正在进行的流式请求
        this.apiService.cancelCurrentStream();
        
        // 清空聊天区域
        this.chatMessages.innerHTML = '';
        
        // 添加欢迎消息
        this.chatMessages.appendChild(
            this.ChatMessageComponent.createWelcomeMessage()
        );
        
        // 清空当前对话的消息
        this.conversationManager.clearMessages();
        
        // 重新渲染对话列表
        this.renderConversationList();
        
        // 重置状态
        this.isWaitingForResponse = false;
        this.updateSendButtonState();
    }
    
    // 添加导出按钮
    addExportButton() {
        const header = document.querySelector('header');
        if (!header) return;
        
        // 检查是否已存在导出按钮
        if (document.getElementById('exportBtn')) return;
        
        // 创建导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.id = 'exportBtn';
        exportBtn.className = 'h-8 w-8 flex items-center justify-center rounded-md hover:bg-openai-hover transition-all text-openai-gray mr-2';
        exportBtn.title = '导出对话';
        exportBtn.innerHTML = '<i class="fas fa-download text-sm"></i>';
        
        // 创建下拉菜单
        const dropdown = document.createElement('div');
        dropdown.className = 'export-dropdown absolute hidden mt-2 w-40 bg-white shadow-lg rounded-md border border-openai-border z-50';
        dropdown.innerHTML = `
            <ul class="py-1">
                <li>
                    <button id="exportMd" class="px-4 py-2 text-sm text-openai-text hover:bg-openai-hover w-full text-left">
                        导出为 Markdown
                    </button>
                </li>
                <li>
                    <button id="exportPdf" class="px-4 py-2 text-sm text-openai-text hover:bg-openai-hover w-full text-left">
                        导出为 PDF
                    </button>
                </li>
            </ul>
        `;
        
        // 创建包装容器以便定位下拉菜单
        const container = document.createElement('div');
        container.className = 'relative';
        container.appendChild(exportBtn);
        container.appendChild(dropdown);
        
        // 在设置按钮前插入导出按钮
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn && settingsBtn.parentNode) {
            settingsBtn.parentNode.insertBefore(container, settingsBtn);
        } else {
            // 如果找不到设置按钮，则添加到头部工具栏
            const toolbarRight = header.querySelector('.flex.items-center.gap-2');
            if (toolbarRight) {
                toolbarRight.insertBefore(container, toolbarRight.firstChild);
            }
        }
        
        // 点击导出按钮显示下拉菜单
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        
        // 点击文档任何地方关闭下拉菜单
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });
        
        // 导出为Markdown
        const exportMd = document.getElementById('exportMd');
        if (exportMd) {
            exportMd.addEventListener('click', () => {
                this.exportChat('markdown');
                dropdown.classList.add('hidden');
            });
        }
        
        // 导出为PDF
        const exportPdf = document.getElementById('exportPdf');
        if (exportPdf) {
            exportPdf.addEventListener('click', () => {
                this.exportChat('pdf');
                dropdown.classList.add('hidden');
            });
        }
    }
    
    // 导出对话
    exportChat(format) {
        const conversation = this.conversationManager.getCurrentConversation();
        if (!conversation || !conversation.messages || conversation.messages.length === 0) {
            // @ts-ignore
            window.toast.info('当前对话为空，无法导出');
            return;
        }
        
        const title = conversation.title || '对话记录';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `${title}-${timestamp}`;
        
        if (format === 'markdown') {
            // 导出为Markdown
            let markdown = `# ${title}\n\n`;
            markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
            
            conversation.messages.forEach(msg => {
                const role = msg.role === 'user' ? '🧑 用户' : '🤖 助手';
                markdown += `## ${role}\n\n${msg.content}\n\n`;
            });
            
            // 创建下载链接
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            this.createDownload(blob, `${filename}.md`);
            
            // @ts-ignore
            window.toast.success('已导出为Markdown格式');
        } else if (format === 'pdf') {
            // @ts-ignore
            window.toast.info('正在生成PDF...');
            
            // 创建临时容器
            const tempContainer = document.createElement('div');
            tempContainer.className = 'pdf-export-container';
            tempContainer.style.padding = '20px';
            tempContainer.style.maxWidth = '800px';
            tempContainer.style.margin = '0 auto';
            tempContainer.style.fontFamily = 'Arial, sans-serif';
            document.body.appendChild(tempContainer);
            
            // 添加标题
            const titleEl = document.createElement('h1');
            titleEl.textContent = title;
            titleEl.style.marginBottom = '10px';
            tempContainer.appendChild(titleEl);
            
            // 添加时间戳
            const timestampEl = document.createElement('p');
            timestampEl.textContent = `导出时间: ${new Date().toLocaleString('zh-CN')}`;
            timestampEl.style.marginBottom = '20px';
            timestampEl.style.color = '#666';
            tempContainer.appendChild(timestampEl);
            
            // 添加内容
            conversation.messages.forEach(msg => {
                // 角色标题
                const roleTitle = document.createElement('h2');
                roleTitle.textContent = msg.role === 'user' ? '🧑 用户' : '🤖 助手';
                roleTitle.style.marginTop = '20px';
                roleTitle.style.marginBottom = '10px';
                roleTitle.style.color = msg.role === 'user' ? '#10a37f' : '#000';
                tempContainer.appendChild(roleTitle);
                
                // 消息内容
                const contentEl = document.createElement('div');
                // 使用marked解析markdown
                // @ts-ignore
                if (typeof marked !== 'undefined') {
                    // @ts-ignore
                    contentEl.innerHTML = marked.parse(msg.content);
                } else {
                    contentEl.innerText = msg.content;
                }
                
                contentEl.style.marginBottom = '20px';
                contentEl.style.lineHeight = '1.6';
                tempContainer.appendChild(contentEl);
            });
            
            // 尝试导入html2pdf库
            this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js')
                .then(() => {
                    // @ts-ignore
                    if (typeof html2pdf !== 'undefined') {
                        const options = {
                            margin: 10,
                            filename: `${filename}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };
                        
                        // @ts-ignore
                        html2pdf().from(tempContainer).set(options).save()
                            .then(() => {
                                document.body.removeChild(tempContainer);
                                // @ts-ignore
                                window.toast.success('已导出为PDF格式');
                            })
                            .catch(err => {
                                console.error('PDF导出失败:', err);
                                document.body.removeChild(tempContainer);
                                // @ts-ignore
                                window.toast.error('PDF导出失败，请稍后重试');
                            });
                    } else {
                        document.body.removeChild(tempContainer);
                        // @ts-ignore
                        window.toast.error('未能加载PDF生成库，请检查网络连接');
                    }
                })
                .catch(err => {
                    console.error('加载html2pdf失败:', err);
                    document.body.removeChild(tempContainer);
                    // @ts-ignore
                    window.toast.error('加载PDF生成库失败，请检查网络连接');
                });
        }
    }
    
    // 创建文件下载
    createDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        // 添加到DOM中并触发下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    // 加载脚本
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}