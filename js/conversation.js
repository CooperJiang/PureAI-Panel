// 对话管理模块

export class ConversationManager {
    constructor() {
        this.conversations = [];
        this.currentConversationId = null;
        this.loadConversations();
    }
    
    /**
     * 设置对话上下文断点
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @returns {boolean} - 是否成功设置断点
     */
    setContextBreakpoint(conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (!conversation || !conversation.messages || conversation.messages.length === 0) {
            return false;
        }
        
        // 初始化断点数组（如果不存在）
        if (!Array.isArray(conversation.breakpoints)) {
            conversation.breakpoints = [];
        }
        
        // 找到最后一条消息
        const lastMessageIndex = conversation.messages.length - 1;
        const lastMessage = conversation.messages[lastMessageIndex];
        
        
        // 确保最后一条消息是助手消息，这样断点会在一组对话(用户+助手)之后
        if (lastMessage && lastMessage.role !== 'assistant') {
            // 如果最后一条不是助手消息，寻找最后一个助手消息的位置
            let lastAssistantIndex = -1;
            for (let i = lastMessageIndex; i >= 0; i--) {
                if (conversation.messages[i] && conversation.messages[i].role === 'assistant') {
                    lastAssistantIndex = i;
                    break;
                }
            }
            
            
            // 如果找到了助手消息，则在其后设置断点
            if (lastAssistantIndex >= 0) {
                const breakpointIndex = lastAssistantIndex + 1;
                
                // 避免重复添加相同位置的断点
                if (!conversation.breakpoints.includes(breakpointIndex)) {
                    conversation.breakpoints.push(breakpointIndex);
                    
                    // 按照索引顺序排序
                    conversation.breakpoints.sort((a, b) => a - b);
                    
                    // 添加一个断点标记消息到消息数组中
                    this.addBreakpointMessage(conversationId, breakpointIndex);
                    this.saveConversations();
                    return true;
                } 
            }
            return false;
        } else {
            // 最后一条是助手消息，直接在其后添加断点
            const breakpointIndex = lastMessageIndex + 1;
            
            // 避免重复添加相同位置的断点
            if (!conversation.breakpoints.includes(breakpointIndex)) {
                conversation.breakpoints.push(breakpointIndex);
                
                // 按照索引顺序排序
                conversation.breakpoints.sort((a, b) => a - b);
                
                // 添加一个断点标记消息到消息数组中
                this.addBreakpointMessage(conversationId, breakpointIndex);
                this.saveConversations();
                return true;
            } 
        }
        
        return false;
    }
    
    /**
     * 添加一个断点标记消息到消息数组
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @param {number} position - 断点位置，不提供则添加到消息末尾
     * @returns {Object} 添加的断点消息对象
     */
    addBreakpointMessage(conversationId = null, position = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (conversation) {
            // 创建断点标记消息
            const breakpointMessage = {
                id: 'breakpoint-' + Date.now(),
                type: 'breakpoint',
                timestamp: new Date().toISOString()
            };
            
            // 添加到消息数组的指定位置或末尾
            if (position !== null && position >= 0 && position <= conversation.messages.length) {
                conversation.messages.splice(position, 0, breakpointMessage);
                
                // 更新大于此位置的断点索引
                conversation.breakpoints = conversation.breakpoints.map(bp => {
                    if (bp >= position && bp !== position) return bp + 1;
                    return bp;
                });
            } else {
                // 添加到末尾
                conversation.messages.push(breakpointMessage);
            }
            
            conversation.updatedAt = new Date().toISOString();
            this.saveConversations();
            return breakpointMessage;
        }
        
        return null;
    }
    
