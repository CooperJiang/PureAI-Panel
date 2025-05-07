// 对话管理模块

export class ConversationManager {
    constructor() {
        this.conversations = [];
        this.currentConversationId = null;
        this.loadConversations();
    }
    
    // 加载所有保存的对话
    loadConversations() {
        try {
            const savedConversations = localStorage.getItem('conversations');
            if (savedConversations) {
                this.conversations = JSON.parse(savedConversations);
            }
            
            // 如果没有对话，创建一个新的
            if (this.conversations.length === 0) {
                this.createNewConversation();
            } else {
                // 加载最后一个活跃的对话
                const activeConversationId = localStorage.getItem('activeConversation');
                if (activeConversationId && this.getConversationById(activeConversationId)) {
                    this.currentConversationId = activeConversationId;
                } else {
                    // 默认选择第一个对话
                    this.currentConversationId = this.conversations[0].id;
                }
            }
        } catch (error) {
            this.conversations = [];
            this.createNewConversation();
        }
    }
    
    // 保存所有对话到本地存储
    saveConversations() {
        try {
            localStorage.setItem('conversations', JSON.stringify(this.conversations));
            if (this.currentConversationId) {
                localStorage.setItem('activeConversation', this.currentConversationId);
            }
        } catch (error) {
        }
    }
    
    // 创建新对话
    createNewConversation(title = '新对话') {
        const newConversation = {
            id: 'conv-' + Date.now(),
            title: title,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPinned: false, // 添加置顶标记
            // 添加每个对话的独立配置
            config: {
                model: localStorage.getItem('selected_model') || 'gpt-4o-mini',
                temperature: 0.7,
                systemMessage: ''
            }
        };
        
        this.conversations.unshift(newConversation);
        this.currentConversationId = newConversation.id;
        this.saveConversations();
        
        return newConversation;
    }
    
    // 获取当前对话
    getCurrentConversation() {
        if (!this.currentConversationId) {
            return this.createNewConversation();
        }
        
        const conversation = this.getConversationById(this.currentConversationId);
        if (!conversation) {
            return this.createNewConversation();
        }
        
        return conversation;
    }
    
    // 通过ID获取对话
    getConversationById(id) {
        return this.conversations.find(conv => conv.id === id);
    }
    
    // 切换到指定对话
    switchConversation(id) {
        const conversation = this.getConversationById(id);
        if (conversation) {
            this.currentConversationId = id;
            this.saveConversations();
            return conversation;
        }
        return null;
    }
    
    // 删除对话
    deleteConversation(id) {
        const index = this.conversations.findIndex(conv => conv.id === id);
        if (index !== -1) {
            this.conversations.splice(index, 1);
            
            // 如果删除的是当前对话，切换到第一个对话或创建新对话
            if (this.currentConversationId === id) {
                if (this.conversations.length > 0) {
                    this.currentConversationId = this.conversations[0].id;
                } else {
                    this.createNewConversation();
                }
            }
            
            this.saveConversations();
            return true;
        }
        return false;
    }
    
    // 重命名对话
    renameConversation(id, newTitle) {
        const conversation = this.getConversationById(id);
        if (conversation) {
            conversation.title = newTitle;
            conversation.updatedAt = new Date().toISOString();
            this.saveConversations();
            return true;
        }
        return false;
    }
    
    // 向当前对话添加消息
    addMessage(role, content, metadata = '') {
        const conversation = this.getCurrentConversation();
        const message = {
            id: 'msg-' + Date.now(),
            role: role,
            content: content,
            metadata: metadata,
            timestamp: new Date().toISOString()
        };
        
        conversation.messages.push(message);
        conversation.updatedAt = new Date().toISOString();
        
        // 自动更新对话标题（如果是第一条用户消息）
        if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
            // 使用用户的第一条消息作为对话标题（截取前20个字符）
            let title = content.trim().split('\n')[0];
            if (title.length > 20) {
                title = title.substring(0, 20) + '...';
            }
            conversation.title = title;
        }
        
        // 立即保存对话到localStorage，确保每条消息都被保存
        this.saveConversations();
        
