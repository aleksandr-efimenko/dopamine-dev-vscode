import * as assert from 'assert';
import * as vscode from 'vscode';
import { TransactionLogger, Transaction } from '../src/transactionLogger';
import * as fs from 'fs';
import * as path from 'path';

// Create a test suite for TransactionLogger
suite('TransactionLogger Tests', () => {
    const tmpDir = '/tmp/dopamine-dev-logger-test';
    const logFile = path.join(tmpDir, 'transactions.jsonl');
    let logger: TransactionLogger;

    // Mock context
    const mockContext = {
        globalStorageUri: vscode.Uri.file(tmpDir)
    } as unknown as vscode.ExtensionContext;

    setup(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tmpDir, { recursive: true });
        logger = new TransactionLogger(mockContext);
    });

    teardown(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('Creates log file on initialization', () => {
        // The constructor should have created the file path logic, but file creation happens on first log
        logger.log('earn', 10, 10, 'Init');
        assert.ok(fs.existsSync(logFile), 'Log file should be created');
    });

    test('Logs transactions correctly', async () => {
        logger.log('earn', 50, 50, 'Coding');
        logger.log('spend', 10, 40, 'Reward');

        const transactions = await logger.getRecentTransactions();
        assert.strictEqual(transactions.length, 2);
        
        assert.strictEqual(transactions[0].type, 'spend');
        assert.strictEqual(transactions[0].amount, 10);
        
        assert.strictEqual(transactions[1].type, 'earn');
        assert.strictEqual(transactions[1].amount, 50);
    });

    test('Daily Stats Aggregation handles empty/malformed file', async () => {
        // Empty
        let stats = await logger.getDailyStats();
        assert.strictEqual(stats.length, 7); // Should still return 7 days of zeros
        assert.strictEqual(stats[6].earned, 0);

        // Malformed
        fs.writeFileSync(logFile, 'invalid-json\n{"valid":true}\n');
        stats = await logger.getDailyStats();
        assert.strictEqual(stats.length, 7);
        // Should not crash
    });

    test('Daily Stats groups by local date', async () => {
        // Manually write entries with specific timestamps
        // We need to pick a date. Let's use "today" and "yesterday" relative to local time execution.
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const t1: Transaction = {
            timestamp: today.toISOString(),
            type: 'earn',
            amount: 100,
            balanceAfter: 100,
            reason: 'Today Work'
        };
        const t2: Transaction = {
            timestamp: yesterday.toISOString(),
            type: 'earn',
            amount: 50,
            balanceAfter: 50,
            reason: 'Yesterday Work'
        };

        fs.writeFileSync(logFile, JSON.stringify(t1) + '\n' + JSON.stringify(t2) + '\n');

        const stats = await logger.getDailyStats(7);
        
        // Verify we have entries matching these amounts
        const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
        const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth()+1).padStart(2,'0') + '-' + String(yesterday.getDate()).padStart(2,'0');

        const todayStat = stats.find(s => s.date === todayStr);
        const yesterdayStat = stats.find(s => s.date === yesterdayStr);

        assert.ok(todayStat, 'Today stat should exist');
        assert.strictEqual(todayStat?.earned, 100);

        assert.ok(yesterdayStat, 'Yesterday stat should exist');
        assert.strictEqual(yesterdayStat?.earned, 50);
    });
});
