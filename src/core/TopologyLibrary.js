/**
 * GeometryTopologyLibrary
 * ---------------------------------------------
 * Provides a topological abstraction layer that sits above the base geometry
 * system. Each topology family maps to one of the core geometries (hypertetra-
 * hedron, hypercube, hypersphere) and exposes curated variants with sensible
 * defaults so callers can swap behaviours without knowing shader internals.
 */

export class TopologyLibrary {
    static FAMILIES = [
        {
            id: 0,
            key: 'HYPERCUBE',
            label: 'Hypercube',
            geometryIndex: 1,
            description: 'Topological variations of the original hypercube die.',
            variants: [
                {
                    id: 0,
                    key: 'CLASSIC',
                    label: 'Classic Lattice',
                    description: 'Original faceted hypercube lattice with even spacing.',
                    defaults: {
                        shellWidth: 0.04,
                        planeThickness: 0.05
                    }
                },
                {
                    id: 1,
                    key: 'PHASED',
                    label: 'Phase Shift Grid',
                    description: 'Alternating phase offsets to create flowing edges.',
                    defaults: {
                        shellWidth: 0.03,
                        planeThickness: 0.04
                    }
                },
                {
                    id: 2,
                    key: 'CRYSTAL',
                    label: 'Crystal Hyperframe',
                    description: 'Sharper contrast with thinner walls for crystalline light.',
                    defaults: {
                        shellWidth: 0.02,
                        planeThickness: 0.03
                    }
                }
            ]
        },
        {
            id: 1,
            key: 'HYPERSPHERE',
            label: 'Hypersphere',
            geometryIndex: 2,
            description: 'Shell-based hypersphere behaviours layered above the sphere.',
            variants: [
                {
                    id: 0,
                    key: 'CLASSIC',
                    label: 'Classic Hypersphere',
                    description: 'Legacy harmonic shells used by the sphere lattice.',
                    defaults: {
                        shellWidth: 0.035,
                        planeThickness: 0.045
                    }
                },
                {
                    id: 1,
                    key: 'QUANTUM_SHELLS',
                    label: 'Quantum Shell Resonance',
                    description: 'Time-shifted concentric shells with 4D phase blending.',
                    defaults: {
                        shellWidth: 0.02,
                        planeThickness: 0.04
                    }
                },
                {
                    id: 2,
                    key: 'TETRAHEDRAL_CRYSTAL',
                    label: 'Hypertetrahedral Crystal',
                    description: 'Interlocking tetrahedral planes projected through 4D space.',
                    defaults: {
                        shellWidth: 0.03,
                        planeThickness: 0.025
                    }
                }
            ]
        },
        {
            id: 2,
            key: 'HYPERTETRAHEDRON',
            label: 'Hypertetrahedron',
            geometryIndex: 0,
            description: 'Tetrahedral die variations with dynamic 4D phase lattices.',
            variants: [
                {
                    id: 0,
                    key: 'CLASSIC',
                    label: 'Classic Facets',
                    description: 'Legacy tetrahedral facets with uniform plane spacing.',
                    defaults: {
                        shellWidth: 0.045,
                        planeThickness: 0.05
                    }
                },
                {
                    id: 1,
                    key: 'TWISTED',
                    label: 'Twisted Lattice',
                    description: 'Phase twisted tetrahedral lattice for smoother ribbons.',
                    defaults: {
                        shellWidth: 0.035,
                        planeThickness: 0.04
                    }
                },
                {
                    id: 2,
                    key: 'PRISMATIC',
                    label: 'Prismatic Shells',
                    description: 'Prismatic planes with thinner shells for higher contrast.',
                    defaults: {
                        shellWidth: 0.025,
                        planeThickness: 0.03
                    }
                }
            ]
        }
    ];

    static getFamilies() {
        return this.FAMILIES.map(family => ({
            ...family,
            variants: family.variants.map(variant => ({ ...variant }))
        }));
    }

    static getFamilyEntries() {
        return this.getFamilies();
    }

    static getFamilyById(familyId) {
        return this.FAMILIES.find(family => family.id === familyId);
    }

    static getFamilyByKey(key) {
        if (!key) return undefined;
        return this.FAMILIES.find(family => family.key === String(key).toUpperCase());
    }

    static getFamilyForGeometry(geometryIndex) {
        const match = this.FAMILIES.find(family => family.geometryIndex === geometryIndex);
        return match ? match.id : null;
    }

    static getVariantEntries(familyId) {
        const family = this.getFamilyById(familyId);
        if (!family) {
            return [];
        }
        return family.variants.map(variant => ({ ...variant }));
    }

    static getDefaultVariantId(familyId) {
        const family = this.getFamilyById(familyId);
        if (!family || family.variants.length === 0) {
            return 0;
        }
        return family.variants[0].id;
    }

    static resolveFamily(family, geometryIndex = null) {
        if (typeof family === 'string') {
            const fromKey = this.getFamilyByKey(family);
            if (fromKey) {
                return fromKey.id;
            }
        }

        if (typeof family === 'number' && Number.isFinite(family)) {
            const rounded = Math.round(family);
            const clamped = Math.max(0, Math.min(this.FAMILIES.length - 1, rounded));
            return this.FAMILIES[clamped].id;
        }

        if (geometryIndex !== null && geometryIndex !== undefined) {
            const byGeometry = this.getFamilyForGeometry(geometryIndex);
            if (byGeometry !== null) {
                return byGeometry;
            }
        }

        return this.FAMILIES[0].id;
    }

    static resolveVariant(familyId, variant) {
        const family = this.getFamilyById(familyId);
        if (!family || family.variants.length === 0) {
            return 0;
        }

        if (typeof variant === 'string') {
            const match = family.variants.find(entry => entry.key === variant.toUpperCase());
            if (match) {
                return match.id;
            }
        }

        if (typeof variant === 'number' && Number.isFinite(variant)) {
            const rounded = Math.round(variant);
            const clamped = Math.max(0, Math.min(family.variants.length - 1, rounded));
            return family.variants[clamped].id;
        }

        return family.variants[0].id;
    }

    static getDefaults(familyId, variantId) {
        const family = this.getFamilyById(familyId);
        if (!family) {
            return { shellWidth: 0.03, planeThickness: 0.04 };
        }

        const variant = family.variants.find(entry => entry.id === variantId) || family.variants[0];
        return { ...variant.defaults };
    }

    static getVariantLabel(familyId, variantId) {
        const family = this.getFamilyById(familyId);
        if (!family) {
            return '';
        }
        const variant = family.variants.find(entry => entry.id === variantId);
        return variant ? variant.label : '';
    }

    static getVariantDescription(familyId, variantId) {
        const family = this.getFamilyById(familyId);
        if (!family) {
            return '';
        }
        const variant = family.variants.find(entry => entry.id === variantId);
        return variant ? variant.description : '';
    }

    static getMaxVariantCount() {
        return this.FAMILIES.reduce((max, family) => Math.max(max, family.variants.length), 0);
    }
}

export default TopologyLibrary;
