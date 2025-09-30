export function getParameterOptionGroups(parameterManager, options = {}) {
    if (!parameterManager) return [];

    const descriptors = typeof parameterManager.listParameterDescriptors === 'function'
        ? parameterManager.listParameterDescriptors(options)
        : (parameterManager.listParameters?.() || []).map(name => ({
            name,
            label: parameterManager.formatParameterLabel
                ? parameterManager.formatParameterLabel(name)
                : formatFallbackLabel(name),
            category: 'General'
        }));

    const groups = new Map();
    descriptors.forEach(descriptor => {
        const category = descriptor.category || 'General';
        if (!groups.has(category)) {
            groups.set(category, []);
        }
        groups.get(category).push({
            value: descriptor.name,
            label: descriptor.label,
            descriptor
        });
    });

    return Array.from(groups.entries())
        .map(([category, options]) => ({
            category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        }))
        .sort((a, b) => a.category.localeCompare(b.category));
}

export function ensureOption(selectElement, value, label) {
    if (!selectElement || value == null) return;
    const exists = Array.from(selectElement.options).some(option => option.value === String(value));
    if (!exists) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label || value;
        selectElement.appendChild(option);
    }
}

export function populateSelectWithOptions(selectElement, groups, { allowNone = false, noneLabel = 'None' } = {}) {
    if (!selectElement) return;
    selectElement.innerHTML = '';

    if (allowNone) {
        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = noneLabel;
        selectElement.appendChild(noneOption);
    }

    groups.forEach(group => {
        if (group.options.length === 0) return;

        if (groups.length > 1) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.category;
            group.options.forEach(optionData => {
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                optgroup.appendChild(option);
            });
            selectElement.appendChild(optgroup);
        } else {
            group.options.forEach(optionData => {
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                selectElement.appendChild(option);
            });
        }
    });
}

function formatFallbackLabel(name) {
    return name
        .replace(/rot4d/, '4D ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, char => char.toUpperCase())
        .trim();
}
