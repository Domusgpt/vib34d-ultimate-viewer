/**
 * ShaderQuaternionDiagnosticsOverlay
 * ------------------------------------------------------------
 * Lightweight diagnostic overlay that visualises quaternion-driven updates
 * flowing through the ShaderQuaternionSynchronizer. Renders Euler angles,
 * motion energy, confidence, and the most recent parameter writes for each
 * shader system so designers can correlate spatial localisation with the
 * faceted/quantum/holographic pipelines in real time.
 */

const DEG_PER_RAD = 180 / Math.PI;

let stylesInjected = false;

const ensureStyles = doc => {
    if (stylesInjected || !doc?.head) {
        return;
    }
    const style = doc.createElement('style');
    style.dataset.shaderQuaternionOverlay = 'true';
    style.textContent = `
        .shader-quaternion-overlay {
            position: absolute;
            bottom: 16px;
            right: 16px;
            min-width: 260px;
            max-width: 360px;
            padding: 12px 16px;
            border-radius: 12px;
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(14px);
            z-index: 9999;
        }
        .shader-quaternion-overlay--dark {
            background: rgba(6, 10, 26, 0.86);
            color: #f3f5ff;
            border: 1px solid rgba(102, 126, 255, 0.25);
        }
        .shader-quaternion-overlay--light {
            background: rgba(242, 246, 255, 0.92);
            color: #101322;
            border: 1px solid rgba(16, 19, 34, 0.12);
        }
        .shader-q-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        .shader-q-meta {
            font-size: 11px;
            opacity: 0.75;
        }
        .shader-q-orientation {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px 8px;
            margin-bottom: 10px;
        }
        .shader-q-metric {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .shader-q-metric .label {
            text-transform: uppercase;
            font-size: 10px;
            opacity: 0.6;
        }
        .shader-q-metric .value {
            font-weight: 600;
            font-size: 12px;
        }
        .shader-q-system-row {
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr);
            gap: 8px;
            align-items: start;
            padding: 6px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .shader-quaternion-overlay--light .shader-q-system-row {
            border-top-color: rgba(16, 19, 34, 0.08);
        }
        .shader-q-system-row:first-of-type {
            border-top: none;
        }
        .shader-q-system-name {
            text-transform: uppercase;
            font-weight: 600;
            font-size: 11px;
            opacity: 0.7;
        }
        .shader-q-system-params {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .shader-q-param {
            padding: 2px 6px;
            border-radius: 8px;
            background: rgba(102, 126, 255, 0.18);
            color: inherit;
        }
        .shader-quaternion-overlay--light .shader-q-param {
            background: rgba(16, 19, 34, 0.08);
        }
    `;
    doc.head.appendChild(style);
    stylesInjected = true;
};

const formatNumber = (value, { decimals = 2, clamp } = {}) => {
    let next = Number(value);
    if (!Number.isFinite(next)) {
        return '0.00';
    }
    if (typeof clamp === 'object' && clamp) {
        const { min = -Infinity, max = Infinity } = clamp;
        next = Math.min(max, Math.max(min, next));
    }
    return next.toFixed(decimals);
};

const resolveContainer = (doc, target) => {
    if (!target) {
        return doc?.body || null;
    }
    if (typeof target === 'string') {
        return doc?.querySelector?.(target) || null;
    }
    if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
        return target;
    }
    return null;
};

export class ShaderQuaternionDiagnosticsOverlay {
    constructor(options = {}) {
        const {
            synchronizer,
            container,
            document: providedDocument,
            theme = 'dark',
            format = {}
        } = options;

        if (!synchronizer || typeof synchronizer.addObserver !== 'function') {
            throw new Error('ShaderQuaternionDiagnosticsOverlay requires a ShaderQuaternionSynchronizer instance');
        }

        this.synchronizer = synchronizer;
        this.document = providedDocument || (typeof document !== 'undefined' ? document : null);
        this.container = resolveContainer(this.document, container);
        this.theme = theme;
        this.format = {
            angleDecimals: typeof format.angleDecimals === 'number' ? format.angleDecimals : 1,
            energyDecimals: typeof format.energyDecimals === 'number' ? format.energyDecimals : 2,
            confidenceDecimals: typeof format.confidenceDecimals === 'number' ? format.confidenceDecimals : 2
        };

        this.root = null;
        this.rows = new Map();
        this.unsubscribe = null;
        this.lastPayload = null;
    }

