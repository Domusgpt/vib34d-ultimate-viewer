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
        expect(registeredPack.validation).toBeTruthy();
        expect(registeredPack.validation?.status).toBe('warning');

        catalog.applyToSimulator(simulator);
        const scenario = simulator.getScenario('test-scenario');
        expect(scenario).toBeTruthy();
        expect(scenario?.metadata?.packId).toBe('test-pack');
    });

    it('removes scenarios and reflects updated list', () => {
        catalog.registerScenario(sampleScenario);
        const registered = catalog.getScenario('test-scenario');
        expect(registered).toBeTruthy();
        expect(registered?.metadata?.validation?.status).toBe('warning');
        catalog.removeScenario('test-scenario');
        expect(catalog.getScenario('test-scenario')).toBeNull();
    });

    it('creates standalone catalog instances', () => {
        const standalone = new ProjectionScenarioCatalog({ includeDefaults: false });
        expect(standalone.listScenarios()).toHaveLength(0);
        standalone.registerScenario(sampleScenario);
        expect(standalone.listScenarios()).toHaveLength(1);
    });

    it('sanitizes out-of-range values and reports validation issues', () => {
        const scenario = catalog.registerScenario({
            id: 'extreme-values',
            cycleMs: 4200,
            blueprint: { intensity: 1.6, focusVector: { x: -0.4, y: 1.4, depth: 0.5 } },
            context: { gazeVelocity: -0.5, gestureIntent: { intensity: 1.8, vector: { x: -0.3, y: 1.5, z: 0.2 } } }
        });
        expect(scenario.blueprint.intensity).toBeLessThanOrEqual(1);
        expect(scenario.context.gazeVelocity).toBeGreaterThanOrEqual(0);
        expect(scenario.metadata.validation).toMatchObject({ status: 'warning', issueCount: expect.any(Number) });
        expect(scenario.metadata.validation.issues.length).toBeGreaterThan(0);
    });
});
