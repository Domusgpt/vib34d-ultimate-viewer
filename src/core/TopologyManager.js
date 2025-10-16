/**
 * TopologyManager
 * ---------------------------------------------------
 * Coordinates topology selections that sit above the
 * base geometry layer. The manager encapsulates all
 * resolution logic so multiple systems can stay in sync
 * without duplicating calls into the topology library.
 */

import { TopologyLibrary } from './TopologyLibrary.js';

export class TopologyManager {
    constructor(initialGeometry = 0) {
        const parsedGeometry = Number(initialGeometry);
        this.geometryIndex = Math.round(Number.isFinite(parsedGeometry) ? parsedGeometry : 0);
        this.familyId = TopologyLibrary.resolveFamily(null, this.geometryIndex);
        this.variantId = TopologyLibrary.getDefaultVariantId(this.familyId);
        this.shellWidth = 0.0;
        this.planeThickness = 0.0;
        this.applyDefaults();
    }

    applyDefaults() {
        const defaults = TopologyLibrary.getDefaults(this.familyId, this.variantId);
        this.shellWidth = defaults.shellWidth;
        this.planeThickness = defaults.planeThickness;
    }

    getState() {
        return {
            family: this.familyId,
            variant: this.variantId,
            shellWidth: this.shellWidth,
            planeThickness: this.planeThickness
        };
    }

    getUniformPayload() {
        return {
            u_topologyFamily: this.familyId,
            u_topologyVariant: this.variantId,
            u_topologyShellWidth: this.shellWidth,
            u_topologyPlaneThickness: this.planeThickness
        };
    }

    setFamily(familyId) {
        const resolved = TopologyLibrary.resolveFamily(familyId, this.geometryIndex);
        if (resolved === this.familyId) {
            return false;
        }

        this.familyId = resolved;
        this.variantId = TopologyLibrary.getDefaultVariantId(this.familyId);
        this.applyDefaults();
        return true;
    }

    setVariant(variantId) {
        const resolved = TopologyLibrary.resolveVariant(this.familyId, variantId);
        if (resolved === this.variantId) {
            // Even if the variant is unchanged, refresh defaults so callers can resync state
            this.applyDefaults();
            return false;
        }

        this.variantId = resolved;
        this.applyDefaults();
        return true;
    }

    setGeometry(geometryIndex) {
        if (!Number.isFinite(geometryIndex)) {
            return false;
        }

        const rounded = Math.round(geometryIndex);
        if (rounded === this.geometryIndex) {
            return this.ensureFamilyMatchesGeometry();
        }

        this.geometryIndex = rounded;
        return this.ensureFamilyMatchesGeometry(true);
    }

    ensureFamilyMatchesGeometry(force = false) {
        const matchingFamily = TopologyLibrary.getFamilyForGeometry(this.geometryIndex);
        if (matchingFamily === null || matchingFamily === undefined) {
            return false;
        }

        if (!force && matchingFamily === this.familyId) {
            return false;
        }

        this.familyId = matchingFamily;
        this.variantId = TopologyLibrary.getDefaultVariantId(this.familyId);
        this.applyDefaults();
        return true;
    }

    getFamilies() {
        return TopologyLibrary.getFamilyEntries();
    }

    getVariants(familyId = this.familyId) {
        return TopologyLibrary.getVariantEntries(familyId);
    }

    getVariantsForGeometry(geometryIndex) {
        const familyId = TopologyLibrary.getFamilyForGeometry(Math.round(geometryIndex));
        if (familyId === null || familyId === undefined) {
            return [];
        }
        return TopologyLibrary.getVariantEntries(familyId);
    }
}

export default TopologyManager;
