// 主应用逻辑
import { ChatUI } from './ui.js';
import { SettingsManager } from './settings.js';
import { ApiService } from './api.js';
import { ConversationManager } from './conversation.js';
import { ChatMessageComponent } from '../components/ChatMessage.js';

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化应用组件
    const settingsManager = new SettingsManager();
    const conversationManager = new ConversationManager();
    const apiService = new ApiService(settingsManager, conversationManager);
    const chatUI = new ChatUI(apiService, settingsManager, ChatMessageComponent, conversationManager);
    
    // 初始化 UI
    chatUI.init();
    
    // 检查必要设置是否已配置
    if (!settingsManager.hasRequiredSettings()) {
        // 如果未设置API密钥，显示设置弹窗
        setTimeout(() => {
            chatUI.openSettingsModal();
        }, 500);
    }
}); 