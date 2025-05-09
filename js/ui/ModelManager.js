/**
 * 模型管理模块 - 处理所有与模型选择和自定义模型相关的功能
 */
export class ModelManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {HTMLElement} options.modelSelect - 模型选择下拉框元素
     * @param {HTMLElement} options.selectedModelText - 显示当前选中模型的元素
     * @param {Function} options.onModelChange - 模型变更时的回调函数
     */
    constructor(options) {
        if (!options.modelSelect) {
            this.modelSelectContainer = document.createElement('div');
        } else {
            this.modelSelectContainer = options.modelSelect.parentElement || document.createElement('div');
        }
        
        // 存储原始提供的引用，但会在初始化时再次验证
        this._originalSelectedModelText = options.selectedModelText;
        this.selectedModelText = null; // 将在init方法中正确初始化
        this.onModelChange = options.onModelChange;
        
        // 内置模型列表
        this.builtInModels = [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
            { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini (2025-04-14)' },
            { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini (2024-07-18)' },
            { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano (2025-04-14)' }
        ];
        
        // 当前选中的模型
        this.currentModel = null;
        
        // 下拉框是否打开
        this.isDropdownOpen = false;
        
        // 初始化模型管理器
        this.init();
    }
    
    /**
     * 初始化模型管理器
     */
    init() {
        // 从localStorage获取保存的模型
        let savedModel = localStorage.getItem('selected_model');
        
        // 确保savedModel存在且有效，否则使用默认模型
        if (savedModel && savedModel !== 'undefined') {
            // 验证保存的模型ID是否在内置模型或自定义模型中存在
            const builtInModelExists = this.builtInModels.some(model => model.id === savedModel);
            const customModels = this.getCustomModels();
            const customModelExists = customModels.some(model => model.id === savedModel);
            
            if (builtInModelExists || customModelExists) {
                this.currentModel = savedModel;
            } else {
                // 如果模型不存在，使用默认模型
                this.currentModel = this.builtInModels[0].id;
                // 更新localStorage
                localStorage.setItem('selected_model', this.currentModel);
            }
        } else {
            // 如果没有已保存的模型或是无效值，使用默认模型
            this.currentModel = this.builtInModels[0].id;
            // 更新localStorage
            localStorage.setItem('selected_model', this.currentModel);
        }
        
        // 确保当前模型ID有效
        if (!this.currentModel || this.currentModel === 'undefined') {
            this.currentModel = this.builtInModels[0].id;
            localStorage.setItem('selected_model', this.currentModel);
        }
        
        // 尝试获取selectedModelText元素
        this.initSelectedModelTextReference();
        
        // 创建自定义下拉框
        this.createCustomDropdown();
        
        // 更新当前选中的模型显示
        this.updateSelectedModelDisplay();
        
        // 获取当前模型名称（有效性验证后）确保日志显示正确
        const currentModelName = this.getModelNameById(this.currentModel);
    }
    
    /**
     * 初始化selectedModelText引用
     * 按优先级尝试多种方式获取
     */
    initSelectedModelTextReference() {
        // 1. 首先尝试使用构造函数提供的引用
        if (this._originalSelectedModelText && this._originalSelectedModelText instanceof HTMLElement) {
            this.selectedModelText = this._originalSelectedModelText;
            return;
        }
        
        // 2. 尝试通过ID直接从DOM获取
        const domElement = document.getElementById('selectedModel');
        if (domElement) {
            this.selectedModelText = domElement;
            return;
        }
        
        // 3. 如果上述方法都失败，记录错误
    }
    
    /**
     * 创建自定义下拉框
     */
    createCustomDropdown() {
        // 若存在本来的下拉列表，则只需更新内容而不重建
        if (!this.dropdownContent || !this.modelSelectContainer) {
            // 清除modelSelectContainer的内容，为了重建下拉框
            if (this.modelSelectContainer) {
                this.modelSelectContainer.innerHTML = '';
            
                // 获取当前模型名称(带有验证)
                const currentModelName = this.getModelNameById(this.currentModel) || this.builtInModels[0].name;
                
                // 创建下拉框触发按钮
                const dropdownButton = document.createElement('button');
                dropdownButton.id = 'modelDropdownButton';
                dropdownButton.className = 'flex items-center gap-2';
                dropdownButton.innerHTML = `
                    <span id="selectedModel" title="${currentModelName}">${this.truncateModelName(currentModelName)}</span>
                    <i class="fas fa-chevron-down text-xs transition-transform duration-200"></i>
                `;
                this.modelSelectContainer.appendChild(dropdownButton);
                
                // 重新初始化selectedModelText引用
                const newSelectedModelElement = dropdownButton.querySelector('#selectedModel');
                if (newSelectedModelElement) {
                    this.selectedModelText = newSelectedModelElement;
                    
                    // 确保标题属性也设置正确
                    this.selectedModelText.title = currentModelName;
                } else {
                }
                
                // 创建下拉框内容容器 - 直接挂载到body
                const dropdownContent = document.createElement('div');
                dropdownContent.id = 'modelSelect';
                dropdownContent.className = 'fixed hidden z-50';
                document.body.appendChild(dropdownContent);
                this.dropdownContent = dropdownContent;
                
                // 保存按钮引用以便计算位置
                this.dropdownButton = dropdownButton;
                
                // 绑定下拉框按钮事件
                dropdownButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDropdown();
                });
                
                // 点击文档任何地方关闭下拉框
                document.addEventListener('click', () => {
                    this.closeDropdown();
                });
                
                // 阻止下拉框点击事件冒泡
                dropdownContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                // 添加窗口resize事件监听，以便在窗口大小变化时重新定位下拉框
                window.addEventListener('resize', () => {
                    if (this.isDropdownOpen) {
                        this.positionDropdown();
                    }
                });
            }
        }
        
        // 如果没有下拉内容容器，则无法进行下一步
        if (!this.dropdownContent) return;
        
        // 清空下拉内容准备重新填充
        this.dropdownContent.innerHTML = '';
        
        // 添加样式
        this.dropdownContent.classList.add('bg-white', 'dark:bg-gray-800', 'rounded-md', 'shadow-lg', 'border', 'border-gray-200', 'dark:border-gray-700', 'overflow-hidden', 'max-h-64', 'overflow-y-auto');
        
        // 添加内置模型部分
        const builtInSection = document.createElement('div');
        builtInSection.className = 'py-1';
        
        const builtInTitle = document.createElement('div');
        builtInTitle.className = 'px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';
        builtInTitle.textContent = '内置模型';
        builtInSection.appendChild(builtInTitle);
        
        // 添加内置模型
        this.builtInModels.forEach(model => {
            const isSelected = model.id === this.currentModel;
            const modelItem = document.createElement('div');
            modelItem.className = `px-4 py-1 text-sm cursor-pointer flex items-center justify-between ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`;
            modelItem.dataset.modelId = model.id;
            modelItem.dataset.modelName = model.name;
            modelItem.innerHTML = `
                <span class="model-name flex-1 truncate" title="${model.name}">${model.name}</span>
                <div class="flex items-center">
                    ${isSelected ? '<i class="fas fa-check text-blue-600 dark:text-blue-400"></i>' : ''}
                </div>
            `;
            
            // 添加点击事件
            modelItem.addEventListener('click', () => {
                this.selectModel(model.id, model.name);
                // 刷新下拉菜单以更新勾选状态
                this.createCustomDropdown();
                this.closeDropdown();
            });
            
            builtInSection.appendChild(modelItem);
        });
        
        this.dropdownContent.appendChild(builtInSection);
        
        // 添加自定义模型部分
        const customModels = this.getCustomModels();
        if (customModels.length > 0) {
            const customSection = document.createElement('div');
            customSection.className = 'py-1 border-t border-gray-200 dark:border-gray-700';
            
            const customTitle = document.createElement('div');
            customTitle.className = 'px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';
            customTitle.textContent = '自定义模型';
            customSection.appendChild(customTitle);
            
            // 添加自定义模型
            customModels.forEach(model => {
                const isSelected = model.id === this.currentModel;
                const modelItem = document.createElement('div');
                modelItem.className = `px-4 py-1 text-sm cursor-pointer flex items-center justify-between group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`;
                modelItem.dataset.modelId = model.id;
                modelItem.dataset.modelName = model.name;
                modelItem.innerHTML = `
                    <span class="model-name flex-1 truncate" title="${model.name}">${model.name}</span>
                    <div class="flex items-center">
                        ${isSelected ? '<i class="fas fa-check mr-2 text-blue-600 dark:text-blue-400"></i>' : ''}
                        <button class="delete-btn p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" title="删除模型">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                `;
                
                // 添加点击事件
                modelItem.addEventListener('click', (e) => {
                    if (e.target.closest('.delete-btn')) {
                        // 删除按钮点击事件
                        e.stopPropagation();
                        this.removeCustomModel(model.id);
                        modelItem.remove();
                        
                        // 如果删除的是当前选中的模型，切换到默认模型
                        if (model.id === this.currentModel) {
                            this.selectModel(this.builtInModels[0].id, this.builtInModels[0].name);
                        }
                        
                        // 如果没有自定义模型了，移除整个部分
                        if (this.getCustomModels().length === 0) {
                            customSection.remove();
                        }
                    } else {
                        // 模型项点击选择模型
                        this.selectModel(model.id, model.name);
                        // 刷新下拉菜单以更新勾选状态
                        this.createCustomDropdown();
                        this.closeDropdown();
                    }
                });
                
                customSection.appendChild(modelItem);
            });
            
            this.dropdownContent.appendChild(customSection);
        }
        
        // 添加输入框部分
        const addModelSection = document.createElement('div');
        addModelSection.className = 'px-4 py-2 border-t border-gray-200 dark:border-gray-700';
        addModelSection.innerHTML = `
            <div class="flex items-center space-x-1">
                <input type="text" placeholder="输入新模型ID" class="w-0 new-model-input flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                <button class="add-model-btn-input">+</button>
            </div>
        `;
        
        // 添加新建模型事件
        const addModelBtn = addModelSection.querySelector('.add-model-btn-input');
        const modelInput = addModelSection.querySelector('.new-model-input');
        
        // 提交表单处理函数
        const submitNewModel = () => {
            const value = modelInput.value.trim();
            if (value) {
                this.addCustomModel(value);
                this.createCustomDropdown(); // 重新创建下拉框
                modelInput.value = ''; // 清空输入框
            }
        };
        
        // 按钮点击添加
        addModelBtn.addEventListener('click', submitNewModel);
        
        // 回车键添加
        modelInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitNewModel();
            }
        });
        
        this.dropdownContent.appendChild(addModelSection);
    }
    
    /**
     * 计算并设置下拉框位置
     */
    positionDropdown() {
        if (!this.dropdownButton || !this.dropdownContent) return;
        
        // 获取按钮的位置信息
        const buttonRect = this.dropdownButton.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        
        // 设置下拉框位置（考虑滚动位置）
        this.dropdownContent.style.top = `${buttonRect.bottom + scrollY + 4}px`;
        this.dropdownContent.style.left = `${buttonRect.left + scrollX}px`;
        this.dropdownContent.style.width = `${Math.max(buttonRect.width, 300)}px`;
    }
    
    /**
     * 切换下拉框显示状态
     */
    toggleDropdown() {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    /**
     * 打开下拉框
     */
    openDropdown() {
        if (!this.dropdownContent) return;
        
        // 计算位置
        this.positionDropdown();
        
        // 显示下拉框并添加动画效果
        this.dropdownContent.classList.remove('hidden');
        setTimeout(() => {
            this.dropdownContent.classList.add('opacity-100');
        }, 10);
        
        // 旋转下拉箭头
        if (this.dropdownButton) {
            const arrow = this.dropdownButton.querySelector('i.fa-chevron-down');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
        
        this.isDropdownOpen = true;
    }
    
    /**
     * 关闭下拉框
     */
    closeDropdown() {
        if (!this.dropdownContent || !this.isDropdownOpen) return;
        
        // 添加淡出动画效果
        this.dropdownContent.classList.remove('opacity-100');
        
        // 延迟隐藏元素以配合动画
        setTimeout(() => {
            this.dropdownContent.classList.add('hidden');
        }, 150);
        
        // 恢复下拉箭头
        if (this.dropdownButton) {
            const arrow = this.dropdownButton.querySelector('i.fa-chevron-down');
            if (arrow) arrow.style.transform = '';
        }
        
        this.isDropdownOpen = false;
    }
    
    /**
     * 显示添加模型对话框
     */
    showAddModelModal() {
        // 关闭下拉框
        this.closeDropdown();
        
        // 创建模态对话框背景
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'addModelModalOverlay';
        modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 opacity-0 transition-opacity duration-200';
        
        // 创建模态对话框
        const modal = document.createElement('div');
        modal.className = 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform translate-y-4 transition-transform duration-300';
        
        // 创建模态对话框内容
        modal.innerHTML = `
            <div class="p-5 border-b border-gray-200">
                <h3 class="text-lg font-medium text-gray-900">添加新模型</h3>
                <p class="text-sm text-gray-500 mt-1">输入模型名称以添加自定义模型</p>
            </div>
            <div class="p-5">
                <div class="mb-4">
                    <label for="modelNameInput" class="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
                    <input type="text" id="modelNameInput" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="例如: GPT-4-1106-preview">
                </div>
            </div>
            <div class="px-5 py-3 flex justify-end space-x-3 border-t border-gray-200 card-bg rounded-b-lg">
                <button id="cancelAddModelBtn" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">取消</button>
                <button id="confirmAddModelBtn" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">添加</button>
            </div>
        `;
        
        // 添加模态对话框到背景
        modalOverlay.appendChild(modal);
        
        // 添加背景到文档
        document.body.appendChild(modalOverlay);
        
        // 保存对话框引用
        this.modalOverlay = modalOverlay;
        
        // 获取输入框
        const modelNameInput = document.getElementById('modelNameInput');
        
        // 绑定取消按钮事件
        const cancelBtn = document.getElementById('cancelAddModelBtn');
        cancelBtn.addEventListener('click', () => {
            this.closeAddModelModal();
        });
        
        // 绑定确认按钮事件
        const confirmBtn = document.getElementById('confirmAddModelBtn');
        confirmBtn.addEventListener('click', () => {
            if (modelNameInput.value.trim()) {
                this.addCustomModel(modelNameInput.value.trim());
                this.closeAddModelModal();
            } else {
                // 显示输入错误提示
                modelNameInput.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
                const errorMsg = document.createElement('p');
                errorMsg.className = 'mt-1 text-sm text-red-600';
                errorMsg.textContent = '请输入模型名称';
                
                // 避免重复添加错误提示
                const existingError = modelNameInput.parentElement.querySelector('.text-red-600');
                if (!existingError) {
                    modelNameInput.parentElement.appendChild(errorMsg);
                }
            }
        });
        
        // 绑定Enter键事件
        modelNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
            
            // 清除错误状态
            modelNameInput.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
            const existingError = modelNameInput.parentElement.querySelector('.text-red-600');
            if (existingError) {
                existingError.remove();
            }
        });
        
        // 绑定背景点击事件
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeAddModelModal();
            }
        });
        
        // 添加ESC键关闭事件
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeAddModelModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // 显示对话框并设置动画
        setTimeout(() => {
            modalOverlay.classList.add('opacity-100');
            modal.classList.remove('translate-y-4');
            
            // 焦点输入框
            modelNameInput.focus();
        }, 10);
    }
    
    /**
     * 关闭添加模型对话框
     */
    closeAddModelModal() {
        if (!this.modalOverlay) return;
        
        // 添加退出动画
        this.modalOverlay.classList.remove('opacity-100');
        const modal = this.modalOverlay.querySelector('div');
        if (modal) {
            modal.classList.add('translate-y-4');
        }
        
        // 延迟删除元素
        setTimeout(() => {
            this.modalOverlay.remove();
            this.modalOverlay = null;
        }, 200);
    }
    
    /**
     * 选择模型
     * @param {string} modelId - 模型ID
     * @param {string} modelName - 模型名称（可选）
     */
    selectModel(modelId, modelName) {
        // 验证参数有效性
        if (!modelId) {
            return;
        }
        
        // 如果没有提供模型名称，尝试从ID获取
        if (!modelName) {
            modelName = this.getModelNameById(modelId);
        }
        
        // 更新当前模型ID
        this.currentModel = modelId;
        
        // 保存选择到localStorage
        localStorage.setItem('selected_model', modelId);
        
        // 获取实际DOM中的显示元素（不依赖于可能已过期的缓存引用）
        const displayElement = document.getElementById('selectedModel');
        if (displayElement) {
            displayElement.textContent = this.truncateModelName(modelName);
            displayElement.title = modelName;
        }
        
        // 同时更新内部引用
        this.updateSelectedModelDisplay();
        
        // 更新下拉菜单中的选中状态
        this.updateDropdownSelection();
        
        // 关闭下拉框
        this.closeDropdown();
        
        // 调用回调函数
        if (typeof this.onModelChange === 'function') {
            this.onModelChange(modelId, modelName);
        }
        
        // 显示提示，确保消息不包含undefined
        if (window.toast && modelName) {
            window.toast.info(`已选择模型: ${modelName}`);
        }
    }
    
    /**
     * 更新下拉菜单中的选中状态
     */
    updateDropdownSelection() {
        if (!this.dropdownContent) return;
        
        // 移除所有选项的选中状态
        const options = this.dropdownContent.querySelectorAll('[data-model-id]');
        options.forEach(option => {
            option.classList.remove('bg-blue-50', 'font-medium');
        });
        
        // 为当前选中的模型添加选中状态
        const selectedOption = this.dropdownContent.querySelector(`[data-model-id="${this.currentModel}"]`);
        if (selectedOption) {
            selectedOption.classList.add('bg-blue-50', 'font-medium');
        }
    }
    
    /**
     * 更新当前选中的模型显示
     */
    updateSelectedModelDisplay() {
        // 尝试重新获取selectedModelText元素（如果它不存在）
        if (!this.selectedModelText) {
            this.selectedModelText = document.getElementById('selectedModel');
        }
        
        // 确保当前模型有效
        if (!this.currentModel || this.currentModel === 'undefined') {
            this.currentModel = this.builtInModels[0].id;
            localStorage.setItem('selected_model', this.currentModel);
        }
        
        // 获取模型名称，确保不为undefined
        const modelName = this.getModelNameById(this.currentModel);
        
        // 尝试直接从DOM获取元素并更新
        const directElement = document.getElementById('selectedModel');
        if (directElement) {
            directElement.textContent = this.truncateModelName(modelName);
            directElement.title = modelName;
        }
        
        // 同时更新缓存的引用（如果存在）
        if (this.selectedModelText) {
            // 更新显示
            this.selectedModelText.textContent = this.truncateModelName(modelName);
            
            // 添加标题属性，鼠标悬停时显示完整名称
            this.selectedModelText.title = modelName;
            
        } else {
        }
    }
    
    /**
     * 截断显示过长的模型名称
     * @param {string} name - 模型名称
     * @returns {string} 截断后的名称
     */
    truncateModelName(name) {
        if (!name) return '';
        
        const maxLength = 24; // 增加最大长度
        if (name.length <= maxLength) return name;
        
        return name.substring(0, maxLength - 2) + '...';
    }
    
    /**
     * 添加自定义模型
     * @param {string} modelName - 模型名称
     */
    addCustomModel(modelName) {
        if (!modelName || modelName.trim() === '') return;
        
        modelName = modelName.trim();
        
        // 获取当前自定义模型
        const customModels = this.getCustomModels();
        
        // 检查是否已存在
        const allModels = [...this.builtInModels, ...customModels];
        const modelExists = allModels.some(m => 
            m.name.toLowerCase() === modelName.toLowerCase() || 
            m.id.toLowerCase() === modelName.toLowerCase()
        );
        
        if (modelExists) {
            if (window.toast) {
                window.toast.warning('该模型名称已存在');
            }
            return;
        }
        
        // 创建新模型 - 直接使用模型名称作为ID
        const newModel = {
            id: modelName,
            name: modelName,
            isCustom: true
        };
        
        // 添加到列表并保存
        customModels.push(newModel);
        localStorage.setItem('custom_models', JSON.stringify(customModels));
        
        // 选择新添加的模型
        this.selectModel(newModel.id, newModel.name);
        
        // 重新创建下拉框
        this.createCustomDropdown();
        
        // 提示
        if (window.toast) {
            window.toast.success(`模型 "${modelName}" 已添加并选择`);
        }
    }
    
    /**
     * 移除自定义模型
     * @param {string} modelId - 模型ID
     */
    removeCustomModel(modelId) {
        // 获取自定义模型列表
        const customModels = this.getCustomModels();
        
        // 找到要删除的模型
        const modelIndex = customModels.findIndex(m => m.id === modelId);
        if (modelIndex === -1) return;
        
        const modelName = customModels[modelIndex].name;
        
        // 删除模型
        customModels.splice(modelIndex, 1);
        localStorage.setItem('custom_models', JSON.stringify(customModels));
        
        // 如果删除的是当前选中的模型，切换到默认模型
        if (this.currentModel === modelId) {
            this.selectModel(this.builtInModels[0].id, this.builtInModels[0].name);
        } else {
            // 重新创建下拉框，保持打开状态
            this.createCustomDropdown();
            this.openDropdown();
        }
        
        // 提示
        if (window.toast) {
            window.toast.success(`模型 "${modelName}" 已删除`);
        }
    }
    
    /**
     * 获取自定义模型列表
     * @returns {Array} 自定义模型列表
     */
    getCustomModels() {
        try {
            const savedCustomModels = localStorage.getItem('custom_models');
            if (savedCustomModels) {
                return JSON.parse(savedCustomModels);
            }
        } catch (e) {
        }
        return [];
    }
    
    /**
     * 根据模型ID获取模型名称
     * @param {string} modelId - 模型ID
     * @returns {string} 模型名称
     */
    getModelNameById(modelId) {
        // 如果ID为空、undefined或字符串'undefined'，返回默认模型名称
        if (!modelId || modelId === 'undefined') {
            
            // 同时修正currentModel
            if (this.currentModel === modelId || !this.currentModel) {
                this.currentModel = this.builtInModels[0].id;
                localStorage.setItem('selected_model', this.currentModel);
            }
            
            return this.builtInModels[0].name;
        }
        
        // 查找内置模型
        const builtInModel = this.builtInModels.find(model => model.id === modelId);
        if (builtInModel) return builtInModel.name;
        
        // 查找自定义模型
        const customModels = this.getCustomModels();
        const customModel = customModels.find(model => model.id === modelId);
        if (customModel) return customModel.name;
        
        // 如果未找到，记录警告并返回默认模型名称
        
        // 同时修正currentModel
        if (this.currentModel === modelId) {
            this.currentModel = this.builtInModels[0].id;
            localStorage.setItem('selected_model', this.currentModel);
        }
        
        return this.builtInModels[0].name;
    }
    
    /**
     * 获取当前选中的模型ID
     * @returns {string} 当前模型ID
     */
    getCurrentModelId() {
        // 确保当前模型有效
        if (!this.currentModel || this.currentModel === 'undefined') {
            this.currentModel = this.builtInModels[0].id;
            localStorage.setItem('selected_model', this.currentModel);
        }
        
        // 再次验证当前模型是否存在于可用模型列表中
        const allModels = [...this.builtInModels, ...this.getCustomModels()];
        const modelExists = allModels.some(model => model.id === this.currentModel);
        
        if (!modelExists) {
            this.currentModel = this.builtInModels[0].id;
            localStorage.setItem('selected_model', this.currentModel);
        }
        
        return this.currentModel;
    }
    
    /**
     * 获取实际要使用的模型ID（考虑版本名称）
     * @returns {string} 实际模型ID
     */
    getActualModelId() {
        const modelId = this.getCurrentModelId();
        
        // 首先检查是否是内置模型
        const isBuiltIn = this.builtInModels.some(model => model.id === modelId);
        
        if (isBuiltIn) {
            // 对于内置模型，保持原有逻辑
            if (modelId.includes('-20')) {
                // 如果包含日期/版本（如gpt-4-1106-preview），则保留整个ID
                return modelId;
            } else {
                // 可能是无版本的基础模型ID，直接返回
                return modelId;
            }
        } else {
            // 对于自定义模型，直接返回ID（即模型名称）
            return modelId;
        }
    }
    
    /**
     * 获取当前选中的模型（包含id和name）
     * @returns {Object} 包含id和name的模型对象
     */
    getSelectedModel() {
        const modelId = this.getCurrentModelId();
        const modelName = this.getModelNameById(modelId);
        
        return {
            id: modelId,
            name: modelName
        };
    }
} 