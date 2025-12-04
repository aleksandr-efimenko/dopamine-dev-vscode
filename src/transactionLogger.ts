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

    public async getDailyStats(days: number = 7): Promise<DailyStat[]> {
        const toLocalYMD = (date: Date): string => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const generateEmptyStats = (startDate: Date, count: number): DailyStat[] => {
            const result: DailyStat[] = [];
            for (let i = 0; i < count; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                result.push({
                    date: toLocalYMD(d),
                    earned: 0,
                    spent: 0
                });
            }
            return result;
        };

        const now = new Date();
        now.setHours(0,0,0,0);
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - days + 1);

        if (!fs.existsSync(this.logPath)) {
            return generateEmptyStats(startDate, days);
        }

        return new Promise((resolve, reject) => {
            fs.readFile(this.logPath, 'utf8', (err, data) => {
                if (err) {
                    return reject(err);
                }

                const lines = data.trim().split('\n');
                const statsMap = new Map<string, { earned: number; spent: number }>();

                for (const line of lines) {
                    if (!line.trim()) { continue; }
                    try {
                        const t: Transaction = JSON.parse(line);
                        const tDate = new Date(t.timestamp);
                        
                        if (tDate.getTime() < startDate.getTime()) { continue; }

                        const dateKey = toLocalYMD(tDate);

                        if (!statsMap.has(dateKey)) {
                            statsMap.set(dateKey, { earned: 0, spent: 0 });
                        }

                        const entry = statsMap.get(dateKey)!;
                        if (t.type === 'earn') {
                            entry.earned += t.amount;
                        } else if (t.type === 'spend') {
                            entry.spent += t.amount;
                        }
                    } catch (e) {
                        // Ignore malformed
                    }
                }

                const result = generateEmptyStats(startDate, days);
                // Merge actual data
                for (const stat of result) {
                    if (statsMap.has(stat.date)) {
                        const entry = statsMap.get(stat.date)!;
                        stat.earned = entry.earned;
                        stat.spent = entry.spent;
                    }
                }

                resolve(result);
            });
        });
    }

    public async getRecentTransactions(limit: number = 50): Promise<Transaction[]> {
        if (!fs.existsSync(this.logPath)) {
            return [];
        }

        return new Promise((resolve, reject) => {
            fs.readFile(this.logPath, 'utf8', (err, data) => {
                if (err) {
                    return reject(err);
                }

                const lines = data.trim().split('\n');
                const transactions: Transaction[] = [];

                // Read from end
                for (let i = lines.length - 1; i >= 0 && transactions.length < limit; i--) {
                    const line = lines[i].trim();
                    if (line) {
                        try {
                            transactions.push(JSON.parse(line));
                        } catch (e) {
                            // Ignore malformed lines
                        }
                    }
                }
                resolve(transactions);
            });
        });
    }
}