    mount() {
        if (!this.document || !this.container) {
            return this;
        }
        ensureStyles(this.document);
        this.unmount();

        const root = this.document.createElement('section');
        root.className = `shader-quaternion-overlay shader-quaternion-overlay--${this.theme}`;
        root.dataset.testid = 'shader-quaternion-overlay';
        root.innerHTML = `
            <header class="shader-q-header">
                <span class="shader-q-title">Quaternion Spatial Diagnostics</span>
                <span class="shader-q-meta" data-testid="shader-q-source">–</span>
            </header>
            <div class="shader-q-orientation">
                <div class="shader-q-metric"><span class="label">Yaw</span><span class="value" data-testid="shader-q-yaw">0.0°</span></div>
                <div class="shader-q-metric"><span class="label">Pitch</span><span class="value" data-testid="shader-q-pitch">0.0°</span></div>
                <div class="shader-q-metric"><span class="label">Roll</span><span class="value" data-testid="shader-q-roll">0.0°</span></div>
                <div class="shader-q-metric"><span class="label">Motion</span><span class="value" data-testid="shader-q-motion">0.00</span></div>
                <div class="shader-q-metric"><span class="label">Confidence</span><span class="value" data-testid="shader-q-confidence">0.00</span></div>
            </div>
            <div class="shader-q-systems" data-testid="shader-q-systems"></div>
        `;

        this.container.appendChild(root);
        this.root = root;

        this.unsubscribe = this.synchronizer.addObserver(payload => {
            this.lastPayload = payload;
            this.render(payload);
        });

        if (this.lastPayload) {
            this.render(this.lastPayload);
        }

        return this;
    }

    unmount() {
        if (typeof this.unsubscribe === 'function') {
            try {
                this.unsubscribe();
            } catch (error) {
                // ignore
            }
        }
        this.unsubscribe = null;
        this.rows.clear();
        if (this.root?.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
        this.root = null;
    }

    render(payload) {
        if (!this.root || !payload) {
            return;
        }

        const { euler = {}, motionEnergy = 0, confidence = 0, source, systems = [] } = payload;

        const yaw = this.root.querySelector('[data-testid="shader-q-yaw"]');
        const pitch = this.root.querySelector('[data-testid="shader-q-pitch"]');
        const roll = this.root.querySelector('[data-testid="shader-q-roll"]');
        const motion = this.root.querySelector('[data-testid="shader-q-motion"]');
        const confidenceNode = this.root.querySelector('[data-testid="shader-q-confidence"]');
        const sourceNode = this.root.querySelector('[data-testid="shader-q-source"]');

        if (yaw) yaw.textContent = `${formatNumber((euler.yaw || 0) * DEG_PER_RAD, { decimals: this.format.angleDecimals })}°`;
        if (pitch) pitch.textContent = `${formatNumber((euler.pitch || 0) * DEG_PER_RAD, { decimals: this.format.angleDecimals })}°`;
        if (roll) roll.textContent = `${formatNumber((euler.roll || 0) * DEG_PER_RAD, { decimals: this.format.angleDecimals })}°`;
        if (motion) motion.textContent = formatNumber(motionEnergy, { decimals: this.format.energyDecimals, clamp: { min: 0, max: 1 } });
        if (confidenceNode) confidenceNode.textContent = formatNumber(confidence, { decimals: this.format.confidenceDecimals, clamp: { min: 0, max: 1 } });
        if (sourceNode) sourceNode.textContent = source ? String(source) : '–';

        const container = this.root.querySelector('[data-testid="shader-q-systems"]');
        if (!container) {
            return;
        }

        for (const system of systems) {
            const { system: name, parameters = {} } = system || {};
            if (!name) continue;

            let row = this.rows.get(name);
            if (!row) {
                row = this.document.createElement('div');
                row.className = 'shader-q-system-row';
                row.dataset.system = name;
                row.innerHTML = `
                    <div class="shader-q-system-name">${name}</div>
                    <div class="shader-q-system-params" data-testid="shader-q-params-${name}"></div>
                `;
                container.appendChild(row);
                this.rows.set(name, row);
            }

            const paramsContainer = row.querySelector(`[data-testid="shader-q-params-${name}"]`);
            if (!paramsContainer) continue;

            paramsContainer.innerHTML = '';
            for (const [param, value] of Object.entries(parameters)) {
                const pill = this.document.createElement('span');
                pill.className = 'shader-q-param';
                pill.textContent = `${param}: ${formatNumber(value, { decimals: this.format.energyDecimals })}`;
                paramsContainer.appendChild(pill);
            }
        }
    }
}

export default ShaderQuaternionDiagnosticsOverlay;
