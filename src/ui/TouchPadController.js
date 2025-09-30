import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function copyMapping(mapping) {
    return JSON.parse(JSON.stringify(mapping));
}

export class TouchPadController {
    constructor({
        parameterManager = null,
        container = null,
        config = DEFAULT_PERFORMANCE_CONFIG.touchPads,
        hub = null,
        onMappingChange = null
    } = {}) {
        this.parameterManager = parameterManager;
        this.hub = hub;
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.touchPads, ...(config || {}) };
        this.onMappingChange = typeof onMappingChange === 'function' ? onMappingChange : () => {};

        this.container = container || this.ensureContainer();
        this.parameterOptions = this.buildParameterOptions();
        this.padCount = Math.max(1, this.config.padCount || 3);
        this.pads = [];

        this.render();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-touchpads');
        if (existing) {
            existing.innerHTML = '';
            return existing;
        }

        const section = document.createElement('section');
        section.id = 'performance-touchpads';
        return section;
    }

    buildParameterOptions() {
        if (!this.parameterManager || typeof this.parameterManager.listParameterMetadata !== 'function') {
            return [];
        }

        const filter = Array.isArray(this.config.parameterTags) && this.config.parameterTags.length
            ? { tags: this.config.parameterTags }
            : {};

        const options = this.parameterManager.listParameterMetadata(filter);
        if (options.length > 0) {
            return options;
        }

        // Fall back to every parameter if no filtered options
        return this.parameterManager.listParameterMetadata();
    }

    render() {
        if (!this.container) return;

        this.container.classList.add('performance-block');
        this.container.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'performance-block__header';
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Touch Pads</h3>
                <p class="performance-block__subtitle">Assign any parameter to expressive XY pads. Use a two-finger spread to drive a third parameter.</p>
            </div>
        `;
        this.container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'touchpad-grid';
        this.container.appendChild(grid);

        const mappings = this.config.defaultMappings || [];
        for (let index = 0; index < this.padCount; index += 1) {
            const mapping = copyMapping(mappings[index] || {});
            const pad = this.createPad(mapping || {});
            this.pads.push(pad);
            grid.appendChild(pad.wrapper);
        }

        // Notify initial mapping state
        this.notifyMappingChange();
    }

    createPad(mapping = {}) {
        const padId = mapping.id || `pad-${this.pads.length + 1}`;
        const label = mapping.label || `Pad ${this.pads.length + 1}`;

        const wrapper = document.createElement('article');
        wrapper.className = 'touchpad-card';

        const header = document.createElement('header');
        header.className = 'touchpad-card__header';
        header.innerHTML = `
            <h4>${label}</h4>
            <span class="touchpad-card__status" data-role="status">Ready</span>
        `;

        const padSurface = document.createElement('div');
        padSurface.className = 'touchpad-surface';
        padSurface.setAttribute('data-pad-id', padId);

        const indicator = document.createElement('div');
        indicator.className = 'touchpad-indicator';
        padSurface.appendChild(indicator);

        const controls = document.createElement('div');
        controls.className = 'touchpad-controls';

        const xSelect = this.createParameterSelect('X Axis', mapping.xParam || '', (value) => {
            padState.mapping.xParam = value || '';
            this.notifyMappingChange();
        });
        const ySelect = this.createParameterSelect('Y Axis', mapping.yParam || '', (value) => {
            padState.mapping.yParam = value || '';
            this.notifyMappingChange();
        });
        const gestureSelect = this.createParameterSelect('Spread', mapping.spreadParam || '', (value) => {
            padState.mapping.spreadParam = value || '';
            this.notifyMappingChange();
        }, { allowNone: true, placeholder: 'None' });

        const axisRow = document.createElement('div');
        axisRow.className = 'touchpad-controls__row';
        axisRow.appendChild(xSelect.wrapper);
        axisRow.appendChild(ySelect.wrapper);

        const gestureRow = document.createElement('div');
        gestureRow.className = 'touchpad-controls__row';
        gestureRow.appendChild(gestureSelect.wrapper);

        const invertRow = document.createElement('div');
        invertRow.className = 'touchpad-controls__row touchpad-controls__row--toggles';
        const invertXToggle = this.createToggle('Invert X', Boolean(mapping.invertX), (checked) => {
            padState.mapping.invertX = checked;
        });
        const invertYToggle = this.createToggle('Invert Y', Boolean(mapping.invertY), (checked) => {
            padState.mapping.invertY = checked;
        });
        const swapButton = document.createElement('button');
        swapButton.type = 'button';
        swapButton.className = 'touchpad-swap';
        swapButton.textContent = 'Swap Axes';
        swapButton.addEventListener('click', () => {
            const { xParam, yParam } = padState.mapping;
            padState.mapping.xParam = yParam;
            padState.mapping.yParam = xParam;
            xSelect.select.value = padState.mapping.xParam || '';
            ySelect.select.value = padState.mapping.yParam || '';
            this.notifyMappingChange();
        });

        invertRow.appendChild(invertXToggle.wrapper);
        invertRow.appendChild(invertYToggle.wrapper);
        invertRow.appendChild(swapButton);

        controls.appendChild(axisRow);
        controls.appendChild(gestureRow);
        controls.appendChild(invertRow);

        wrapper.appendChild(header);
        wrapper.appendChild(padSurface);
        wrapper.appendChild(controls);

        const pointerState = new Map();

        const padState = {
            id: padId,
            label,
            wrapper,
            header,
            surface: padSurface,
            indicator,
            statusEl: header.querySelector('[data-role="status"]'),
            mapping: {
                id: padId,
                label,
                xParam: mapping.xParam || '',
                yParam: mapping.yParam || '',
                spreadParam: mapping.spreadParam || '',
                invertX: Boolean(mapping.invertX),
                invertY: Boolean(mapping.invertY)
            },
            pointerState
        };

        this.bindPadEvents(padState);
        return padState;
    }

    createParameterSelect(label, value, onChange, { allowNone = false, placeholder = 'Select parameter' } = {}) {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-select';
        const span = document.createElement('span');
        span.textContent = label;
        const select = document.createElement('select');

        const options = [];
        if (allowNone) {
            options.push({ id: '', label: placeholder });
        }

        this.parameterOptions.forEach(option => {
            options.push({ id: option.id, label: option.label });
        });

        select.innerHTML = options.map(option => {
            const selected = option.id === value ? ' selected' : '';
            const disabled = option.id === '' && !allowNone ? ' disabled' : '';
            return `<option value="${option.id}"${selected}${disabled}>${option.label}</option>`;
        }).join('');

        select.value = value || '';
        select.addEventListener('change', () => {
            onChange(select.value);
        });

        wrapper.appendChild(span);
        wrapper.appendChild(select);
        return { wrapper, select };
    }

    createToggle(label, checked, onChange) {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        input.addEventListener('change', () => onChange(input.checked));
        const span = document.createElement('span');
        span.textContent = label;
        wrapper.appendChild(input);
        wrapper.appendChild(span);
        return { wrapper, input };
    }

    bindPadEvents(pad) {
        const handlePointerDown = (event) => {
            event.preventDefault();
            pad.surface.setPointerCapture(event.pointerId);
            pad.pointerState.set(event.pointerId, this.normalizePointer(event, pad.surface));
            this.updatePadFromPointers(pad);
        };

        const handlePointerMove = (event) => {
            if (!pad.pointerState.has(event.pointerId)) return;
            pad.pointerState.set(event.pointerId, this.normalizePointer(event, pad.surface));
            this.updatePadFromPointers(pad);
        };

        const handlePointerUp = (event) => {
            pad.pointerState.delete(event.pointerId);
            this.updatePadFromPointers(pad);
        };

        const handleLeave = () => {
            pad.pointerState.clear();
            this.updatePadFromPointers(pad);
        };

        pad.surface.addEventListener('pointerdown', handlePointerDown);
        pad.surface.addEventListener('pointermove', handlePointerMove);
        pad.surface.addEventListener('pointerup', handlePointerUp);
        pad.surface.addEventListener('pointercancel', handlePointerUp);
        pad.surface.addEventListener('pointerleave', handleLeave);

        pad.cleanup = () => {
            pad.surface.removeEventListener('pointerdown', handlePointerDown);
            pad.surface.removeEventListener('pointermove', handlePointerMove);
            pad.surface.removeEventListener('pointerup', handlePointerUp);
            pad.surface.removeEventListener('pointercancel', handlePointerUp);
            pad.surface.removeEventListener('pointerleave', handleLeave);
        };
    }

    normalizePointer(event, element) {
        const rect = element.getBoundingClientRect();
        const x = clamp01((event.clientX - rect.left) / rect.width);
        const y = clamp01((event.clientY - rect.top) / rect.height);
        return { x, y, pointerId: event.pointerId };
    }

    updatePadFromPointers(pad) {
        const pointers = Array.from(pad.pointerState.values());
        const pointerCount = pointers.length;
        const statusLabel = pointerCount > 0 ? `${pointerCount} touch${pointerCount > 1 ? 'es' : ''}` : 'Ready';
        if (pad.statusEl) {
            pad.statusEl.textContent = statusLabel;
        }

        if (pointerCount === 0) {
            pad.indicator.style.opacity = '0';
            return;
        }

        const centroid = pointers.reduce((acc, pointer) => {
            acc.x += pointer.x;
            acc.y += pointer.y;
            return acc;
        }, { x: 0, y: 0 });

        centroid.x /= pointerCount;
        centroid.y /= pointerCount;

        pad.indicator.style.opacity = '1';
        pad.indicator.style.transform = `translate(${centroid.x * 100}%, ${centroid.y * 100}%)`;

        const { mapping } = pad;
        if (!this.parameterManager) return;

        if (mapping.xParam) {
            this.applyAxisValue(mapping.xParam, centroid.x, mapping.invertX, 'touchpad-x');
        }
        if (mapping.yParam) {
            this.applyAxisValue(mapping.yParam, centroid.y, mapping.invertY, 'touchpad-y');
        }
        if (mapping.spreadParam && pointerCount > 1) {
            const spreadValue = this.calculateSpreadValue(pointers);
            this.applyAxisValue(mapping.spreadParam, spreadValue, false, 'touchpad-gesture');
        }

        if (this.hub) {
            this.hub.emit('touchpad-input', {
                padId: mapping.id,
                centroid,
                pointerCount,
                mapping: { ...mapping }
            });
        }
    }

    calculateSpreadValue(pointers) {
        if (pointers.length < 2) return 0;
        const [first, second] = pointers;
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return clamp01(distance * Math.SQRT2); // Normalize diagonal distance
    }

    applyAxisValue(parameterName, normalizedValue, invert, source) {
        if (!this.parameterManager) return;
        const def = this.parameterManager.getParameterDefinition(parameterName);
        if (!def) return;

        const adjusted = invert ? 1 - normalizedValue : normalizedValue;
        const value = def.min + (def.max - def.min) * clamp01(adjusted);
        this.parameterManager.setParameter(parameterName, value, source || 'touchpad');
    }

    notifyMappingChange() {
        const mappings = this.getMappings();
        this.onMappingChange(mappings);
        if (this.hub) {
            this.hub.emit('touchpad-mapping-change', { mappings });
        }
    }

    getMappings() {
        return this.pads.map(pad => ({ ...pad.mapping }));
    }

    applyMappings(mappings = []) {
        if (!Array.isArray(mappings) || mappings.length === 0) return;
        mappings.forEach((mapping, index) => {
            const pad = this.pads[index];
            if (!pad) return;

            pad.mapping = {
                ...pad.mapping,
                ...mapping
            };

            const selects = pad.wrapper.querySelectorAll('select');
            if (selects[0]) selects[0].value = pad.mapping.xParam || '';
            if (selects[1]) selects[1].value = pad.mapping.yParam || '';
            if (selects[2]) selects[2].value = pad.mapping.spreadParam || '';

            const toggles = pad.wrapper.querySelectorAll('.touchpad-toggle input[type="checkbox"]');
            if (toggles[0]) toggles[0].checked = Boolean(pad.mapping.invertX);
            if (toggles[1]) toggles[1].checked = Boolean(pad.mapping.invertY);
        });

        this.notifyMappingChange();
    }

    destroy() {
        this.pads.forEach(pad => {
            if (pad.cleanup) pad.cleanup();
        });
        this.pads = [];
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
