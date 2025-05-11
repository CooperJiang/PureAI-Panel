/**
 * 侧边栏管理模块 - 负责处理侧边栏、对话列表渲染和移动端适配
 */
export class SidebarManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {HTMLElement} options.sidebar - 侧边栏元素
     * @param {HTMLElement} options.conversationList - 对话列表容器
     * @param {HTMLElement} options.newChatBtn - 新建对话按钮
     * @param {Object} options.conversationManager - 对话管理器
     * @param {Function} options.onSwitchConversation - 切换对话的回调
     * @param {Function} options.onNewChat - 新建对话的回调
     * @param {Function} options.onOpenSettings - 打开设置的回调
     */
    constructor(options) {
        this.sidebar = options.sidebar;
        this.conversationList = options.conversationList;
        this.newChatBtn = options.newChatBtn;
        this.conversationManager = options.conversationManager;
        this.onSwitchConversation = options.onSwitchConversation;
        this.onNewChat = options.onNewChat;
        this.onOpenSettings = options.onOpenSettings;
        
        // 移动端菜单状态
        this.mobileMenuOpen = false;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化侧边栏
     */
    init() {
        // 新增顶部操作区
        const header = document.createElement('div');
        header.id = 'sidebar-header';
        // 新建对话按钮
        this.newChatBtn.className = 'flex items-center justify-center';
        this.newChatBtn.innerHTML = '<span class="btn-text">新对话</span><span class="btn-plus">+</span>';
        header.appendChild(this.newChatBtn);
        // 搜索按钮
        const searchBtn = document.createElement('button');
        searchBtn.id = 'sidebar-search-btn';
        searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        header.appendChild(searchBtn);
        // 搜索输入框
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'sidebar-search-input';
        searchInput.placeholder = '对话历史查找';
        header.appendChild(searchInput);
        // 插入到侧边栏顶部
        if (this.sidebar.firstChild) {
            this.sidebar.insertBefore(header, this.sidebar.firstChild);
        } else {
            this.sidebar.appendChild(header);
        }
        // 搜索按钮点击切换输入框
        searchBtn.addEventListener('click', () => {
            searchBtn.style.display = 'none';
            searchInput.classList.add('active');
            searchInput.style.display = 'block';
            searchInput.focus();
            // 隐藏新对话按钮文字，只保留加号
            const textEl = this.newChatBtn.querySelector('.btn-text');
            if (textEl) textEl.style.display = 'none';
            this.newChatBtn.classList.add('compact-mode');
        });
        // 输入框失焦还原
        searchInput.addEventListener('blur', () => {
            searchInput.classList.remove('active');
            searchInput.style.display = 'none';
            searchBtn.style.display = 'flex';
            searchInput.value = '';
            this.renderConversationList(); // 还原全部
            // 恢复新对话按钮文字
            const textEl = this.newChatBtn.querySelector('.btn-text');
            if (textEl) textEl.style.display = '';
            this.newChatBtn.classList.remove('compact-mode');
        });
        // 回车时失焦
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchInput.blur();
        });
        // 搜索功能
        searchInput.addEventListener('input', () => {
            this.renderConversationList(searchInput.value.trim());
        });
        
        // 添加移动设备菜单按钮
        this.addMobileMenuButton();
        
        // 渲染对话列表
        this.renderConversationList();

        // 新建对话按钮点击事件重新绑定
        this.newChatBtn.onclick = () => {
            if (window.chatUI && window.chatUI.isGenerating) {
                if (window.toast) {
                    window.toast.warning('请等待当前回复生成完成再创建新对话');
                }
                return;
            }
            if (this.onNewChat && typeof this.onNewChat === 'function') {
                this.onNewChat();
            }
        };
    }
    
    /**
     * 添加移动设备菜单按钮
     */
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
    
    /**
     * 添加侧边栏遮罩层
     */
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
    
    /**
     * 切换移动菜单
     * @param {boolean} forceState - 强制设置状态
     */
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
    
    /**
     * 渲染对话列表
     */
    renderConversationList(keyword = '') {
        if (!this.conversationList) return;
        this.conversationList.innerHTML = '';
        let conversations = this.conversationManager.getAllConversations();
        if (keyword) {
            const kw = keyword.toLowerCase();
            conversations = conversations.filter(c => c.title.toLowerCase().includes(kw));
        }
        
        // 获取当前对话ID
        const currentConversation = this.conversationManager.getCurrentConversation();
        const currentConversationId = currentConversation ? currentConversation.id : null;
        
        // 添加所有对话到列表
        conversations.forEach(conversation => {
            const conversationItem = document.createElement('div');
            conversationItem.className = `flex items-center justify-between p-2 rounded-md hover:bg-openai-hover cursor-pointer group ${
                conversation.id === currentConversationId ? 'active' : ''
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
            contentDiv.className = 'flex-1 truncate pr-2';
            
            // 标题行 - 包含置顶图标和标题文本
            const titleRow = document.createElement('div');
            titleRow.className = 'flex items-center';
            
            // 置顶图标
            if (conversation.isPinned) {
                const pinnedIcon = document.createElement('span');
                pinnedIcon.className = 'mr-1 text-gray-500';
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
            actionsDiv.className = 'flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200';
            
            // 编辑按钮
            const editButton = document.createElement('button');
            editButton.className = 'p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500';
            editButton.title = 'API设置';
            editButton.innerHTML = '<i class="fas fa-cog text-xs"></i>';
            
            // 置顶切换按钮
            const pinButton = document.createElement('button');
            pinButton.className = 'p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500';
            pinButton.title = conversation.isPinned ? '取消置顶' : '置顶对话';
            pinButton.innerHTML = `<i class="fas fa-thumbtack text-xs ${conversation.isPinned ? '' : 'fa-rotate-90'}"></i>`;
            
            // 删除按钮
            const deleteButton = document.createElement('button');
            deleteButton.className = 'p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500';
            deleteButton.title = '删除对话';
            deleteButton.innerHTML = '<i class="fas fa-trash-alt text-xs"></i>';
            
            // 添加按钮到操作区
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(pinButton);
            actionsDiv.appendChild(deleteButton);
            
            // 将左侧内容和右侧操作区添加到对话项目
            conversationItem.appendChild(contentDiv);
            conversationItem.appendChild(actionsDiv);
            
            this.conversationList.appendChild(conversationItem);
            
            // 绑定事件 - 点击对话项目
            contentDiv.addEventListener('click', () => {
                // 检查是否有全局的ChatUI实例并且正在生成
                if (window.chatUI && window.chatUI.isGenerating) {
                    if (window.toast) {
                        window.toast.warning('请等待当前回复生成完成再切换对话');
                    }
                    return;
                }
                
                if (this.onSwitchConversation && typeof this.onSwitchConversation === 'function') {
                    this.onSwitchConversation(conversation.id);
                    
                    // 关闭移动端菜单
                    this.toggleMobileMenu(false);
                }
            });
            
            // 绑定置顶事件
            pinButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发对话切换
                
                // 检查是否有全局的ChatUI实例并且正在生成
                if (window.chatUI && window.chatUI.isGenerating) {
                    if (window.toast) {
                        window.toast.warning('请等待当前回复生成完成再修改对话状态');
                    }
                    return;
                }
                
                this.conversationManager.togglePinStatus(conversation.id);
                this.renderConversationList();
                
                // 显示提示
                const toast = window['toast'];
                if (toast) {
                    toast.info(conversation.isPinned ? '已取消置顶' : '已置顶对话');
                }
            });
            
            // 绑定删除事件
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发对话切换
                
                // 检查是否有全局的ChatUI实例并且正在生成
                if (window.chatUI && window.chatUI.isGenerating) {
                    if (window.toast) {
                        window.toast.warning('请等待当前回复生成完成再删除对话');
                    }
                    return;
                }
                
                // 删除对话
                const isDeleted = this.conversationManager.deleteConversation(conversation.id);
                
                if (isDeleted) {
                    // 获取当前会话列表
                    const conversations = this.conversationManager.getAllConversations();
                    
                    // 如果删除的是当前对话
                    if (conversation.id === currentConversationId) {
                        if (conversations.length > 0) {
                            // 有其他对话，切换到第一个对话
                            if (this.onSwitchConversation) {
                                this.onSwitchConversation(conversations[0].id);
                            }
                        } else {
                            // 没有其他对话，创建新对话
                            if (this.onNewChat) {
                                this.onNewChat();
                            }
                        }
                    } else {
                        // 不是当前对话，只需重新渲染列表
                        this.renderConversationList();
                    }
                    
                    // 显示提示
                    const toast = window['toast'];
                    if (toast) {
                        toast.success('对话已删除');
                    }
                } else {
                    // 删除失败
                    const toast = window['toast'];
                    if (toast) {
                        toast.error('删除对话失败');
                    }
                }
            });

            // 绑定编辑按钮事件
            editButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发对话切换
                
                // 检查是否有全局的ChatUI实例并且正在生成
                if (window.chatUI && window.chatUI.isGenerating) {
                    if (window.toast) {
                        window.toast.warning('请等待当前回复生成完成再修改设置');
                    }
                    return;
                }
                
                // 先切换到被点击的对话
                if (this.onSwitchConversation && typeof this.onSwitchConversation === 'function') {
                    this.onSwitchConversation(conversation.id);
                }
                
                // 然后打开设置模态框
                if (this.onOpenSettings && typeof this.onOpenSettings === 'function') {
                    this.onOpenSettings();
                }
            });
        });
        
        // 如果没有对话，显示空状态
        if (conversations.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'text-center p-4 text-openai-gray text-sm';
            emptyState.innerHTML = `
                <i class="fas fa-comment-slash mb-2 text-lg"></i>
                <p>没有对话历史</p>
                <p class="text-xs mt-1">点击"新建对话"开始</p>
            `;
            this.conversationList.appendChild(emptyState);
        }
    }
} 