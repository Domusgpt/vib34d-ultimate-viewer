import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectionScenarioCatalog, createProjectionScenarioCatalog, DEFAULT_PROJECTION_SCENARIOS } from '../../src/ui/adaptive/simulators/ProjectionScenarioCatalog.js';
import { ProjectionScenarioSimulator } from '../../src/ui/adaptive/simulators/ProjectionScenarioSimulator.js';

const sampleScenario = {
    id: 'test-scenario',
    name: 'Test Scenario',
    description: 'Custom scenario for catalog tests',
    cycleMs: 6400,
    modulation: { blueprint: { intensity: { start: 0.4, end: 0.7 } } }
};

const samplePack = {
    id: 'test-pack',
    name: 'Test Pack',
    description: 'Pack description',
    metadata: { tier: 'enterprise' },
    scenarios: [
        sampleScenario,
        {
            id: 'secondary',
            name: 'Secondary Scenario',
            cycleMs: 7200,
            modulation: { context: { gestureIntensity: { start: 0.2, end: 0.5 } } }
        }
    ]
};

describe('ProjectionScenarioCatalog', () => {
    let catalog;

    beforeEach(() => {
        catalog = createProjectionScenarioCatalog({ includeDefaults: true });
    });

    it('includes default scenarios and packs', () => {
        const scenarios = catalog.listScenarios();
        const packs = catalog.listScenarioPacks();
        expect(scenarios.length).toBeGreaterThanOrEqual(DEFAULT_PROJECTION_SCENARIOS.length);
        expect(packs.length).toBeGreaterThan(0);
    });

    it('registers custom packs and syncs to simulator', () => {
        const simulator = new ProjectionScenarioSimulator();
        catalog.applyToSimulator(simulator, { replaceExisting: true });

        const registeredPack = catalog.registerScenarioPack(samplePack);
        expect(registeredPack.scenarios).toContain('test-scenario');

        catalog.applyToSimulator(simulator);
        const scenario = simulator.getScenario('test-scenario');
        expect(scenario).toBeTruthy();
        expect(scenario?.metadata?.packId).toBe('test-pack');
    });

    it('removes scenarios and reflects updated list', () => {
        catalog.registerScenario(sampleScenario);
        expect(catalog.getScenario('test-scenario')).toBeTruthy();
        catalog.removeScenario('test-scenario');
        expect(catalog.getScenario('test-scenario')).toBeNull();
    });

    it('creates standalone catalog instances', () => {
        const standalone = new ProjectionScenarioCatalog({ includeDefaults: false });
        expect(standalone.listScenarios()).toHaveLength(0);
        standalone.registerScenario(sampleScenario);
        expect(standalone.listScenarios()).toHaveLength(1);
    });
});
