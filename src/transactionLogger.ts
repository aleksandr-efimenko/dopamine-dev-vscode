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

export interface DailyStat {
    date: string;
    earned: number;
    spent: number;
}

export class TransactionLogger {
    private storagePath: string;

    constructor(context: vscode.ExtensionContext) {
        this.storagePath = context.globalStorageUri.fsPath;
        this.ensureStorage();
        this.migrateLegacyLog();
    }

    private ensureStorage() {
        if (!fs.existsSync(this.storagePath)) {
            try {
                fs.mkdirSync(this.storagePath, { recursive: true });
            } catch (e) {
                console.error('Failed to create global storage directory', e);
            }
        }
    }

    private getLogPath(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return path.join(this.storagePath, `transactions-${y}-${m}.jsonl`);
    }

    private migrateLegacyLog() {
        const legacyPath = path.join(this.storagePath, 'transactions.jsonl');
        if (fs.existsSync(legacyPath)) {
            try {
                const data = fs.readFileSync(legacyPath, 'utf8');
                const lines = data.trim().split('\n');
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const t: Transaction = JSON.parse(line);
                        const date = new Date(t.timestamp);
                        const targetPath = this.getLogPath(date);
                        fs.appendFileSync(targetPath, line + '\n');
                    } catch (e) {
                        console.error('Failed to migrate transaction line', e);
                    }
                }
                
                // Rename legacy file to prevent re-migration
                fs.renameSync(legacyPath, legacyPath + '.migrated');
                console.log('Successfully migrated legacy transactions.');
            } catch (e) {
                console.error('Failed to migrate legacy transactions', e);
            }
        }
    }

    public log(type: 'earn' | 'spend' | 'reset', amount: number, balanceAfter: number, reason: string) {
        const now = new Date();
        const transaction: Transaction = {
            timestamp: now.toISOString(),
            type,
            amount,
            balanceAfter,
            reason
        };
        
        const logPath = this.getLogPath(now);
        try {
            fs.appendFileSync(logPath, JSON.stringify(transaction) + '\n');
        } catch (err) {
            console.error('Failed to write transaction log', err);
        }
    }

    public getLogPathForCurrentMonth(): string {
        return this.getLogPath(new Date());
    }

    public async getMonthlyStats(year: number, month: number): Promise<DailyStat[]> {
        // month is 1-12
        const date = new Date(year, month - 1, 1);
        const logPath = this.getLogPath(date);
        
        const daysInMonth = new Date(year, month, 0).getDate();
        const statsMap = new Map<string, { earned: number; spent: number }>();

        // Initialize all days with 0
        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            statsMap.set(dayStr, { earned: 0, spent: 0 });
        }

        if (!fs.existsSync(logPath)) {
            return Array.from(statsMap.entries()).map(([date, val]) => ({ date, ...val }));
        }

        return new Promise((resolve, reject) => {
            fs.readFile(logPath, 'utf8', (err, data) => {
                if (err) { return reject(err); }

                const lines = data.trim().split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const t: Transaction = JSON.parse(line);
                        const tDate = new Date(t.timestamp);
                        const dayStr = tDate.toISOString().split('T')[0]; // YYYY-MM-DD

                        if (statsMap.has(dayStr)) {
                            const entry = statsMap.get(dayStr)!;
                            if (t.type === 'earn') {
                                entry.earned += t.amount;
                            } else if (t.type === 'spend') {
                                entry.spent += t.amount;
                            }
                        }
                    } catch (e) {
                        // Ignore malformed
                    }
                }

                resolve(Array.from(statsMap.entries()).map(([date, val]) => ({ date, ...val })));
            });
        });
    }

    public async getRecentTransactions(limit: number = 50): Promise<Transaction[]> {
        // Check current month first, then previous month if needed
        const now = new Date();
        const pathsToCheck = [
            this.getLogPath(now),
            this.getLogPath(new Date(now.getFullYear(), now.getMonth() - 1, 1))
        ];

        let transactions: Transaction[] = [];

        for (const p of pathsToCheck) {
            if (transactions.length >= limit) break;
            if (!fs.existsSync(p)) continue;

            try {
                const data = fs.readFileSync(p, 'utf8');
                const lines = data.trim().split('\n');
                // Reverse to get newest first
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (transactions.length >= limit) break;
                    const line = lines[i].trim();
                    if (line) {
                        try {
                            transactions.push(JSON.parse(line));
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
        
        // Sort by timestamp desc in case of multiple file merges (though simplified logic above just appends)
        return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
    }
}
