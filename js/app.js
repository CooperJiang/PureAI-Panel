/**
 * PureAI Panel 应用入口文件
 */
import { ChatUI } from './ui/ChatUI.js';
import { ConversationManager } from './conversation.js';
import { ApiClient } from './api.js';
import { SettingsManager } from './settings.js';

// 当DOM加载完毕初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化设置管理器
    const settingsManager = new SettingsManager();
    
    // 初始化API客户端
    const apiClient = new ApiClient({
        settingsManager: settingsManager
    });
    
    // 初始化对话管理器
    const conversationManager = new ConversationManager();
    
    // 初始化聊天UI
    window.chatUI = new ChatUI({
        conversationManager: conversationManager,
        apiClient: apiClient,
        settingsManager: settingsManager
    });
    
    // 注意：CodeBlockManager现在在ChatUI中创建和初始化
    // 它会自动设置全局对象，这里不需要重复设置
    
    
    // 检查是否需要显示欢迎消息
    const hasShownWelcome = localStorage.getItem('has_shown_welcome');
    if (!hasShownWelcome) {
        showWelcomeMessage();
        localStorage.setItem('has_shown_welcome', 'true');
    }
    
    // 检查深色模式设置
    const darkMode = localStorage.getItem('dark_mode');
    if (darkMode === 'true') {
        document.body.classList.add('dark');
    }
});

/**
 * 显示欢迎消息
 */
function showWelcomeMessage() {
    // 模拟用户消息
    setTimeout(() => {
        window.chatUI.messageHandler.addUserMessage('你好！请问你能做什么？');
        
        // 模拟助手回复
        setTimeout(() => {
            const welcomeMessage = `
👋 欢迎使用 PureAI Panel！

我是您的AI助手，可以帮助您完成各种任务：

- 回答问题和提供信息
- 讨论各种话题
- 帮助编写和修改文本
- 解决问题和提供建议
- 创意写作和头脑风暴

您可以直接在下方输入框中输入您的问题或请求。如果需要任何帮助，请随时告诉我！
`;
            
            const result = window.chatUI.messageHandler.addAssistantMessage(welcomeMessage);
            
            // 添加初始对话到历史记录
            window.chatUI.conversationManager.addMessage('user', '你好！请问你能做什么？');
            window.chatUI.conversationManager.addMessage('assistant', welcomeMessage);
            
            // 设置标题
            const currentConversation = window.chatUI.conversationManager.getCurrentConversation();
            if (currentConversation) {
                currentConversation.title = '欢迎对话';
                window.chatUI.conversationManager.saveConversations();
            }
            
            // 更新对话列表
            window.chatUI.sidebarManager.renderConversationList();
        }, 500);
    }, 500);
} 