/**
 * 模态框管理模块 - 负责处理所有弹窗和模态框功能
 */
import { SettingsModalComponent } from '../../components/SettingsModal.js';

export class ModalManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.settingsManager - 设置管理器
     * @param {Object} options.chatComponent - 聊天消息组件
     * @param {Object} options.conversationManager - 对话管理器
     * @param {Object} options.modelManager - 模型管理器
     * @param {Function} options.onEditMessage - 编辑消息回调
     * @param {Function} options.onSaveSettings - 保存设置回调
     */
    constructor(options) {
        this.settingsManager = options.settingsManager;
        this.chatComponent = options.chatComponent;
        this.conversationManager = options.conversationManager;
        this.modelManager = options.modelManager;
        this.onEditMessage = options.onEditMessage;
        this.onSaveSettings = options.onSaveSettings;
        this.currentModal = null;
    }
    
    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        // 清除当前模态框
        if (this.currentModal) {
            this.currentModal.close();
            this.currentModal = null;
        }
    }
    
    /**
     * 打开API设置模态框
     */
    openSettingsModal() {
        try {
            // 确保旧的模态框被移除
            this.closeAllModals();
            
            // 创建模态框
            const settingsModal = new SettingsModalComponent(
                this.settingsManager, 
                () => {
                    // 保存设置后回调
                    if (this.onSaveSettings) {
                        this.onSaveSettings();
                    }
                },
                this.conversationManager,  // 添加会话管理器
                this.modelManager  // 添加模型管理器
            );
            
            // 保存引用并打开
            this.currentModal = settingsModal;
            settingsModal.open();
        } catch (error) {
            // 静默处理错误
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
            if (isAiMessage && this.chatComponent && typeof this.chatComponent.estimateTokenCount === 'function') {
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
     * 显示快捷键帮助弹窗
     */
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
} 