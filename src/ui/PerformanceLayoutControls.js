export class PerformanceLayoutControls {
    constructor(options = {}) {
        const {
            container = null,
            initialLayout = null,
            onChange = null
        } = options;

        this.container = container || this.ensureContainer();
        this.onChange = onChange;
        this.suspendNotify = false;

        this.layout = {
            padCount: 3,
            columns: 'auto',
            padSize: 1,
            padGap: 16,
            padAspect: 1,
            crosshair: 16,
            ...(initialLayout || {})
        };

        this.buildUI();
        this.applyLayoutToControls();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-layout');
        if (existing) return existing;

        const section = document.createElement('section');
        section.id = 'performance-layout';
        section.classList.add('performance-layout');
        document.body.appendChild(section);
        return section;
    }

    buildUI() {
        this.container.innerHTML = `
            <header class="performance-section-header">
                <div>
                    <h3>Touchpad Layout & Feel</h3>
                    <p class="performance-subtitle">Dial in pad count, spacing and gesture feedback for your rig.</p>
                </div>
            </header>
            <div class="layout-controls">
                <label>
                    <span>Pad Count</span>
                    <input type="range" min="1" max="8" step="1" data-layout-key="padCount">
                    <output data-layout-output="padCount"></output>
                </label>
                <label>
                    <span>Grid Columns</span>
                    <select data-layout-key="columns">
                        <option value="auto">Auto</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                    </select>
                </label>
                <label>
                    <span>Pad Size</span>
                    <input type="range" min="0.6" max="2.5" step="0.1" data-layout-key="padSize">
                    <output data-layout-output="padSize"></output>
                </label>
                <label>
                    <span>Pad Gap</span>
                    <input type="range" min="4" max="48" step="1" data-layout-key="padGap">
                    <output data-layout-output="padGap"></output>
                </label>
                <label>
                    <span>Aspect Ratio</span>
                    <input type="range" min="0.5" max="2" step="0.05" data-layout-key="padAspect">
                    <output data-layout-output="padAspect"></output>
                </label>
                <label>
                    <span>Crosshair Size</span>
                    <input type="range" min="8" max="48" step="1" data-layout-key="crosshair">
                    <output data-layout-output="crosshair"></output>
                </label>
            </div>
        `;

        this.container.querySelectorAll('[data-layout-key]').forEach(element => {
            const eventName = element.tagName === 'SELECT' ? 'change' : 'input';
            element.addEventListener(eventName, () => this.handleControlChange(element));
        });
    }

    handleControlChange(element) {
        const key = element.dataset.layoutKey;
        if (!key) return;

        let value = element.value;
        if (key === 'padCount' || key === 'padGap' || key === 'crosshair') {
            value = parseInt(value, 10);
        } else if (key === 'padSize' || key === 'padAspect') {
            value = parseFloat(value);
        }

        if (key !== 'columns' && Number.isFinite(value)) {
            this.layout[key] = value;
        } else if (key === 'columns') {
            this.layout[key] = value === 'auto' ? 'auto' : parseInt(value, 10);
        }

        this.updateOutputs();
        this.notifyChange();
    }

    notifyChange() {
        if (this.suspendNotify) return;
        if (typeof this.onChange === 'function') {
            this.onChange({ ...this.layout });
        }
    }

    applyLayoutToControls() {
        this.suspendNotify = true;
        this.container.querySelectorAll('[data-layout-key]').forEach(element => {
            const key = element.dataset.layoutKey;
            const value = this.layout[key];

            if (element.tagName === 'SELECT') {
                element.value = value === 'auto' ? 'auto' : String(value);
            } else {
                element.value = value;
            }
        });
        this.updateOutputs();
        this.suspendNotify = false;
    }

    updateOutputs() {
        this.container.querySelectorAll('[data-layout-output]').forEach(output => {
            const key = output.dataset.layoutOutput;
            let value = this.layout[key];
            if (key === 'padAspect') {
                value = value.toFixed(2);
            } else if (key === 'padSize') {
                value = value.toFixed(1);
            }
            output.textContent = value;
        });
    }

    setLayout(layout, { silent = false } = {}) {
        this.layout = {
            ...this.layout,
            ...(layout || {})
        };
        this.applyLayoutToControls();
        if (!silent) {
            this.notifyChange();
        }
    }

    destroy() {
        this.container.innerHTML = '';
    }
}
