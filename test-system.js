// Quick system test to verify functionality
const puppeteer = require('puppeteer');

async function testSystem() {
    console.log('🧪 Starting VIB34D system test...');
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: { width: 1200, height: 800 } 
    });
    
    try {
        // Test 1: Main App Loading
        console.log('📱 Testing main app...');
        const mainPage = await browser.newPage();
        await mainPage.goto('http://localhost:8164/index.html');
        await mainPage.waitForTimeout(3000);
        
        // Test save functionality
        console.log('💾 Testing save functionality...');
        await mainPage.evaluate(() => {
            // Simulate a save
            if (window.saveToGallery) {
                window.saveToGallery();
                console.log('Save function called');
            }
        });
        
        await mainPage.waitForTimeout(2000);
        
        // Check localStorage
        const localStorageData = await mainPage.evaluate(() => {
            const keys = Object.keys(localStorage).filter(k => k.includes('vib34d'));
            const data = {};
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                data[key] = value ? value.length : 0;
            });
            return data;
        });
        
        console.log('📊 localStorage data:', localStorageData);
        
        // Test 2: Gallery Loading
        console.log('🖼️ Testing gallery...');
        const galleryPage = await browser.newPage();
        await galleryPage.goto('http://localhost:8164/gallery.html');
        await galleryPage.waitForTimeout(5000);
        
        // Check if collections are found
        const galleryStatus = await galleryPage.evaluate(() => {
            const statusEl = document.getElementById('statusText');
            const collectionsContainer = document.getElementById('collectionsContainer');
            const errorMessage = document.querySelector('.error-state');
            
            return {
                statusText: statusEl ? statusEl.textContent : 'No status element',
                hasCollections: !!collectionsContainer && collectionsContainer.children.length > 0,
                hasError: !!errorMessage,
                errorText: errorMessage ? errorMessage.textContent : null,
                totalElements: document.querySelectorAll('.collection-card, .variation-card').length
            };
        });
        
        console.log('🖼️ Gallery status:', galleryStatus);
        
        // Test 3: Take screenshots
        console.log('📸 Taking screenshots...');
        await mainPage.screenshot({ path: 'test-main-app.png', fullPage: true });
        await galleryPage.screenshot({ path: 'test-gallery.png', fullPage: true });
        
        console.log('✅ Test completed successfully!');
        console.log('📸 Screenshots saved: test-main-app.png, test-gallery.png');
        
        return {
            localStorage: localStorageData,
            gallery: galleryStatus,
            success: true
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return { success: false, error: error.message };
    } finally {
        await browser.close();
    }
}

testSystem().then(result => {
    console.log('🏁 Final result:', result);
}).catch(console.error);