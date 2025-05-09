/**
 * 自定义Select组件 - 提供美观且一致的下拉选择框
 */
export class CustomSelect {
    /**
     * 创建自定义Select组件
     * @param {Object} options - 配置选项
     * @param {string} options.id - 选择框的ID
     * @param {string} options.placeholder - 占位文本
     * @param {Array} options.options - 选项列表 [{id, name}]
     * @param {string} options.value - 初始选中的值
     * @param {Function} options.onChange - 值变更时的回调
     * @param {HTMLElement} options.container - 容器元素(可选)
     */
    constructor(options) {
        this.id = options.id || `custom-select-${Date.now()}`;
        this.placeholder = options.placeholder || '请选择';
        this.options = options.options || [];
        this.value = options.value || '';
        this.onChange = options.onChange || (() => {});
        this.container = options.container;
        
        this.isOpen = false;
        this.selectedOption = this.options.find(opt => opt.id === this.value);
        
        // 初始化文档点击处理器
        this._documentClickHandler = null;
        
        this.render();
        this.bindEvents();
    }
    
    /**
     * 渲染选择框
     */
    render() {
        // 创建外层容器
        this.element = document.createElement('div');
        this.element.className = 'custom-select relative w-full';
        this.element.id = this.id;
        
        // 创建选择框
        const selectedText = this.selectedOption ? this.selectedOption.name : this.placeholder;
        const isPlaceholder = !this.selectedOption;
        
        this.element.innerHTML = `
            <button 
                type="button" 
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                aria-haspopup="true"
                aria-expanded="false"
            >
                <span class="truncate ${isPlaceholder ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}">${selectedText}</span>
                <i class="fas fa-chevron-down text-xs text-gray-400 dark:text-gray-500 transform transition-transform duration-200"></i>
            </button>
            
            <div class="dropdown absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-60 overflow-auto hidden">
                <ul role="listbox" class="py-1">
                    ${this.renderOptions()}
                </ul>
            </div>
        `;
        
        // 如果提供了容器，将元素添加到容器中
        if (this.container && this.container instanceof HTMLElement) {
            this.container.appendChild(this.element);
        }
    }
    
