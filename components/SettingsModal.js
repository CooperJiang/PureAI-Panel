// 设置模态框组件
import { CustomSelect } from './CustomSelect.js';

export class SettingsModalComponent {
    constructor(settingsManager, onSave, conversationManager, modelManager) {
        this.settingsManager = settingsManager;
        this.conversationManager = conversationManager;
        this.modelManager = modelManager;
        this.onSave = onSave;
        this.modalElement = null;
        this.modelSelect = null;  // 模型选择器实例
        this.initModal();
    }
    
    initModal() {
        // 创建模态框元素
        this.modalElement = document.createElement('div');
        this.modalElement.id = 'settingsModal';
        this.modalElement.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300';
        
        // 设置模态框内容
        this.modalElement.innerHTML = `
            <div class="bg-white dark:bg-[#202123] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto transform transition-transform duration-300 scale-95 opacity-0" id="modalContent">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-lg font-semibold text-openai-text dark:text-white flex items-center">
                            <i class="fas fa-cog mr-2 text-openai-gray"></i>
                            API 设置
                        </h3>
                        <button id="closeSettingsBtn" class="text-openai-gray hover:text-openai-text dark:hover:text-white transition-colors">
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
                                    placeholder="例如: https://api.openai.com" 
                                    value="${this.settingsManager.get('baseUrl')}">
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
                                    placeholder="输入你的 API Key"
                                    value="${this.settingsManager.get('apiKey')}">
                                <button id="toggleKeyVisibility" class="absolute inset-y-0 right-0 flex items-center pr-3 text-openai-gray hover:text-openai-text transition-colors">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <p class="text-xs text-openai-gray mt-1">你的API密钥将只会保存在本地浏览器中</p>
                        </div>
                        
                        <div class="flex items-center">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="streamToggle" class="sr-only peer" ${this.settingsManager.get('streamEnabled') ? 'checked' : ''}>
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-openai-green"></div>
                                <span class="ml-3 text-sm font-medium text-openai-text dark:text-white">启用流式响应（打字效果）</span>
                            </label>
                        </div>
                        
                        <div class="flex items-center mt-4">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="contextToggle" class="sr-only peer" ${this.settingsManager.get('contextEnabled') ? 'checked' : ''}>
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-openai-green"></div>
                                <span class="ml-3 text-sm font-medium text-openai-text dark:text-white">启用上下文（带历史对话）</span>
                            </label>
                            <div class="ml-2 group relative">
                                <i class="fas fa-info-circle text-openai-gray"></i>
                                <div class="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 w-48">
                                    关闭此选项可减少发送的上下文，节约token消耗
                                </div>
                            </div>
                        </div>
                        
                        <div class="border-t border-openai-border my-4 pt-4">
                            <h4 class="text-md font-semibold text-openai-text dark:text-white mb-4 flex items-center">
                                <i class="fas fa-sliders-h mr-2 text-openai-gray"></i>
                                当前对话高级设置
                            </h4>
                            
                            <div class="space-y-2 mb-4">
                                <label class="block text-sm font-medium text-openai-gray">
                                    对话标题
                                </label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <i class="fas fa-heading text-openai-gray"></i>
                                    </div>
                                    <input 
                                        type="text" 
                                        id="conversationTitle" 
                                        class="w-full pl-10 pr-4 py-2 border border-openai-border rounded-md focus:outline-none focus:ring-1 focus:ring-openai-green dark:bg-[#343541] dark:text-white" 
                                        placeholder="输入对话标题" 
                                        value="">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="space-y-2">
                                    <label class="block text-sm font-medium text-openai-gray">
                                        对话模型
                                    </label>
                                    <div id="modelSelectContainer"></div>
                                </div>
                                
                                <div class="space-y-2">
                                    <label class="block text-sm font-medium text-openai-gray flex justify-between">
                                        <span>温度 (Temperature)</span>
                                        <span id="temperatureValue" class="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">0.7</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        id="temperature" 
                                        min="0" 
                                        max="2" 
                                        step="0.1" 
                                        value="0.7"
                                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    >
                                    <div class="flex justify-between text-xs text-openai-gray">
                                        <span>精确</span>
                                        <span>平衡</span>
                                        <span>创意</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="space-y-2 mt-4">
                                <label class="block text-sm font-medium text-openai-gray flex justify-between">
                                    <span>系统消息 (System Message)</span>
                                    <span class="text-xs text-openai-gray">引导AI如何回应</span>
                                </label>
                                <textarea 
                                    id="systemMessage" 
                                    class="w-full px-3 py-2 border border-openai-border rounded-md focus:outline-none focus:ring-1 focus:ring-openai-green dark:bg-[#343541] dark:text-white resize-y text-xs font-mono"
                                    placeholder="设置对话的系统指令，告诉AI如何回应..."
                                    rows="5"
                                ></textarea>
                                <p class="text-xs text-openai-gray mt-1">系统消息会添加到对话的开头，但对用户不可见</p>
                            </div>
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
        document.body.appendChild(this.modalElement);
        
        // 绑定事件
        this.bindEvents();
    }
    
    bindEvents() {
        // 关闭按钮
        const closeBtn = this.modalElement.querySelector('#closeSettingsBtn');
        closeBtn.addEventListener('click', () => this.close());
        
        // 点击遮罩层关闭
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });
        
        // 切换密码可见性
        const toggleBtn = this.modalElement.querySelector('#toggleKeyVisibility');
        const apiKeyInput = this.modalElement.querySelector('#apiKey');
        
        toggleBtn.addEventListener('click', () => {
            const icon = toggleBtn.querySelector('i');
            if (apiKeyInput instanceof HTMLInputElement) {
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
        
        // 温度滑块值显示
        const temperatureSlider = this.modalElement.querySelector('#temperature');
        const temperatureValue = this.modalElement.querySelector('#temperatureValue');
        
        if (temperatureSlider && temperatureValue) {
            temperatureSlider.addEventListener('input', () => {
                if (temperatureSlider instanceof HTMLInputElement) {
                    temperatureValue.textContent = temperatureSlider.value;
                }
            });
        }
        
        // 初始化自定义模型选择器
        const modelSelectContainer = this.modalElement.querySelector('#modelSelectContainer');
        if (modelSelectContainer && this.modelManager) {
            // 准备模型选项
            const modelOptions = [];
            
            // 添加内置模型
            this.modelManager.builtInModels.forEach(model => {
                modelOptions.push({
                    id: model.id,
                    name: model.name
                });
            });
            
            // 添加自定义模型
            const customModels = this.modelManager.getCustomModels();
            if (customModels && customModels.length > 0) {
                customModels.forEach(model => {
                    modelOptions.push({
                        id: model.id,
                        name: model.name
                    });
                });
            }
            
            // 获取当前对话的模型ID
            let selectedModelId = '';
            const currentConversation = this.conversationManager.getCurrentConversation();
            if (currentConversation && currentConversation.config && currentConversation.config.model) {
                selectedModelId = currentConversation.config.model;
            }
            
            // 创建自定义选择器
            this.modelSelect = new CustomSelect({
                id: 'conversationModelSelect',
                placeholder: '选择模型',
                options: modelOptions,
                value: selectedModelId,
                container: modelSelectContainer
            });
        }
        
        // 保存设置
        const saveBtn = this.modalElement.querySelector('#saveSettings');
        saveBtn.addEventListener('click', () => {
            const baseUrl = this.modalElement.querySelector('#baseUrl');
            const apiKey = this.modalElement.querySelector('#apiKey');
            const streamToggle = this.modalElement.querySelector('#streamToggle');
            const contextToggle = this.modalElement.querySelector('#contextToggle');
            
            // 高级设置
            const temperature = this.modalElement.querySelector('#temperature');
            const systemMessage = this.modalElement.querySelector('#systemMessage');
            const conversationTitle = this.modalElement.querySelector('#conversationTitle');
            
            if (baseUrl instanceof HTMLInputElement && 
                apiKey instanceof HTMLInputElement && 
                streamToggle instanceof HTMLInputElement &&
                contextToggle instanceof HTMLInputElement) {
                
                // 保存全局设置
                this.settingsManager.set('baseUrl', baseUrl.value);
                this.settingsManager.set('apiKey', apiKey.value);
                this.settingsManager.set('streamEnabled', streamToggle.checked);
                this.settingsManager.set('contextEnabled', contextToggle.checked);
                
                // 保存当前对话的高级设置
                if (this.conversationManager) {
                    const currentConversation = this.conversationManager.getCurrentConversation();
                    if (currentConversation) {
                        // 确保配置对象存在
                        if (!currentConversation.config) {
                            currentConversation.config = {};
                        }
                        
                        // 保存对话标题
                        if (conversationTitle instanceof HTMLInputElement && conversationTitle.value.trim()) {
                            currentConversation.title = conversationTitle.value.trim();
                            
                            // 如果有侧边栏管理器，更新对话列表
                            if (window.chatUI && window.chatUI.sidebarManager) {
                                window.chatUI.sidebarManager.renderConversationList();
                            }
                        }
                        
                        // 获取旧模型ID
                        const oldModelId = currentConversation.config.model;
                        
                        // 从自定义选择器获取模型ID
                        const modelId = this.modelSelect ? this.modelSelect.getValue() : '';
                        if (modelId) {
                            currentConversation.config.model = modelId;
                            
                            // 同步更新顶部模型选择器
                            if (this.modelManager && currentConversation.config.model !== oldModelId) {
                                this.modelManager.selectModel(currentConversation.config.model);
                            }
                        }
                        
                        if (temperature instanceof HTMLInputElement) {
                            currentConversation.config.temperature = parseFloat(temperature.value);
                        }
                        
                        if (systemMessage instanceof HTMLTextAreaElement) {
                            currentConversation.config.systemMessage = systemMessage.value;
                        }
                        
                        // 保存对话
                        this.conversationManager.saveConversations();
                    }
                }
                
                if (typeof this.onSave === 'function') {
                    this.onSave();
                }
                
                this.close();
            }
        });
    }
    
    // 打开模态框时加载当前对话的设置
    loadConversationSettings() {
        if (!this.conversationManager) return;
        
        const currentConversation = this.conversationManager.getCurrentConversation();
        if (!currentConversation) return;
        
        // 确保对话有配置对象
        if (!currentConversation.config) {
            currentConversation.config = {
                model: localStorage.getItem('selected_model') || 'gpt-4o-mini',
                temperature: 0.7,
                systemMessage: ''
            };
        }
        
        // 获取表单元素
        const temperatureSlider = this.modalElement.querySelector('#temperature');
        const temperatureValue = this.modalElement.querySelector('#temperatureValue');
        const systemMessage = this.modalElement.querySelector('#systemMessage');
        const conversationTitle = this.modalElement.querySelector('#conversationTitle');
        
        // 设置对话标题
        if (conversationTitle instanceof HTMLInputElement && currentConversation.title) {
            conversationTitle.value = currentConversation.title;
        }
        
        // 设置模型 (使用CustomSelect)
        if (this.modelSelect && currentConversation.config.model) {
            this.modelSelect.setValue(currentConversation.config.model);
        }
        
        // 设置温度
        if (temperatureSlider instanceof HTMLInputElement && currentConversation.config.temperature !== undefined) {
            temperatureSlider.value = currentConversation.config.temperature.toString();
            if (temperatureValue) {
                temperatureValue.textContent = currentConversation.config.temperature.toString();
            }
        }
        
        // 设置系统消息
        if (systemMessage instanceof HTMLTextAreaElement && currentConversation.config.systemMessage) {
            systemMessage.value = currentConversation.config.systemMessage;
        }
    }
    
    open() {
        // 加载当前对话的设置
        this.loadConversationSettings();
        
        // 显示模态框
        this.modalElement.classList.remove('opacity-0', 'pointer-events-none');
        this.modalElement.classList.add('opacity-100');
        
        // 显示内容
        const content = this.modalElement.querySelector('#modalContent');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 50);
        
        // 添加ESC键关闭支持
        document.addEventListener('keydown', this.handleEscKey);
    }
    
    close() {
        // 隐藏内容
        const content = this.modalElement.querySelector('#modalContent');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        
        // 延迟隐藏模态框
        setTimeout(() => {
            this.modalElement.classList.remove('opacity-100');
            this.modalElement.classList.add('opacity-0', 'pointer-events-none');
        }, 200);
        
        // 移除ESC键关闭支持
        document.removeEventListener('keydown', this.handleEscKey);
    }
    
    // ESC键关闭处理
    handleEscKey = (e) => {
        if (e.key === 'Escape') {
            this.close();
        }
    }
} 