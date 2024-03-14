const { chromium } = require('playwright');

async function runTest() {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0]; // Use the first existing context
    const page = context.pages()[0]; // Use the first open page

    // Perform your tests with 'page' 
    await page.goto('http://localhost:3000');
    await page.getByRole('tab', { name: 'Trace Viewer' }).locator('a').click();
    await page.getByRole('button', { name: 'Open Trace Folder' }).hover();
    await page.getByRole('button', { name: 'Open Trace Folder' }).click();
    await page.getByRole('option', { name: '202-bug-hunt' }).locator('a').click();
    await page.getByRole('option', { name: 'cat-kernel' }).locator('a').click();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('tab', { name: 'cat-kernel' })).toBeVisible(); 
}

runTest();