    /**
     * 获取最近的一个断点之后的消息，确保第一条始终是用户消息
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @returns {Array} - 断点之后的消息数组，确保首条是用户消息
     */
    getMessagesAfterBreakpoint(conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (!conversation) return [];
        
        
        // 如果没有断点或断点数组为空，返回所有消息
        if (!Array.isArray(conversation.breakpoints) || conversation.breakpoints.length === 0) {
            return this._ensureValidMessageSequence(
                conversation.messages.filter(msg => msg && msg.type !== 'breakpoint')
            );
        }
        
        // 获取最近的断点索引值 - 这是消息数组中的位置
        const breakpoints = conversation.breakpoints || [];
        if (breakpoints.length === 0) {
            return this._ensureValidMessageSequence(
                conversation.messages.filter(msg => msg && msg.type !== 'breakpoint')
            );
        }
        
        // 获取最大断点值 - 这是消息的索引位置
        const latestBreakpoint = Math.max(...breakpoints);
        
        // 检查断点值是否有效 - 如果大于等于消息数量，那么没有断点后的消息
        if (latestBreakpoint >= conversation.messages.length) {
            // 找最后一条用户消息作为上下文
            const lastUserMessage = this._findLastUserMessage(conversation.messages);
            return lastUserMessage ? [lastUserMessage] : [];
        }
        
        // 从断点位置开始获取消息 - 断点位置表示该位置的消息不包括在上下文中
        // 所以我们从断点位置开始获取后续所有消息
        let messages = [];
        if (Array.isArray(conversation.messages) && latestBreakpoint < conversation.messages.length) {
            // 从断点位置开始获取所有消息
            messages = conversation.messages.slice(latestBreakpoint).filter(msg => 
                msg && msg.type !== 'breakpoint'
            );
        }
        
        // 确保消息序列有效（首条必须是用户消息）
        let validMessages = this._ensureValidMessageSequence(messages);
        
        // 如果断点后没有有效的消息，找到最后一条用户消息
        if (!validMessages || validMessages.length === 0) {
            const lastUserMessage = this._findLastUserMessage(conversation.messages);
            return lastUserMessage ? [lastUserMessage] : [];
        }
        
        return validMessages;
    }
    
