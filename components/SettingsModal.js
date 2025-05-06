// 设置模态框组件
export class SettingsModalComponent {
    constructor(settingsManager, onSave) {
        this.settingsManager = settingsManager;
        this.onSave = onSave;
        this.modalElement = null;
        this.initModal();
    }
    
    initModal() {
        // 创建模态框元素
        this.modalElement = document.createElement('div');
        this.modalElement.id = 'settingsModal';
        this.modalElement.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300';
        
        // 设置模态框内容
        this.modalElement.innerHTML = `
            <div class="bg-white dark:bg-[#202123] rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto transform transition-transform duration-300 scale-95 opacity-0" id="modalContent">
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
        
        // 保存设置
        const saveBtn = this.modalElement.querySelector('#saveSettings');
        saveBtn.addEventListener('click', () => {
            const baseUrl = this.modalElement.querySelector('#baseUrl');
            const apiKey = this.modalElement.querySelector('#apiKey');
            const streamToggle = this.modalElement.querySelector('#streamToggle');
            
            if (baseUrl instanceof HTMLInputElement && 
                apiKey instanceof HTMLInputElement && 
                streamToggle instanceof HTMLInputElement) {
                
                this.settingsManager.set('baseUrl', baseUrl.value);
                this.settingsManager.set('apiKey', apiKey.value);
                this.settingsManager.set('streamEnabled', streamToggle.checked);
                
                if (typeof this.onSave === 'function') {
                    this.onSave();
                }
                
                this.close();
            }
        });
    }
    
    open() {
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