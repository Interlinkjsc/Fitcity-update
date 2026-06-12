/**
 * Alpine.js state for collapsible admin sidebar modules (Phase 2).
 */
function createSidebarNav() {
    const STORAGE_KEY = 'fitcity_sidebar_modules';

    return {
        groups: [],
        activePage: '',
        openModules: {},

        initFromPayload() {
            const el = document.getElementById('sidebar-nav-payload');
            if (!el) return;

            let data = { groups: [], activePage: '' };
            try {
                data = JSON.parse(el.textContent);
            } catch (e) {
                console.warn('[sidebar] Invalid nav payload', e);
            }

            this.groups = data.groups || [];
            this.activePage = data.activePage || '';

            let saved = {};
            try {
                saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            } catch (e) {
                saved = {};
            }

            let anyOpen = false;
            this.groups.forEach((group) => {
                if (!group.collapsible) return;
                const hasActive = group.items.some((item) => item.key === this.activePage);
                const stored = saved[group.moduleId];
                const isOpen = hasActive || (stored !== undefined ? stored : false);
                this.openModules[group.moduleId] = isOpen;
                if (isOpen) anyOpen = true;
            });

            if (!anyOpen) {
                const first = this.groups.find((g) => g.collapsible);
                if (first) this.openModules[first.moduleId] = true;
            }
        },

        toggleModule(moduleId) {
            this.openModules[moduleId] = !this.isModuleOpen(moduleId);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.openModules));
            } catch (e) {
                /* ignore quota errors */
            }
        },

        isModuleOpen(moduleId) {
            return this.openModules[moduleId] !== false;
        },

        isItemActive(key) {
            return this.activePage === key;
        },

        itemLinkClass(key) {
            const base =
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors';
            return this.isItemActive(key)
                ? `${base} sidebar-active text-green-700 bg-green-50`
                : `${base} hover:bg-slate-100 hover:text-slate-900`;
        },
    };
}
