import * as vscode from 'vscode';
import * as path from 'path';
import { Wallet } from './wallet';
import { Transaction } from './transactionLogger';
import { RewardManager } from './rewardManager';
import { DiffTracker, DiffStats, ThresholdConfig } from './diffTracker';
import { PerformanceTracker, PerformanceStats } from './performanceTracker';

// Safe import for sound-play
let sound: any;
try {
    sound = require('sound-play');
} catch (e) {
    console.warn('sound-play not found');
}

// Constants
const STATUS_BAR_PRIORITY = 100;
const DEFAULT_BULK_THRESHOLD = 50;
const DEFAULT_MEDIUM_LINES = 5;
const DEFAULT_MEDIUM_CHARS = 100;
const DEFAULT_LARGE_LINES = 20;
const DEFAULT_LARGE_CHARS = 500;
const DEFAULT_EPIC_LINES = 50;
const DEFAULT_EPIC_CHARS = 2000;
const SPIN_INTERVAL_MS = 80;
const SPIN_COUNT = 10;
const DEFAULT_MIN_CHARS = 20;
const MINOR_CHANGE_TIMEOUT_MS = 3000;
const DEFAULT_WIN_ODDS = 0.1;
const BASE_COINS = 1;
const MEDIUM_MULTIPLIER = 2;
const LARGE_MULTIPLIER = 5;
const EPIC_MULTIPLIER = 10;
const FLOW_DURATION_THRESHOLD_MIN = 15;
const SPEED_BONUS_HIGH = 5;
const SPEED_BONUS_LOW = 2;
const WPM_THRESHOLD_HIGH = 80;
const WPM_THRESHOLD_LOW = 40;
const QUALITY_MULTIPLIER_FIX = 2.0;
const QUALITY_MULTIPLIER_CLEAN = 1.5;
const QUALITY_MULTIPLIER_BUGGY = 0.5;
const JACKPOT_MULTIPLIER = 10;
const FINAL_MESSAGE_TIMEOUT_MS = 4000;

let statusBarItem: vscode.StatusBarItem;
let wallet: Wallet;
let rewardManager: RewardManager;
let diffTracker: DiffTracker;
let performanceTracker: PerformanceTracker;

export function activate(context: vscode.ExtensionContext) {
    wallet = new Wallet(context);
    rewardManager = new RewardManager(wallet);
    diffTracker = new DiffTracker();
    performanceTracker = new PerformanceTracker();

    // Status Bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, STATUS_BAR_PRIORITY);
    statusBarItem.command = 'dopamine-dev.showHistory';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Subscribe to Wallet changes
    context.subscriptions.push(wallet.onDidBalanceChange(() => {
        updateStatusBar();
    }));

    // Command: Check Balance
    context.subscriptions.push(vscode.commands.registerCommand('dopamine-dev.checkBalance', () => {
        vscode.window.showInformationMessage(`💰 Your Balance: ${wallet.getBalance()} Coins`);
    }));

    // Command: Show Transaction Log (Raw File)
    context.subscriptions.push(vscode.commands.registerCommand('dopamine-dev.showTransactionLog', async () => {
        const logPath = wallet.getLogPath();
        try {
            const doc = await vscode.workspace.openTextDocument(logPath);
            await vscode.window.showTextDocument(doc);
        } catch (e) {
            vscode.window.showErrorMessage(`Could not open log file at ${logPath}. It might not exist yet.`);
        }
    }));

    // Command: Show History (QuickPick)
    context.subscriptions.push(vscode.commands.registerCommand('dopamine-dev.showHistory', async () => {
        const transactions = await wallet.getRecentTransactions(50);
        
        if (transactions.length === 0) {
            vscode.window.showInformationMessage("No transaction history yet.");
            return;
        }

        const items: vscode.QuickPickItem[] = transactions.map(t => {
            let icon = '$(info)';
            if (t.type === 'earn') { icon = '$(gift)'; }
            else if (t.type === 'spend') { icon = '$(flame)'; }
            else if (t.type === 'reset') { icon = '$(history)'; }

            const date = new Date(t.timestamp).toLocaleString();
            
            return {
                label: `${icon} ${t.type === 'spend' ? '-' : '+'}${t.amount} Coins`,
                description: t.reason,
                detail: `${date} | Balance: ${t.balanceAfter}`
            };
        });

        items.push({
            label: "$(file-text) View Full Log File",
            description: "",
            detail: "Open the raw JSONL file"
        });

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: `Recent Transactions (Balance: ${wallet.getBalance()} Coins)`
        });

        if (selection && selection.label.includes("View Full Log File")) {
            vscode.commands.executeCommand('dopamine-dev.showTransactionLog');
        }
    }));

    // Event: On Change (Track Diff & Performance)
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
        const config = vscode.workspace.getConfiguration('dopamineDev');
        const bulkThreshold = config.get<number>('bulkThreshold', DEFAULT_BULK_THRESHOLD);
        diffTracker.onDidChange(e, bulkThreshold);
        performanceTracker.onDidChange(e, bulkThreshold);
    }));

    // Event: On Close (Cleanup)
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
        performanceTracker.onDidClose(document);
    }));

    // Event: On Save (Spin)
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('dopamineDev');

        // Ignore settings files
        if (document.uri.scheme === 'vscode-userdata' || document.fileName.endsWith('/settings.json')) {
            return;
        }

        const ignoreExtensions = config.get<string[]>('ignoreExtensions', ['.json']);
        const ext = path.extname(document.fileName);

        if (ignoreExtensions.includes(ext)) {
            return;
        }

        const diffStats = diffTracker.getAndResetStats(document);
        const perfStats = performanceTracker.getStats(document);
        spinSlotMachine(context, diffStats, perfStats);
    }));
}

