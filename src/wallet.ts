import * as vscode from 'vscode';
import { TransactionLogger } from './transactionLogger';

const KEY_BALANCE = 'dopamine-dev.balance';
const KEY_LAST_ACTIVE_DATE = 'dopamine-dev.lastActiveDate';

export class Wallet {
    private _onDidBalanceChange = new vscode.EventEmitter<number>();
    public readonly onDidBalanceChange = this._onDidBalanceChange.event;
    private logger: TransactionLogger;

    constructor(private context: vscode.ExtensionContext) {
        this.logger = new TransactionLogger(context);
        this.checkDailyReset();
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
        return this.logger.getLogPath();
    }

    public async getRecentTransactions(limit: number = 50) {
        return this.logger.getRecentTransactions(limit);
    }

    public async getDailyStats(days: number = 7) {
        return this.logger.getDailyStats(days);
    }
}
