import * as assert from 'assert';
import * as vscode from 'vscode';
import { Wallet } from '../src/wallet';

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
    test('Wallet operations', () => {
        // Create a mock context
        const mockGlobalState = new MockMemento();
        const mockContext = {
            globalState: mockGlobalState,
            globalStorageUri: vscode.Uri.file('/tmp/dopamine-dev-test')
        } as unknown as vscode.ExtensionContext;

        const wallet = new Wallet(mockContext);

        // Initial State
        assert.strictEqual(wallet.getBalance(), 0, 'Initial balance should be 0');

        // Add Coins
        wallet.addCoins(5);
        assert.strictEqual(wallet.getBalance(), 5, 'Balance should be 5 after adding 5');

        // Add More
        wallet.addCoins(10);
        assert.strictEqual(wallet.getBalance(), 15, 'Balance should be 15 after adding 10');

        // Spend Coins (Success)
        const success = wallet.spendCoins(10);
        assert.strictEqual(success, true, 'Spending 10 coins should succeed');
        assert.strictEqual(wallet.getBalance(), 5, 'Balance should be 5 after spending');

        // Spend Coins (Fail)
        const fail = wallet.spendCoins(100);
        assert.strictEqual(fail, false, 'Spending 100 coins should fail');
        assert.strictEqual(wallet.getBalance(), 5, 'Balance should remain 5 after failed spend');
    });

    test('Daily Reset', () => {
        const mockGlobalState = new MockMemento();
        const mockContext = {
            globalState: mockGlobalState,
            globalStorageUri: vscode.Uri.file('/tmp/dopamine-dev-test')
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
});