function updateStatusBar(message?: string) {
    if (message) {
        statusBarItem.text = message;
    } else {
        statusBarItem.text = `$(gift) ${wallet.getBalance()} Coins`;
    }
}

function spinSlotMachine(context: vscode.ExtensionContext, diffStats: DiffStats, perfStats: PerformanceStats) {
    const icons = ["$(zap)", "$(heart)", "$(star)", "$(flame)", "$(beaker)", "$(gift)"];
    let spins = 0;
    const config = vscode.workspace.getConfiguration('dopamineDev');

    const thresholdConfig: ThresholdConfig = {
        medium: {
            lines: config.get<number>('thresholds.medium.lines', DEFAULT_MEDIUM_LINES),
            chars: config.get<number>('thresholds.medium.chars', DEFAULT_MEDIUM_CHARS)
        },
        large: {
            lines: config.get<number>('thresholds.large.lines', DEFAULT_LARGE_LINES),
            chars: config.get<number>('thresholds.large.chars', DEFAULT_LARGE_CHARS)
        },
        epic: {
            lines: config.get<number>('thresholds.epic.lines', DEFAULT_EPIC_LINES),
            chars: config.get<number>('thresholds.epic.chars', DEFAULT_EPIC_CHARS)
        }
    };

    const magnitude = diffTracker.getMagnitude(diffStats, thresholdConfig);

    const minChars = config.get<number>('thresholds.minChars', DEFAULT_MIN_CHARS);
    if (diffStats.charsAdded < minChars) {
        checkResult(context, config, magnitude, diffStats, perfStats);
        return;
    }

    const interval = setInterval(() => {
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        updateStatusBar(`${randomIcon} Spinning (${magnitude})...`);
        spins++;

        if (spins > SPIN_COUNT) {
            clearInterval(interval);
            checkResult(context, config, magnitude, diffStats, perfStats);
        }
    }, SPIN_INTERVAL_MS);
}

