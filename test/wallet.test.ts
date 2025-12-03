import * as assert from 'assert';
import * as vscode from 'vscode';
import { Wallet } from '../src/wallet';
import * as fs from 'fs';
import * as path from 'path';

// Mocking Memento for globalState
class MockMemento implements vscode.Memento {
    private data = new Map<string, any>();
    
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get(key: string, defaultValue?: any): any {
        return this.data.has(key) ? this.data.get(key) : defaultValue;
    }
    
    update(key: string, value: any): Thenable<void> {
        this.data.set(key, value);
        return Promise.resolve();
    }
    
    keys(): readonly string[] {
        return Array.from(this.data.keys());
    }

    setKeysForSync(keys: readonly string[]): void {
        // no-op
    }
}

suite('Wallet Tests', () => {
    const tmpDir = '/tmp/dopamine-dev-test';

    setup(() => {
        // Ensure clean state before each test
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    teardown(() => {
        // Clean up after tests
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('Wallet operations and Logging', async () => {
        // Create a mock context
        const mockGlobalState = new MockMemento();
        const mockContext = {
            globalState: mockGlobalState,
            globalStorageUri: vscode.Uri.file(tmpDir)
        } as unknown as vscode.ExtensionContext;

        const wallet = new Wallet(mockContext);

        // Initial State
        assert.strictEqual(wallet.getBalance(), 0, 'Initial balance should be 0');

        // Add Coins
        wallet.addCoins(5, 'Test Earn');
        assert.strictEqual(wallet.getBalance(), 5, 'Balance should be 5 after adding 5');

        // Add More
        wallet.addCoins(10, 'Test Earn 2');
        assert.strictEqual(wallet.getBalance(), 15, 'Balance should be 15 after adding 10');

        // Spend Coins (Success)
        const success = wallet.spendCoins(10, 'Test Spend');
        assert.strictEqual(success, true, 'Spending 10 coins should succeed');
        assert.strictEqual(wallet.getBalance(), 5, 'Balance should be 5 after spending');

        // Check Transactions
        const transactions = await wallet.getRecentTransactions();
        assert.strictEqual(transactions.length, 4, 'Should have 4 transactions (1 reset + 2 earns + 1 spend)');
        assert.strictEqual(transactions[0].type, 'spend', 'Last transaction should be spend');
        assert.strictEqual(transactions[0].reason, 'Test Spend');
    });

    test('Daily Reset', () => {
        const mockGlobalState = new MockMemento();
        const mockContext = {
            globalState: mockGlobalState,
            globalStorageUri: vscode.Uri.file(tmpDir)
        } as unknown as vscode.ExtensionContext;

        const KEY_BALANCE = 'dopamine-dev.balance';
        const KEY_LAST_ACTIVE_DATE = 'dopamine-dev.lastActiveDate';

        // Setup: Set state to "yesterday" with some coins
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        mockGlobalState.update(KEY_BALANCE, 100);
        mockGlobalState.update(KEY_LAST_ACTIVE_DATE, yesterday.toDateString());

        // Act: Initialize wallet (triggers checkDailyReset)
        const wallet = new Wallet(mockContext);
        
        // Assert
        assert.strictEqual(wallet.getBalance(), 0, 'Balance should be reset to 0 on a new day');
        
        // Verify date updated
        const storedDate = mockGlobalState.get(KEY_LAST_ACTIVE_DATE);
        assert.strictEqual(storedDate, new Date().toDateString(), 'Date should be updated to today');
    });

    test('Daily Stats Aggregation', async () => {
        const mockGlobalState = new MockMemento();
        const mockContext = {
            globalState: mockGlobalState,
            globalStorageUri: vscode.Uri.file(tmpDir)
        } as unknown as vscode.ExtensionContext;

        const wallet = new Wallet(mockContext);

        // Generate some activity
        wallet.addCoins(50, 'Work');
        wallet.spendCoins(10, 'Reward');
        wallet.addCoins(20, 'Bonus');

        // Wait for file system writes (TransactionLogger uses sync append, but good to be safe)
        
        const stats = await wallet.getDailyStats(7);
        
        // Find today's stat
        const todayStr = new Date().toLocaleDateString('en-CA').split('T')[0]; // YYYY-MM-DD
        
        // Note: getDailyStats uses local time construction. 
        // Since tests run in same env, it should match.
        
        const todayStat = stats.find(s => s.date === todayStr) || stats[stats.length - 1]; // Fallback to last if date matches

        // Check if we found a stat entry that has data
        assert.ok(todayStat, 'Should have stats for today');
        
        // Initial reset (0) + 50 + 20 = 70 Earned
        // 10 Spent
        // NOTE: The logger logs a 'reset' transaction with 0 amount on init.
        
        assert.strictEqual(todayStat.earned, 70, 'Should have 70 coins earned');
        assert.strictEqual(todayStat.spent, 10, 'Should have 10 coins spent');
    });
});