        return message;
    }
    
    // 获取当前对话的所有消息
    getMessages() {
        const conversation = this.getCurrentConversation();
        return conversation.messages;
    }
    
    // 编辑指定的消息
    editMessage(messageIndex, newContent) {
        const conversation = this.getCurrentConversation();
        if (conversation && conversation.messages && conversation.messages[messageIndex]) {
            conversation.messages[messageIndex].content = newContent;
            conversation.updatedAt = new Date().toISOString();
            this.saveConversations();
            return true;
        }
        return false;
    }
    
    // 删除指定的消息
    deleteMessage(messageIndex) {
        const conversation = this.getCurrentConversation();
        if (conversation && conversation.messages && conversation.messages[messageIndex]) {
            // 删除该消息
            conversation.messages.splice(messageIndex, 1);
            conversation.updatedAt = new Date().toISOString();
            this.saveConversations();
            return true;
        }
        return false;
    }
    
    // 清空当前对话的消息
    clearMessages() {
        const conversation = this.getCurrentConversation();
        conversation.messages = [];
        conversation.updatedAt = new Date().toISOString();
        this.saveConversations();
    }
    
    /**
     * 添加一对用户和助手消息到对话
     * @param {string} userMessage - 用户消息内容
     * @param {string} assistantMessage - 助手消息内容
     * @returns {Array} 添加的消息对象数组
     */
    addMessagePair(userMessage, assistantMessage) {
        const conversation = this.getCurrentConversation();
        
        // 添加用户消息
        const userMsgObj = {
            id: 'msg-' + Date.now(),
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };
        conversation.messages.push(userMsgObj);
        
        // 添加助手消息
        const assistantMsgObj = {
            id: 'msg-' + (Date.now() + 1),
            role: 'assistant',
            content: assistantMessage,
            timestamp: new Date().toISOString()
        };
        conversation.messages.push(assistantMsgObj);
        
        // 更新对话时间戳
        conversation.updatedAt = new Date().toISOString();
        
        // 自动更新对话标题（如果是第一条用户消息）
        if (conversation.messages.filter(m => m.role === 'user').length === 1) {
            // 使用用户的第一条消息作为对话标题（截取前20个字符）
            let title = userMessage.trim().split('\n')[0];
            if (title.length > 20) {
                title = title.substring(0, 20) + '...';
            }
            conversation.title = title;
        }
        
        this.saveConversations();
        return [userMsgObj, assistantMsgObj];
    }
    
    /**
     * 更新消息对（用户消息和助手回复）
     * @param {number} userIndex - 用户消息索引
     * @param {number} assistantIndex - 助手消息索引
     * @param {string} userContent - 用户消息新内容
     * @param {string} assistantContent - 助手消息新内容
     * @returns {boolean} 更新是否成功
     */
    updateMessagePair(userIndex, assistantIndex, userContent, assistantContent) {
        const conversation = this.getCurrentConversation();
        
        if (!conversation || !conversation.messages) return false;
        
        // 验证索引有效性
        if (userIndex < 0 || userIndex >= conversation.messages.length ||
            assistantIndex < 0 || assistantIndex >= conversation.messages.length) {
            return false;
        }
        
        // 验证消息角色
        if (conversation.messages[userIndex].role !== 'user' ||
            conversation.messages[assistantIndex].role !== 'assistant') {
            return false;
        }
        
        // 更新消息内容
        conversation.messages[userIndex].content = userContent;
        conversation.messages[assistantIndex].content = assistantContent;
        
        // 更新时间戳
        conversation.updatedAt = new Date().toISOString();
        conversation.messages[userIndex].timestamp = new Date().toISOString();
        conversation.messages[assistantIndex].timestamp = new Date().toISOString();
        
        this.saveConversations();
        return true;
    }
    
    // 获取所有对话（用于显示在侧边栏）
    getAllConversations() {
        // 先按置顶状态排序，再按更新时间排序
        return [...this.conversations].sort((a, b) => {
            // 如果一个是置顶的而另一个不是，置顶的排在前面
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            
            // 如果置顶状态相同，按更新时间从新到旧排序
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }
    
    // 渲染对话列表到DOM
    renderConversationList(container, onSelect, onDelete) {
        if (!container) return;
        
        // 清空容器
        container.innerHTML = '';
        
        // 添加所有对话
        this.conversations.forEach(conversation => {
            const conversationItem = document.createElement('div');
            conversationItem.className = `flex items-center justify-between p-2 rounded-md hover:bg-openai-hover cursor-pointer ${
                conversation.id === this.currentConversationId ? 'bg-openai-hover' : ''
            }`;
            conversationItem.dataset.id = conversation.id;
            
            // 格式化日期
            const date = new Date(conversation.updatedAt);
            const formattedDate = new Intl.DateTimeFormat('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
            
            conversationItem.innerHTML = `
                <div class="flex-1 truncate mr-2">
                    <div class="text-sm font-medium truncate">${conversation.title}</div>
                    <div class="text-xs text-openai-gray truncate">${formattedDate}</div>
                </div>
                <button class="delete-conversation-btn h-6 w-6 flex items-center justify-center rounded-md hover:bg-openai-hover text-openai-gray opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            `;
            
            // 切换对话事件
            conversationItem.addEventListener('click', (e) => {
                // 忽略删除按钮的点击
                if (e.target instanceof Element && e.target.closest('.delete-conversation-btn')) return;
                
                if (typeof onSelect === 'function') {
                    onSelect(conversation.id);
                }
            });
            
            // 删除对话事件
            const deleteBtn = conversationItem.querySelector('.delete-conversation-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof onDelete === 'function') {
                        onDelete(conversation.id);
                    }
                });
            }
            
            container.appendChild(conversationItem);
        });
    }
    
    // 切换对话的置顶状态
    togglePinStatus(id) {
        const conversation = this.getConversationById(id);
        if (conversation) {
            conversation.isPinned = !conversation.isPinned;
            this.saveConversations();
            return conversation.isPinned;
        }
        return false;
    }
    
    // 获取对话的置顶状态
    isPinned(id) {
        const conversation = this.getConversationById(id);
        return conversation ? conversation.isPinned : false;
    }
} 