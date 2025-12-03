"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const wallet_1 = require("../wallet");
// Mocking Memento for globalState
class MockMemento {
    data = new Map();
    get(key, defaultValue) {
        return this.data.has(key) ? this.data.get(key) : defaultValue;
    }
    update(key, value) {
        this.data.set(key, value);
        return Promise.resolve();
    }
    keys() {
        return Array.from(this.data.keys());
    }
    setKeysForSync(keys) {
        // no-op
    }
}
suite('Wallet Tests', () => {
    test('Wallet operations', () => {
        // Create a mock context
        const mockGlobalState = new MockMemento();
        const mockContext = {
            globalState: mockGlobalState
        };
        const wallet = new wallet_1.Wallet(mockContext);
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
            globalState: mockGlobalState
        };
        const KEY_BALANCE = 'dopamine-dev.balance';
        const KEY_LAST_ACTIVE_DATE = 'dopamine-dev.lastActiveDate';
        // Setup: Set state to "yesterday" with some coins
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        mockGlobalState.update(KEY_BALANCE, 100);
        mockGlobalState.update(KEY_LAST_ACTIVE_DATE, yesterday.toDateString());
        // Act: Initialize wallet (triggers checkDailyReset)
        const wallet = new wallet_1.Wallet(mockContext);
        // Assert
        assert.strictEqual(wallet.getBalance(), 0, 'Balance should be reset to 0 on a new day');
        // Verify date updated
        const storedDate = mockGlobalState.get(KEY_LAST_ACTIVE_DATE);
        assert.strictEqual(storedDate, new Date().toDateString(), 'Date should be updated to today');
    });
});
//# sourceMappingURL=wallet.test.js.map