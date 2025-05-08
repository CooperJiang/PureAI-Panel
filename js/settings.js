// 设置管理模块
export class SettingsManager {
    constructor() {
        const contextEnabledValue = localStorage.getItem('context_enabled');
        console.log('初始化contextEnabled, 从localStorage读取的值:', contextEnabledValue);
        
        this.settings = {
            apiKey: localStorage.getItem('openai_api_key') || '',
            baseUrl: localStorage.getItem('openai_base_url') || 'https://api.openai.com',
            streamEnabled: localStorage.getItem('stream_enabled') !== 'false',
            contextEnabled: contextEnabledValue !== 'false',
            darkMode: localStorage.getItem('dark_mode') === 'true' || 
                     (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        };
        
        console.log('初始化后的contextEnabled值:', this.settings.contextEnabled);
        
        // 初始化深色模式
        if (this.settings.darkMode) {
            document.documentElement.classList.add('dark');
        }
    }
    
    // 获取设置
    get(key, defaultValue) {
        // 特殊检查API密钥
        if (key === 'apiKey') {
            const value = this.settings[key];
            return value || defaultValue;
        }
        
        // 特殊检查上下文开关
        if (key === 'contextEnabled') {
            const storedValue = localStorage.getItem('context_enabled');
            console.log('获取contextEnabled设置，localStorage值:', storedValue);
            console.log('settings中的值:', this.settings[key]);
            return this.settings[key];
        }
        
        return this.settings[key] || defaultValue;
    }
    
    // 更新设置
    set(key, value) {
        this.settings[key] = value;
        
        // 保存到本地存储
        switch (key) {
            case 'apiKey':
                localStorage.setItem('openai_api_key', value);
                break;
            case 'baseUrl':
                localStorage.setItem('openai_base_url', value);
                break;
            case 'streamEnabled':
                localStorage.setItem('stream_enabled', value);
                break;
            case 'contextEnabled':
                localStorage.setItem('context_enabled', String(value));
                console.log('设置context_enabled为:', value, '类型:', typeof value, '保存后localStorage值:', localStorage.getItem('context_enabled'), '类型:', typeof localStorage.getItem('context_enabled'));
                break;
            case 'darkMode':
                localStorage.setItem('dark_mode', value);
                // 更新UI
                if (value) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                break;
        }
    }
    
    // 切换布尔设置
    toggle(key) {
        console.log('切换设置前:', key, this.settings[key]);
        const newValue = !this.settings[key];
        this.set(key, newValue);
        console.log('切换设置后:', key, this.settings[key], '本地存储值:', localStorage.getItem(key === 'contextEnabled' ? 'context_enabled' : key));
        return this.settings[key];
    }
    
    // 检查是否已设置必要参数
    hasRequiredSettings() {
        return this.settings.apiKey && this.settings.baseUrl;
    }
} 