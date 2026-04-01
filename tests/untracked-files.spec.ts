import { test, expect } from '@playwright/test';

// Helper to select CURRENT in the "To" dropdown
async function selectCurrentInToDropdown(page: any) {
  // The "To" dropdown is the second Bootstrap Dropdown toggle
  const dropdownToggles = page.locator('button.dropdown-toggle');
  const toToggle = dropdownToggles.nth(1);
  await toToggle.click();

  // Click the "CURRENT (working directory)" option
  const currentOption = page.getByText('CURRENT (working directory)');
  await currentOption.first().click();

  // Wait for diff to reload
  await page.waitForTimeout(2000);
}

test.describe('Untracked files in CURRENT working directory', () => {

  test('API diff with CURRENT should include untracked files', async ({ page }) => {
    await page.goto('http://localhost:3456');
    // Don't need Monaco for API-only test, just wait for the page
    await page.waitForLoadState('networkidle');

    const diffFiles = await page.evaluate(async () => {
      const baseResp = await fetch('./api/base-commit');
      const { base_commit } = await baseResp.json();
      const diffResp = await fetch(`./api/diff?from=${base_commit}&to=CURRENT`);
      return diffResp.json();
    });

    console.log('Diff files:', JSON.stringify(diffFiles.map((f: any) => ({
      path: f.path, status: f.status, additions: f.additions,
    })), null, 2));

    // Should include the modified tracked file
    const modifiedFile = diffFiles.find((f: any) => f.path === 'existing.txt');
    expect(modifiedFile).toBeDefined();
    expect(modifiedFile.status).toBe('M');

    // Should include the untracked files
    const untrackedFile = diffFiles.find(
      (f: any) => f.path === 'untracked-test-file.txt'
    );
    expect(untrackedFile).toBeDefined();
    expect(untrackedFile.status).toBe('A');
    expect(untrackedFile.additions).toBe(3);
    expect(untrackedFile.old_hash).toBe('0000000000000000000000000000000000000000');
    expect(untrackedFile.new_hash).toBe('0000000000000000000000000000000000000000');

    const anotherUntracked = diffFiles.find(
      (f: any) => f.path === 'another-new.txt'
    );
    expect(anotherUntracked).toBeDefined();
    expect(anotherUntracked.status).toBe('A');
  });

  test('untracked file content should be fetchable via API', async ({ page }) => {
    await page.goto('http://localhost:3456');
    await page.waitForLoadState('networkidle');

    const content = await page.evaluate(async () => {
      const params = new URLSearchParams({
        hash: '0000000000000000000000000000000000000000',
        path: 'untracked-test-file.txt',
      });
      const resp = await fetch(`./api/file-content?${params.toString()}`);
      return resp.text();
    });

    expect(content).toContain('This is an untracked file');
  });

  test('untracked file should appear in the file list when CURRENT is selected', async ({ page }) => {
    await page.goto('http://localhost:3456');
    // Wait for the range picker to load
    await page.waitForSelector('button.dropdown-toggle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Select CURRENT in the To dropdown
    await selectCurrentInToDropdown(page);

    // The file list should now contain our untracked file
    const pageContent = await page.content();
    expect(pageContent).toContain('untracked-test-file.txt');
    expect(pageContent).toContain('another-new.txt');
    expect(pageContent).toContain('existing.txt');
  });

  test('selecting an untracked file should show its content in the editor', async ({ page }) => {
    await page.goto('http://localhost:3456');
    await page.waitForSelector('button.dropdown-toggle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Select CURRENT in the To dropdown
    await selectCurrentInToDropdown(page);

    // Wait for the file selector to appear and Monaco to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Select the untracked file from the file selector <select>
    const fileSelect = page.locator('select').first();
    await fileSelect.selectOption({ value: 'untracked-test-file.txt' });

    // Wait for the file to load
    await page.waitForTimeout(2000);

    // The modified editor (right side) should show the file content
    const modifiedEditor = page.locator('.modified-in-monaco-diff-editor').first();
    await expect(modifiedEditor).toBeVisible({ timeout: 5000 });

    // Check that content is displayed
    const viewLines = modifiedEditor.locator('.view-line');
    const lineCount = await viewLines.count();
    expect(lineCount).toBeGreaterThan(0);

    // Verify actual content is displayed
    // Monaco uses non-breaking spaces, so match with regex
    const editorText = await modifiedEditor.textContent();
    expect(editorText).toMatch(/untracked/);
  });
});
