import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Transaction {
    timestamp: string;
    type: 'earn' | 'spend' | 'reset';
    amount: number;
    balanceAfter: number;
    reason: string;
}

export class TransactionLogger {
    private logPath: string;

    constructor(context: vscode.ExtensionContext) {
        // Ensure global storage directory exists
        const storagePath = context.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            try {
                fs.mkdirSync(storagePath, { recursive: true });
            } catch (e) {
                console.error('Failed to create global storage directory', e);
            }
        }
        this.logPath = path.join(storagePath, 'transactions.jsonl');
    }

    public log(type: 'earn' | 'spend' | 'reset', amount: number, balanceAfter: number, reason: string) {
        const transaction: Transaction = {
            timestamp: new Date().toISOString(),
            type,
            amount,
            balanceAfter,
            reason
        };
        
        try {
            fs.appendFileSync(this.logPath, JSON.stringify(transaction) + '\n');
        } catch (err) {
            console.error('Failed to write transaction log', err);
        }
    }

    public getLogPath(): string {
        return this.logPath;
    }
}