    /**
     * 查找消息数组中的最后一条用户消息
     * @private
     * @param {Array} messages - 消息数组
     * @returns {Object|null} - 找到的用户消息或null
     */
    _findLastUserMessage(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return null;
        }
        
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg && msg.role === 'user' && msg.content && !msg.type) {
                return msg;
            }
        }
        
        return null;
    }
    
    /**
     * 确保消息序列有效（第一条必须是用户消息）
     * @private
     * @param {Array} messages - 消息数组
     * @returns {Array} - 处理后的有效消息数组
     */
    _ensureValidMessageSequence(messages) {
        // 确保messages是数组且不为空
        if (!Array.isArray(messages) || messages.length === 0) {
            return [];
        }
        
        // 确保第一条消息存在并且有role属性
        if (!messages[0] || !messages[0].role) {
            return [];
        }
        
        // 如果第一条不是用户消息，找到第一条用户消息
        if (messages[0].role !== 'user') {
            // 确保只查找有效的消息
            const firstUserMsgIndex = messages.findIndex(msg => msg && msg.role === 'user');
            
            // 如果找到了用户消息，从那里开始切片
            if (firstUserMsgIndex > 0) {
                return messages.slice(firstUserMsgIndex);
            }
            
            // 如果没有用户消息，返回空数组
            return [];
        }
        
        return messages;
    }
    
    /**
     * 获取对话的所有断点位置信息
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @returns {Array} - 断点索引数组
     */
    getBreakpoints(conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (!conversation) return [];
        
        // 确保返回数组
        return Array.isArray(conversation.breakpoints) ? conversation.breakpoints : [];
    }
    
    /**
     * 获取对话的所有消息
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @returns {Array} - 所有消息数组
     */
    getAllMessages(conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (!conversation) return [];
        
        return conversation.messages;
    }
    
    /**
     * 清除对话的所有断点
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     */
    clearBreakpoints(conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (conversation) {
            conversation.breakpoints = [];
            this.saveConversations();
        }
    }
    
    // 加载所有保存的对话
    loadConversations() {
        try {
            const savedConversations = localStorage.getItem('conversations');
            if (savedConversations) {
                this.conversations = JSON.parse(savedConversations);
                
                // 为旧数据添加scrollPosition字段
                this.conversations.forEach(conversation => {
                    if (typeof conversation.scrollPosition === 'undefined') {
                        conversation.scrollPosition = 0;
                    }
                });
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
            breakpoints: [],  // 初始化为空数组
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPinned: false, // 添加置顶标记
            scrollPosition: 0, // 添加滚动位置记录
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
        
        // 自动更新对话标题（如果是第一条用户消息且当前标题是默认标题）
        if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1 && conversation.title === '新对话') {
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
        // 同时清空消息和断点信息
        conversation.messages = [];
        conversation.breakpoints = []; // 确保断点信息也被清除
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
        
        // 自动更新对话标题（如果是第一条用户消息且当前标题是默认标题）
        if (conversation.messages.filter(m => m.role === 'user').length === 1 && conversation.title === '新对话') {
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
    
    // 保存当前对话
    saveCurrentConversation() {
        try {
            // 保存所有对话
            this.saveConversations();
            return true;
        } catch (error) {
            console.error('保存当前对话失败:', error);
            return false;
        }
    }
    
    /**
     * 删除指定索引的断点
     * @param {number} breakpointIndex - 要删除的断点索引位置
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @returns {boolean} - 是否成功删除
     */
    removeBreakpoint(breakpointIndex, conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (!conversation) return false;
        
        // 确保断点数组存在
        if (!Array.isArray(conversation.breakpoints)) {
            return false;
        }
        
        // 确保breakpointIndex是数字
        const index = parseInt(breakpointIndex, 10);
        if (isNaN(index)) {
            return false;
        }
        
        
        // 直接在断点数组中查找该值
        const indexInArray = conversation.breakpoints.indexOf(index);
        if (indexInArray !== -1) {
            // 从断点数组中删除
            conversation.breakpoints.splice(indexInArray, 1);
            
            // 查找并删除断点标记消息
            for (let i = 0; i < conversation.messages.length; i++) {
                const msg = conversation.messages[i];
                if (msg && msg.type === 'breakpoint' && i === index) {
                    // 移除断点消息
                    conversation.messages.splice(i, 1);
                    
                    // 更新所有大于此索引的断点值
                    conversation.breakpoints = conversation.breakpoints.map(bp => {
                        if (bp > index) return bp - 1;
                        return bp;
                    });
                    
                    break;
                }
            }
            
            // 保存更改
            this.saveConversations();
            return true;
        }
        
        
        // 尝试作为消息索引查找
        for (let i = 0; i < conversation.messages.length; i++) {
            const msg = conversation.messages[i];
            if (msg && msg.type === 'breakpoint' && msg.id && msg.id.includes(index)) {
                // 查找该位置是否在断点数组中
                const bpIndex = conversation.breakpoints.indexOf(i);
                if (bpIndex !== -1) {
                    // 从断点数组中删除
                    conversation.breakpoints.splice(bpIndex, 1);
                    
                    // 从消息数组中删除
                    conversation.messages.splice(i, 1);
                    
                    // 更新更大索引的断点
                    conversation.breakpoints = conversation.breakpoints.map(bp => {
                        if (bp > i) return bp - 1;
                        return bp;
                    });
                    
                    // 保存更改
                    this.saveConversations();
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 保存当前对话的滚动位置
     * @param {number} scrollPosition - 滚动位置
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     */
    saveScrollPosition(scrollPosition, conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (conversation && typeof scrollPosition === 'number') {
            conversation.scrollPosition = scrollPosition;
            this.saveConversations();
        }
    }
    
    /**
     * 获取对话的滚动位置
     * @param {string} conversationId - 对话ID，不提供则使用当前对话
     * @returns {number} - 滚动位置，默认为0
     */
    getScrollPosition(conversationId = null) {
        const conversation = conversationId ? 
            this.getConversationById(conversationId) : 
            this.getCurrentConversation();
            
        if (conversation && typeof conversation.scrollPosition === 'number') {
            return conversation.scrollPosition;
        }
        
        return 0; // 默认滚动位置为0（顶部）
    }
} 