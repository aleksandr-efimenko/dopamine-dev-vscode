import * as vscode from 'vscode';

const KEY_BALANCE = 'dopamine-dev.balance';
const KEY_LAST_ACTIVE_DATE = 'dopamine-dev.lastActiveDate';

export class Wallet {
    private _onDidBalanceChange = new vscode.EventEmitter<number>();
    public readonly onDidBalanceChange = this._onDidBalanceChange.event;

    constructor(private context: vscode.ExtensionContext) {
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
        }
    }

    public getBalance(): number {
        this.checkDailyReset();
        return this.context.globalState.get<number>(KEY_BALANCE, 0);
    }

    public addCoins(amount: number) {
        const current = this.getBalance();
        const newBalance = current + amount;
        this.context.globalState.update(KEY_BALANCE, newBalance);
        this._onDidBalanceChange.fire(newBalance);
    }

    public spendCoins(amount: number): boolean {
        const current = this.getBalance();
        if (current >= amount) {
            const newBalance = current - amount;
            this.context.globalState.update(KEY_BALANCE, newBalance);
            this._onDidBalanceChange.fire(newBalance);
            return true;
        }
        return false;
    }
}