    /**
     * 渲染选项列表
     * @returns {string} 选项列表HTML
     */
    renderOptions() {
        if (!this.options || this.options.length === 0) {
            return `<li class="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">无可用选项</li>`;
        }
        
        return this.options.map(option => {
            const isSelected = option.id === this.value;
            return `
                <li 
                    role="option" 
                    class="px-4 py-1 cursor-pointer flex items-center justify-between ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}"
                    data-value="${option.id}" 
                    aria-selected="${isSelected}"
                >
                    <span class="truncate">${option.name}</span>
                    ${isSelected ? '<i class="fas fa-check text-blue-600 dark:text-blue-400"></i>' : ''}
                </li>
            `;
        }).join('');
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 获取触发按钮和下拉菜单
        const trigger = this.element.querySelector('button');
        const dropdown = this.element.querySelector('.dropdown');
        
        // 点击按钮切换下拉菜单
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // 点击选项选择值
        const options = this.element.querySelectorAll('li[data-value]');
        options.forEach(option => {
            option.addEventListener('click', () => {
                if (option instanceof HTMLElement) {
                    const value = option.dataset.value;
                    this.setValue(value);
                    this.closeDropdown();
                }
            });
        });
        
        // 移除旧的点击其他地方关闭事件（如果存在）
        if (this._documentClickHandler) {
            document.removeEventListener('click', this._documentClickHandler);
        }
        
        // 定义并存储文档点击处理函数
        this._documentClickHandler = (e) => {
            // 如果点击的不是下拉菜单内的元素，则关闭下拉菜单
            if (!this.element.contains(e.target) && this.isOpen) {
                this.closeDropdown();
            }
        };
        
        // 添加全局点击事件监听
        document.addEventListener('click', this._documentClickHandler);
        
        // 阻止下拉菜单点击事件冒泡
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // 添加键盘导航
        this.element.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter':
                case 'Space':
                    if (!this.isOpen) {
                        this.openDropdown();
                    }
                    break;
                case 'Escape':
                    this.closeDropdown();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (!this.isOpen) {
                        this.openDropdown();
                    } else {
                        this.focusNextOption();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (!this.isOpen) {
                        this.openDropdown();
                    } else {
                        this.focusPreviousOption();
                    }
                    break;
            }
        });
    }
    
    /**
     * 切换下拉菜单状态
     */
    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    /**
     * 打开下拉菜单
     */
    openDropdown() {
        const dropdown = this.element.querySelector('.dropdown');
        const arrow = this.element.querySelector('button i');
        
        if (dropdown) dropdown.classList.remove('hidden');
        if (arrow instanceof HTMLElement) arrow.style.transform = 'rotate(180deg)';
        
        // 设置ARIA属性
        const button = this.element.querySelector('button');
        if (button) button.setAttribute('aria-expanded', 'true');
        
        this.isOpen = true;
    }
    
    /**
     * 关闭下拉菜单
     */
    closeDropdown() {
        if (!this.isOpen) return;
        
        const dropdown = this.element.querySelector('.dropdown');
        const arrow = this.element.querySelector('button i');
        
        if (dropdown) dropdown.classList.add('hidden');
        if (arrow instanceof HTMLElement) arrow.style.transform = '';
        
        // 设置ARIA属性
        const button = this.element.querySelector('button');
        if (button) button.setAttribute('aria-expanded', 'false');
        
        this.isOpen = false;
    }
    
    /**
     * 设置选中值
     * @param {string} value - 选中的值
     */
    setValue(value) {
        // 更新值
        this.value = value;
        this.selectedOption = this.options.find(opt => opt.id === value);
        
        // 更新按钮文本
        const buttonText = this.element.querySelector('button span');
        if (buttonText) {
            const selectedText = this.selectedOption ? this.selectedOption.name : this.placeholder;
            buttonText.textContent = selectedText;
            
            // 更新占位符样式
            if (this.selectedOption) {
                buttonText.classList.remove('text-gray-400', 'dark:text-gray-500');
                buttonText.classList.add('text-gray-700', 'dark:text-gray-200');
            } else {
                buttonText.classList.add('text-gray-400', 'dark:text-gray-500');
                buttonText.classList.remove('text-gray-700', 'dark:text-gray-200');
            }
        }
        
        // 更新选项列表样式
        const options = this.element.querySelectorAll('li[data-value]');
        options.forEach(option => {
            if (option instanceof HTMLElement) {
                const isSelected = option.dataset.value === value;
                option.setAttribute('aria-selected', String(isSelected));
                
                if (isSelected) {
                    option.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-700', 'dark:text-blue-400');
                    option.classList.remove('hover:bg-gray-50', 'dark:hover:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
                    
                    // 添加选中图标
                    if (!option.querySelector('.fa-check')) {
                        const checkIcon = document.createElement('i');
                        checkIcon.className = 'fas fa-check text-blue-600 dark:text-blue-400';
                        option.appendChild(checkIcon);
                    }
                } else {
                    option.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-700', 'dark:text-blue-400');
                    option.classList.add('hover:bg-gray-50', 'dark:hover:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
                    
                    // 移除选中图标
                    const checkIcon = option.querySelector('.fa-check');
                    if (checkIcon) {
                        option.removeChild(checkIcon);
                    }
                }
            }
        });
        
        // 调用onChange回调
        if (typeof this.onChange === 'function') {
            this.onChange(value, this.selectedOption);
        }
    }
    
    /**
     * 聚焦下一个选项
     */
    focusNextOption() {
        const options = Array.from(this.element.querySelectorAll('li[data-value]'));
        if (!options.length) return;
        
        let currentIndex = -1;
        for (let i = 0; i < options.length; i++) {
            if (options[i] instanceof HTMLElement && options[i].dataset.value === this.value) {
                currentIndex = i;
                break;
            }
        }
        
        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        
        // 设置新选中项
        const nextOption = options[nextIndex];
        if (nextOption instanceof HTMLElement) {
            this.setValue(nextOption.dataset.value);
            
            // 确保新选中项可见
            nextOption.scrollIntoView({block: 'nearest'});
        }
    }
    
    /**
     * 聚焦上一个选项
     */
    focusPreviousOption() {
        const options = Array.from(this.element.querySelectorAll('li[data-value]'));
        if (!options.length) return;
        
        let currentIndex = -1;
        for (let i = 0; i < options.length; i++) {
            if (options[i] instanceof HTMLElement && options[i].dataset.value === this.value) {
                currentIndex = i;
                break;
            }
        }
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        
        // 设置新选中项
        const prevOption = options[prevIndex];
        if (prevOption instanceof HTMLElement) {
            this.setValue(prevOption.dataset.value);
            
            // 确保新选中项可见
            prevOption.scrollIntoView({block: 'nearest'});
        }
    }
    
    /**
     * 获取当前值
     * @returns {string} 当前选中的值
     */
    getValue() {
        return this.value;
    }
    
    /**
     * 更新选项列表
     * @param {Array} options - 新的选项列表
     */
    updateOptions(options) {
        this.options = options || [];
        
        // 验证当前选中值是否还在新选项中
        if (this.value && !this.options.some(opt => opt.id === this.value)) {
            this.value = '';
            this.selectedOption = null;
        }
        
        // 更新下拉内容
        const dropdown = this.element.querySelector('.dropdown ul');
        if (dropdown) {
            dropdown.innerHTML = this.renderOptions();
            
            // 重新绑定选项点击事件
            const optionElements = dropdown.querySelectorAll('li[data-value]');
            optionElements.forEach(option => {
                option.addEventListener('click', () => {
                    if (option instanceof HTMLElement) {
                        const value = option.dataset.value;
                        this.setValue(value);
                        this.closeDropdown();
                    }
                });
            });
        }
        
        // 更新按钮文本
        this.selectedOption = this.options.find(opt => opt.id === this.value);
        const buttonText = this.element.querySelector('button span');
        if (buttonText) {
            const selectedText = this.selectedOption ? this.selectedOption.name : this.placeholder;
            buttonText.textContent = selectedText;
            
            // 更新占位符样式
            if (this.selectedOption) {
                buttonText.classList.remove('text-gray-400', 'dark:text-gray-500');
                buttonText.classList.add('text-gray-700', 'dark:text-gray-200');
            } else {
                buttonText.classList.add('text-gray-400', 'dark:text-gray-500');
                buttonText.classList.remove('text-gray-700', 'dark:text-gray-200');
            }
        }
    }
    
    /**
     * 清理资源，移除事件监听器
     * 在组件不再需要使用时应调用此方法
     */
    destroy() {
        // 移除文档点击事件监听器
        if (this._documentClickHandler) {
            document.removeEventListener('click', this._documentClickHandler);
            this._documentClickHandler = null;
        }
        
        // 移除自定义选择器的DOM元素
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
} 