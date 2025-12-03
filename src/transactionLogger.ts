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
    
    // ... constructor and other methods

    public async getDailyStats(days: number = 7): Promise<DailyStat[]> {
        if (!fs.existsSync(this.logPath)) {
            return [];
        }

        return new Promise((resolve, reject) => {
            fs.readFile(this.logPath, 'utf8', (err, data) => {
                if (err) {
                    return reject(err);
                }

                const lines = data.trim().split('\n');
                const statsMap = new Map<string, { earned: number; spent: number }>();

                const now = new Date();
                const startDate = new Date();
                startDate.setDate(now.getDate() - days + 1);
                startDate.setHours(0, 0, 0, 0);

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const t: Transaction = JSON.parse(line);
                        const tDate = new Date(t.timestamp);
                        
                        // Filter by date range
                        if (tDate < startDate) continue;

                        const dateKey = tDate.toISOString().split('T')[0]; // YYYY-MM-DD

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

                // Fill in missing days
                const result: DailyStat[] = [];
                for (let i = 0; i < days; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    const dateKey = d.toISOString().split('T')[0];
                    
                    const entry = statsMap.get(dateKey) || { earned: 0, spent: 0 };
                    result.push({
                        date: dateKey,
                        earned: entry.earned,
                        spent: entry.spent
                    });
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
