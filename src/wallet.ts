import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TransactionLogger } from './transactionLogger';

const KEY_BALANCE = 'dopamine-dev.balance';
const KEY_LAST_ACTIVE_DATE = 'dopamine-dev.lastActiveDate';

export class Wallet {
    private _onDidBalanceChange = new vscode.EventEmitter<number>();
    public readonly onDidBalanceChange = this._onDidBalanceChange.event;
    private logger: TransactionLogger;
    private watcher: fs.FSWatcher | undefined;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.logger = new TransactionLogger(context);
        this.checkDailyReset();
        this.setupFileWatcher();
    }

    private setupFileWatcher() {
        const storagePath = this.context.globalStorageUri.fsPath;
        
        // Ensure storage path exists before watching
        if (!fs.existsSync(storagePath)) {
            try {
                fs.mkdirSync(storagePath, { recursive: true });
            } catch (e) {
                console.error('Failed to create storage path for watcher', e);
                return;
            }
        }

        try {
            this.watcher = fs.watch(storagePath, (eventType, filename) => {
                if (filename && filename.startsWith('transactions-') && filename.endsWith('.jsonl')) {
                    this.handleExternalChange();
                }
            });
        } catch (e) {
            console.error('Failed to setup file watcher for wallet sync', e);
        }
    }

    private handleExternalChange() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            // Reload balance from global state.
            // Note: globalState sync across windows might have a slight delay.
            // Reading it after a file change is a good heuristic.
            const balance = this.context.globalState.get<number>(KEY_BALANCE, 0);
            this._onDidBalanceChange.fire(balance);
        }, 200);
    }

    private checkDailyReset() {
        const today = new Date().toDateString();
        const lastDate = this.context.globalState.get<string>(KEY_LAST_ACTIVE_DATE);

        if (lastDate !== today) {
            // New day (or first run), reset balance
            this.context.globalState.update(KEY_BALANCE, 0);
            this.context.globalState.update(KEY_LAST_ACTIVE_DATE, today);
            this._onDidBalanceChange.fire(0);
            this.logger.log('reset', 0, 0, 'Daily Reset');
        }
    }

    public getBalance(): number {
        this.checkDailyReset();
        return this.context.globalState.get<number>(KEY_BALANCE, 0);
    }

    public addCoins(amount: number, reason: string = 'Unknown') {
        const current = this.getBalance();
        const newBalance = current + amount;
        this.context.globalState.update(KEY_BALANCE, newBalance);
        this._onDidBalanceChange.fire(newBalance);
        this.logger.log('earn', amount, newBalance, reason);
    }

    public spendCoins(amount: number, reason: string = 'Unknown'): boolean {
        const current = this.getBalance();
        if (current >= amount) {
            const newBalance = current - amount;
            this.context.globalState.update(KEY_BALANCE, newBalance);
            this._onDidBalanceChange.fire(newBalance);
            this.logger.log('spend', amount, newBalance, reason);
            return true;
        }
        return false;
    }

    public getLogPath(): string {
        return this.logger.getLogPathForCurrentMonth();
    }

    public async getRecentTransactions(limit: number = 50) {
        return this.logger.getRecentTransactions(limit);
    }

    public async getMonthlyStats(year: number, month: number) {
        return this.logger.getMonthlyStats(year, month);
    }
}
