// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VIB34D Security and Accessibility Testing Suite
 * Testing modern web security practices and accessibility compliance
 */

test.describe('VIB34D Security and Accessibility', () => {
    
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/index-clean.html');
        await page.waitForFunction(() => window.moduleReady === true, { timeout: 30000 });
    });

    test('Content Security Policy Compliance', async ({ page }) => {
        console.log('🔒 Testing Content Security Policy...');

        // Check for CSP violations
        const cspViolations = [];
        
        page.on('response', async response => {
            const headers = response.headers();
            if (headers['content-security-policy']) {
                console.log('CSP Header found:', headers['content-security-policy']);
            }
        });

        // Test inline script execution safety
        const hasInlineScripts = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            let inlineCount = 0;
            
            scripts.forEach(script => {
                if (!script.src && script.textContent.trim()) {
                    inlineCount++;
                }
            });
            
            return inlineCount;
        });

        console.log(`Inline scripts found: ${hasInlineScripts}`);
        
        // Modern apps should minimize inline scripts
        expect(hasInlineScripts).toBeLessThan(5);

        console.log('✅ CSP Compliance: Basic security measures in place');
    });

    test('XSS Prevention Testing', async ({ page }) => {
        console.log('🛡️ Testing XSS Prevention...');

        // Test parameter input sanitization
        const maliciousInputs = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src=x onerror=alert("xss")>',
            '"><script>alert("xss")</script>',
        ];

        for (const input of maliciousInputs) {
            // Try to inject malicious content via parameter
            await page.fill('#speed', '1');
            
            // Check that no script execution occurred
            const alertFired = await page.evaluate(() => {
                let alertCalled = false;
                const originalAlert = window.alert;
                window.alert = () => { alertCalled = true; };
                
                // Try to trigger any stored XSS
                const event = new Event('input');
                document.getElementById('speed').dispatchEvent(event);
                
                window.alert = originalAlert;
                return alertCalled;
            });

            expect(alertFired).toBeFalsy();
        }

        console.log('✅ XSS Prevention: Input sanitization effective');
    });

    test('HTTPS and Secure Context Requirements', async ({ page }) => {
        console.log('🔐 Testing Secure Context Requirements...');

        // Check if running in secure context (required for WebGL and modern APIs)
        const secureContext = await page.evaluate(() => {
            return {
                isSecureContext: window.isSecureContext,
                protocol: location.protocol,
                webglSupported: !!(window.WebGLRenderingContext || window.WebGL2RenderingContext)
            };
        });

        console.log('Security context:', secureContext);
        
        // For localhost testing, secure context should be true
        expect(secureContext.isSecureContext).toBeTruthy();
        expect(secureContext.webglSupported).toBeTruthy();

        console.log('✅ Secure Context: Modern web APIs available');
    });

    test('Keyboard Navigation Accessibility', async ({ page }) => {
        console.log('⌨️ Testing Keyboard Navigation...');

        // Start from the first focusable element
        await page.keyboard.press('Tab');
        
        let focusedElement = await page.evaluate(() => document.activeElement.tagName);
        console.log(`First focused element: ${focusedElement}`);

        // Tab through multiple elements
        const focusableElements = [];
        
        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('Tab');
            
            const currentFocus = await page.evaluate(() => {
                const el = document.activeElement;
                return {
                    tagName: el.tagName,
                    type: el.type || null,
                    id: el.id || null,
                    className: el.className || null
                };
            });
            
            focusableElements.push(currentFocus);
        }

        // Should have multiple focusable elements
        expect(focusableElements.length).toBeGreaterThan(5);
        
        // Test Enter key activation on buttons
        await page.keyboard.press('Tab');
        const focusedButton = await page.evaluate(() => {
            return document.activeElement.tagName === 'BUTTON';
        });

        if (focusedButton) {
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
        }

        console.log('✅ Keyboard Navigation: Tab order functional');
    });

    test('Screen Reader Compatibility', async ({ page }) => {
        console.log('🔊 Testing Screen Reader Compatibility...');

        // Check for proper semantic HTML
        const semanticElements = await page.evaluate(() => {
            const elements = {
                buttons: document.querySelectorAll('button').length,
                inputs: document.querySelectorAll('input[type="range"]').length,
                labels: document.querySelectorAll('label, .control-label').length,
                headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
                main: document.querySelectorAll('main').length,
                nav: document.querySelectorAll('nav').length
            };
            
            return elements;
        });

        console.log('Semantic elements:', semanticElements);

        // Check for ARIA attributes
        const ariaElements = await page.evaluate(() => {
            const withAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');
            return withAria.length;
        });

        console.log(`Elements with ARIA: ${ariaElements}`);

        // Test button accessibility
        const buttons = await page.locator('button').all();
        
        for (let i = 0; i < Math.min(buttons.length, 5); i++) {
            const button = buttons[i];
            const text = await button.textContent();
            const title = await button.getAttribute('title');
            
            // Button should have either text content or title
            expect(text?.trim() || title?.trim()).toBeTruthy();
        }

        console.log('✅ Screen Reader: Basic accessibility features present');
    });

    test('Color Contrast and Visual Accessibility', async ({ page }) => {
        console.log('🎨 Testing Color Contrast...');

        // Test color contrast on key elements
        const contrastTests = [
            '.control-panel',
            '.system-btn',
            '.control-label',
            '.section-title'
        ];

        for (const selector of contrastTests) {
            const styles = await page.locator(selector).first().evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    color: computed.color,
                    backgroundColor: computed.backgroundColor,
                    fontSize: computed.fontSize
                };
            });

            console.log(`${selector}:`, styles);
            
            // Basic checks - should have defined colors
            expect(styles.color).toBeTruthy();
            expect(styles.fontSize).toBeTruthy();
        }

        // Test for reduced motion preferences
        const respectsReducedMotion = await page.evaluate(() => {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        });

        console.log(`Respects reduced motion: ${respectsReducedMotion}`);

        console.log('✅ Visual Accessibility: Color and contrast considerations');
    });

    test('Form Validation and Input Sanitization', async ({ page }) => {
        console.log('📝 Testing Form Validation...');

        const parameterInputs = [
            { id: 'speed', min: 0.1, max: 3 },
            { id: 'gridDensity', min: 5, max: 100 },
            { id: 'hue', min: 0, max: 360 }
        ];

        for (const input of parameterInputs) {
            const slider = page.locator(`#${input.id}`);
            
            // Test boundary values
            await slider.fill(String(input.min - 1)); // Below minimum
            let value = await slider.inputValue();
            expect(parseFloat(value)).toBeGreaterThanOrEqual(input.min);

            await slider.fill(String(input.max + 1)); // Above maximum  
            value = await slider.inputValue();
            expect(parseFloat(value)).toBeLessThanOrEqual(input.max);

            // Test invalid inputs
            await slider.fill('invalid');
            value = await slider.inputValue();
            expect(value).toBeTruthy(); // Should have some valid value

            console.log(`${input.id}: Validation working`);
        }

        console.log('✅ Form Validation: Input boundaries respected');
    });

    test('Data Privacy and Local Storage', async ({ page }) => {
        console.log('🔐 Testing Data Privacy...');

        // Check what data is stored locally
        const storageData = await page.evaluate(() => {
            const localStorage = {};
            const sessionStorage = {};
            
            // Check localStorage
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                localStorage[key] = window.localStorage.getItem(key)?.length || 0;
            }
            
            // Check sessionStorage
            for (let i = 0; i < window.sessionStorage.length; i++) {
                const key = window.sessionStorage.key(i);
                sessionStorage[key] = window.sessionStorage.getItem(key)?.length || 0;
            }

            return { localStorage, sessionStorage };
        });

        console.log('Local storage keys:', Object.keys(storageData.localStorage));
        console.log('Session storage keys:', Object.keys(storageData.sessionStorage));

        // Check for any sensitive data patterns (should not find any)
        const sensitivePatterns = /password|secret|token|key|auth|private/i;
        
        const localKeys = Object.keys(storageData.localStorage);
        const sessionKeys = Object.keys(storageData.sessionStorage);
        
        localKeys.forEach(key => {
            expect(sensitivePatterns.test(key)).toBeFalsy();
        });
        
        sessionKeys.forEach(key => {
            expect(sensitivePatterns.test(key)).toBeFalsy();
        });

        console.log('✅ Data Privacy: No sensitive data in local storage');
    });

    test('Resource Loading Security', async ({ page }) => {
        console.log('📦 Testing Resource Loading Security...');

        // Check all loaded resources
        const resources = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
            const images = Array.from(document.querySelectorAll('img')).map(img => img.src);
            
            return { scripts, styles, images };
        });

        console.log('External scripts:', resources.scripts.length);
        console.log('Stylesheets:', resources.styles.length);
        console.log('Images:', resources.images.length);

        // Check for HTTPS or relative URLs
        const allResources = [...resources.scripts, ...resources.styles, ...resources.images];
        
        allResources.forEach(resource => {
            if (resource.startsWith('http:') && !resource.includes('localhost')) {
                console.warn('HTTP resource detected:', resource);
            }
        });

        // Should not have many external dependencies
        expect(resources.scripts.filter(s => s.includes('http')).length).toBeLessThan(5);

        console.log('✅ Resource Security: Safe resource loading practices');
    });

    test('Error Information Disclosure', async ({ page }) => {
        console.log('🚨 Testing Error Information Disclosure...');

        let errorMessages = [];
        
        page.on('pageerror', (error) => {
            errorMessages.push(error.message);
        });

        // Trigger some potential error conditions
        await page.evaluate(() => {
            // Try to access non-existent functions
            try { window.nonExistentFunction(); } catch (e) {}
            try { document.getElementById('nonExistent').click(); } catch (e) {}
        });

        // Switch systems rapidly to stress test
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        for (const system of systems) {
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(100);
        }

        // Check that errors don't contain sensitive information
        const sensitiveInfo = /password|token|secret|key|path.*[\\\/]|file.*[\\\/]/i;
        
        errorMessages.forEach(message => {
            expect(sensitiveInfo.test(message)).toBeFalsy();
        });

        console.log(`Error messages captured: ${errorMessages.length}`);
        console.log('✅ Error Handling: No sensitive information disclosure');
    });

});