function checkResult(context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration, magnitude: 'Small' | 'Medium' | 'Large' | 'Epic', diffStats: DiffStats, perfStats: PerformanceStats) {
    const totalCharsChanged = diffStats.charsAdded;
    const minChars = config.get<number>('thresholds.minChars', DEFAULT_MIN_CHARS);

    // 1. Threshold Check
    if (totalCharsChanged < minChars) {
        statusBarItem.backgroundColor = undefined;
        updateStatusBar(`$(code) Minor change - No reward.`);
        setTimeout(() => { updateStatusBar(); }, MINOR_CHANGE_TIMEOUT_MS);
        return;
    }

    const winOdds = config.get<number>('winOdds', DEFAULT_WIN_ODDS);
    const soundEnabled = config.get<boolean>('enableSound', false);
    const roll = Math.random();

    // --- CALCULATE COINS ---
    let totalCoins = 0;
    let baseCoins = BASE_COINS;
    let bonuses: string[] = [];

    // 2. Diff Magnitude Multiplier
    let magnitudeMultiplier = 1;
    switch (magnitude) {
        case 'Medium':
            magnitudeMultiplier = MEDIUM_MULTIPLIER;
            break;
        case 'Large':
            magnitudeMultiplier = LARGE_MULTIPLIER;
            break;
        case 'Epic':
            magnitudeMultiplier = EPIC_MULTIPLIER;
            break;
    }

    // 3. Flow State Bonus
    if (perfStats.flowDurationMinutes > FLOW_DURATION_THRESHOLD_MIN) {
        const flowBonus = Math.floor(perfStats.flowDurationMinutes / FLOW_DURATION_THRESHOLD_MIN);
        if (flowBonus > 0) {
            baseCoins += flowBonus;
            bonuses.push(`Flow x${flowBonus}`);
        }
    }

    // 4. Speed Bonus (WPM)
    if (perfStats.wpm > WPM_THRESHOLD_HIGH) {
        baseCoins += SPEED_BONUS_HIGH;
        bonuses.push("Speed Demon");
    } else if (perfStats.wpm > WPM_THRESHOLD_LOW) {
        baseCoins += SPEED_BONUS_LOW;
        bonuses.push("Fast Typer");
    }

    // 5. Clean Code Multiplier
    let qualityMultiplier = 1.0;
    if (perfStats.errorsFixed > 0) {
        qualityMultiplier = QUALITY_MULTIPLIER_FIX;
        bonuses.push("Bug Fixer");
    } else if (perfStats.isClean) {
        qualityMultiplier = QUALITY_MULTIPLIER_CLEAN;
        bonuses.push("Clean Code");
    } else if (perfStats.errorsFixed < 0) {
        // Introduced errors
        qualityMultiplier = QUALITY_MULTIPLIER_BUGGY;
        bonuses.push("Buggy");
    }

    // --- FINAL CALCULATION ---
    // (Base + Flow + Speed) * Magnitude * Quality
    totalCoins = Math.floor(baseCoins * magnitudeMultiplier * qualityMultiplier);

    // Jackpot Override
    let isJackpot = false;
    if (roll < winOdds && perfStats.errorsFixed >= 0) {
        isJackpot = true;
        totalCoins += (JACKPOT_MULTIPLIER * magnitudeMultiplier); // Jackpot bonus
    }

    // Apply to Wallet
    const reasonParts = [`Code Action (${magnitude})`];
    if (isJackpot) { reasonParts.push('JACKPOT'); }
    if (bonuses.length > 0) { reasonParts.push(bonuses.join(', ')); }
    
    wallet.addCoins(totalCoins, reasonParts.join(' '));

    // --- VISUALS & SOUND ---
    const bonusText = bonuses.length > 0 ? `(${bonuses.join(', ')})` : '';

    if (isJackpot && totalCoins > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        updateStatusBar(`$(star) JACKPOT! +${totalCoins} Coins ${bonusText}`);
        playSound(context, config.get<string>('sounds.win'), 'win.mp3', soundEnabled);

        const reward = rewardManager.getRandomReward();
        if (reward) { rewardManager.redeemReward(reward); }
    } else {
        statusBarItem.backgroundColor = undefined;

        if (totalCoins > 0) {
            updateStatusBar(`$(check) Saved +${totalCoins} Coins ${bonusText}`);
            // Only play coin sound if not buggy (errors didn't increase)
            if (perfStats.errorsFixed >= 0) {
                playSound(context, config.get<string>('sounds.coin'), 'coin-received.mp3', soundEnabled);
            }
        } else {
            updateStatusBar(`$(alert) Saved (0 Coins) ${bonusText}`);
        }
    }

    setTimeout(() => {
        statusBarItem.backgroundColor = undefined;
        updateStatusBar();
    }, FINAL_MESSAGE_TIMEOUT_MS);
}

function playSound(context: vscode.ExtensionContext, customPath: string | undefined, defaultFileName: string, enabled: boolean) {
    if (!enabled) { return; }

    let targetPath: string;
    if (customPath && customPath.trim().length > 0) {
        targetPath = customPath;
    } else {
        targetPath = path.join(context.extensionPath, 'media', defaultFileName);
    }

    if (sound) {
        try { sound.play(targetPath); } catch (e) {
            console.error(`Failed to play sound: ${targetPath}`, e);
        }
    }
}

// (webview playback removed)

export function deactivate() { }