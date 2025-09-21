let TARGET_ID = 0;

export class SpawnSystem {
    constructor({ geometryController, audioService, difficulty = 1.0 }) {
        this.geometryController = geometryController;
        this.audioService = audioService;
        this.difficulty = difficulty;
        this.activeTargets = [];
        this.beatCount = 0;
        this.listeners = { spawn: new Set(), resolve: new Set(), miss: new Set() };
        this.spawnOverrides = {};
    }

    initialize() {
        if (this.audioService) {
            this.audioService.onBeat(() => this.handleBeat());
        }
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].add(callback);
        }
        return () => this.listeners[event]?.delete(callback);
    }

    emit(event, payload) {
        this.listeners[event]?.forEach(cb => cb(payload));
    }

    handleBeat() {
        const spawns = this.geometryController.generateSpawn(
            this.beatCount,
            this.difficulty,
            this.spawnOverrides
        );
        spawns.forEach(spawn => {
            const target = {
                ...spawn,
                id: TARGET_ID++,
                age: 0,
                captured: false
            };
            this.activeTargets.push(target);
            this.emit('spawn', target);
        });
        this.beatCount += 1;
    }

    update(dt) {
        this.activeTargets = this.activeTargets.filter(target => {
            target.age += dt;
            if (target.age > target.lifespan) {
                this.emit('miss', target);
                return false;
            }

            this.advanceTarget(target, dt);
            return true;
        });
    }

    advanceTarget(target, dt) {
        switch (target.type) {
            case 'node':
                target.radius *= 0.995;
                target.y -= dt * target.speed * 0.2;
                break;
            case 'belt':
                target.x += dt * target.speed * target.direction * 0.6;
                if (target.x < 0.1 || target.x > 0.9) {
                    target.direction *= -1;
                }
                break;
            case 'orb':
                target.orbitAngle = (target.orbitAngle || 0) + dt * target.orbitSpeed;
                const angle = target.orbitAngle;
                target.x = 0.5 + Math.cos(angle) * target.orbitRadius * 0.5;
                target.y = 0.5 + Math.sin(angle) * target.orbitRadius * 0.5;
                break;
            case 'ring':
                target.x += dt * target.speed * target.direction;
                if (target.x < 0.1 || target.x > 0.9) {
                    target.direction *= -1;
                }
                break;
            case 'arc':
                target.rotationAngle = (target.rotationAngle || 0) + dt * target.rotationSpeed;
                target.x = 0.5 + Math.sin(target.rotationAngle) * 0.3;
                target.y = 0.5 + Math.cos(target.rotationAngle) * 0.2;
                break;
            case 'chain':
                target.y += Math.sin((target.age + target.x) * 3.1) * dt * 0.2;
                break;
            case 'wave':
                target.x += dt * target.speed;
                target.y = 0.2 + Math.sin(target.wavePhase + target.age * target.waveFrequency) * target.waveAmplitude;
                break;
            case 'shard':
                target.x += dt * target.speed * target.direction;
                target.y -= dt * target.speed * 0.5;
                break;
            default:
                break;
        }
    }

    resolveTarget(id) {
        const index = this.activeTargets.findIndex(target => target.id === id);
        if (index >= 0) {
            const [target] = this.activeTargets.splice(index, 1);
            target.captured = true;
            this.emit('resolve', target);
            return target;
        }
        return null;
    }

    getTargets() {
        return this.activeTargets;
    }

    configure({ difficulty, spawn } = {}) {
        if (typeof difficulty === 'number') {
            this.difficulty = difficulty;
        }
        if (spawn) {
            this.spawnOverrides = {
                pattern: spawn.pattern,
                density: spawn.density
            };
        }
    }
}
