import * as vscode from 'vscode';
import { Wallet } from './wallet';

// Load quotes from categories
let allQuotes: { text: string; author: string; category: string }[] = [];
try {
    const programming = require('../quotes/programming.json');
    const motivation = require('../quotes/motivation.json');
    const productivity = require('../quotes/productivity.json');
    const humor = require('../quotes/humor.json');
    
    allQuotes = [
        ...programming,
        ...motivation,
        ...productivity,
        ...humor
    ];
} catch (e) {
    console.error("Failed to load quotes", e);
}

export interface Reward {
    type: 'url' | 'message' | 'image' | 'quote';
    content: string;
    label: string;
    weight?: number; // Optional weight for individual reward items
}

export class RewardManager {
    private recentQuotes: string[] = [];
    private readonly MAX_HISTORY = 5;

    constructor(private wallet: Wallet) {}

    public getConfigRewards(): Reward[] {
        const config = vscode.workspace.getConfiguration('dopamineDev');
        const rewards = config.get<Reward[]>('rewards');
        return rewards || [];
    }

    public getRandomReward(): Reward | undefined {
        const rewards = this.getConfigRewards();
        if (rewards.length === 0) { return undefined; }

        // Filter out rewards with weight 0 or less, and add default weight if not specified
        const activeRewards = rewards.filter(r => (r.weight ?? 1) > 0);
        if (activeRewards.length === 0) { return undefined; }

        // Calculate total weight
        let totalWeight = activeRewards.reduce((sum, r) => sum + (r.weight ?? 1), 0);

        // Select a random reward based on weights
        let random = Math.random() * totalWeight;
        for (const reward of activeRewards) {
            random -= (reward.weight ?? 1);
            if (random <= 0) {
                return reward;
            }
        }
        
        // Fallback in case of floating point issues, pick the last one
        return activeRewards[activeRewards.length - 1];
    }

    public async redeemReward(reward: Reward) {
        if (reward.type === 'url') {
            const selection = await vscode.window.showInformationMessage(`🎉 You won: ${reward.label}!`, "Redeem");
            if (selection === "Redeem") {
                vscode.env.openExternal(vscode.Uri.parse(reward.content));
            }
        } else if (reward.type === 'message') {
            vscode.window.showInformationMessage(`🎉 ${reward.content}`);
        } else if (reward.type === 'image') {
            this.showImageReward(reward);
        } else if (reward.type === 'quote') {
            const display = vscode.workspace.getConfiguration('dopamineDev').get<string>('quoteDisplay', 'notification');
            if (display === 'notification') {
                this.showQuoteNotification(reward);
            } else {
                this.showQuoteMessage(reward);
            }
        }
    }

    private showQuoteNotification(reward: Reward) {
        const category = reward.content.toLowerCase();
        let filtered = allQuotes;
        if (category && category !== 'any') {
            filtered = allQuotes.filter(q => q.category === category);
        }
        if (filtered.length === 0) { filtered = allQuotes; }

        const available = filtered.filter(q => !this.recentQuotes.includes(q.text));
        const candidates = available.length > 0 ? available : filtered;
        const quote = candidates.length > 0 
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : { text: "No quotes found.", author: "System", category: "error" };

        if (quote.text !== "No quotes found.") {
            this.recentQuotes.push(quote.text);
            if (this.recentQuotes.length > this.MAX_HISTORY) {
                this.recentQuotes.shift();
            }
        }

        // VS Code notifications have limited size; present the full quote inline.
        vscode.window.showInformationMessage(`❝ ${quote.text}\n— ${quote.author}`);
    }

    private showQuoteMessage(reward: Reward) {
        const panel = vscode.window.createWebviewPanel(
            'jackpotReward',
            `🎉 ${reward.label} 🎉`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        const getQuote = () => {
            const category = reward.content.toLowerCase();
            let filtered = allQuotes;
            if (category && category !== 'any') {
                filtered = allQuotes.filter(q => q.category === category);
            }
            if (filtered.length === 0) { filtered = allQuotes; }
            
            const available = filtered.filter(q => !this.recentQuotes.includes(q.text));
            const candidates = available.length > 0 ? available : filtered;

            const quote = candidates.length > 0 
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : { text: "No quotes found.", author: "System", category: "error" };

            if (quote.text !== "No quotes found.") {
                this.recentQuotes.push(quote.text);
                if (this.recentQuotes.length > this.MAX_HISTORY) {
                    this.recentQuotes.shift();
                }
            }
            return quote;
        };

        const currentQuote = getQuote();

        // Handle Messages
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'spinAgain':
                        const cost = 1;
                        if (this.wallet.spendCoins(cost)) {
                            vscode.window.setStatusBarMessage(`Spent ${cost} coin for a new quote!`, 2000);
                            const newQuote = getQuote();
                            panel.webview.postMessage({ command: 'newQuote', quote: newQuote });
                        } else {
                            panel.webview.postMessage({ command: 'error', text: 'Not enough coins!' });
                        }
                        return;
                }
            },
            undefined,
            []
        );

        panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reward</title>
            <style>
                body {
                    margin: 0;
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background-color: #1e1e1e;
                    color: white;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    text-align: center;
                }
                h1 { margin-bottom: 20px; color: #f1c40f; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
                .quote-container {
                    background: rgba(255,255,255,0.1);
                    padding: 60px;
                    border-radius: 15px;
                    max-width: 800px;
                    width: 100%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    position: relative;
                }
                .quote-text {
                    font-size: 2em;
                    font-style: italic;
                    line-height: 1.4;
                    margin-bottom: 30px;
                    color: #ecf0f1;
                }
                .quote-author {
                    font-size: 1.2em;
                    font-weight: bold;
                    color: #3498db;
                    text-align: right;
                }
                .quote-icon {
                    font-size: 4em;
                    color: rgba(255,255,255,0.2);
                    position: absolute;
                    top: -30px;
                    left: 30px;
                }
                button {
                    margin-top: 40px;
                    padding: 15px 30px;
                    font-size: 18px;
                    background-color: #9b59b6;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.3s;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                button:hover { background-color: #8e44ad; }
                button:active { transform: translateY(2px); }
                button:disabled { background-color: #95a5a6; cursor: not-allowed; }
                .error { color: #e74c3c; margin-top: 15px; font-weight: bold; display: none; }
            </style>
        </head>
        <body>
            <h1>🎰 JACKPOT! 🎰</h1>
            
            <div class="quote-container">
                <div class="quote-icon">❝</div>
                <div id="qText" class="quote-text">"${currentQuote.text}"</div>
                <div id="qAuthor" class="quote-author">- ${currentQuote.author}</div>
            </div>

            <button id="spinBtn" onclick="requestSpin()">✨ New Quote (1 Coin)</button>
            <div id="errorMsg" class="error"></div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function requestSpin() {
                    const btn = document.getElementById('spinBtn');
                    btn.disabled = true;
                    btn.innerText = "Fetching...";
                    document.getElementById('errorMsg').style.display = 'none';
                    vscode.postMessage({ command: 'spinAgain' });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    const btn = document.getElementById('spinBtn');

                    switch (message.command) {
                        case 'newQuote':
                            const q = message.quote;
                            const textEl = document.getElementById('qText');
                            const authorEl = document.getElementById('qAuthor');
                            
                            textEl.style.opacity = 0;
                            authorEl.style.opacity = 0;
                            
                            setTimeout(() => {
                                textEl.innerText = '"' + q.text + '"';
                                authorEl.innerText = '- ' + q.author;
                                textEl.style.opacity = 1;
                                authorEl.style.opacity = 1;
                                btn.disabled = false;
                                btn.innerText = "✨ New Quote (1 Coin)";
                            }, 300);
                            break;
                            
                        case 'error':
                            btn.disabled = false;
                            btn.innerText = "✨ New Quote (1 Coin)";
                            const errorDiv = document.getElementById('errorMsg');
                            errorDiv.innerText = message.text;
                            errorDiv.style.display = 'block';
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    // private showQuoteReward(reward: Reward) {
    //    ... (removed method)
    // }

    private showImageReward(reward: Reward) {
        const panel = vscode.window.createWebviewPanel(
            'jackpotReward',
            `🎉 ${reward.label} 🎉`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        // Support simple keywords for Unsplash-like behavior
        let isKeyword = !reward.content.startsWith('http');
        let initialImageUrl = reward.content;
        
        if (isKeyword) {
            initialImageUrl = `https://loremflickr.com/800/600/${encodeURIComponent(reward.content)}?lock=${Math.floor(Math.random() * 100000)}`;
        }

        // Handle Messages from Webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'spinAgain':
                        const cost = 1;
                        if (this.wallet.spendCoins(cost)) {
                            // Success: Tell webview to reload
                             vscode.window.setStatusBarMessage(`Spent ${cost} coin for a respin!`, 2000);
                             panel.webview.postMessage({ command: 'reload' });
                        } else {
                            // Fail: Tell webview to show error
                            panel.webview.postMessage({ command: 'error', text: 'Not enough coins!' });
                        }
                        return;
                }
            },
            undefined,
            []
        );

        panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reward</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background-color: #1e1e1e;
                    color: white;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                h1 { margin-bottom: 10px; text-align: center; color: #f1c40f; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
                p { font-size: 1.2em; margin-bottom: 20px; color: #bdc3c7; }
                .image-container {
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                img { 
                    max-width: 90%; 
                    max-height: 60vh; 
                    border-radius: 10px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    transition: transform 0.2s;
                }
                img:hover { transform: scale(1.02); }
                button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    font-size: 16px;
                    background-color: #2ecc71;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.3s;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                button:hover { background-color: #27ae60; }
                button:active { transform: translateY(2px); }
                button:disabled { background-color: #95a5a6; cursor: not-allowed; }
                .error { color: #e74c3c; margin-top: 10px; font-weight: bold; display: none; }
                @keyframes popIn {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        </head>
        <body>
            <h1>🎰 JACKPOT! 🎰</h1>
            <p>${reward.label}</p>
            
            <div class="image-container">
                <img id="rewardImage" src="${initialImageUrl}" alt="Reward Image" />
            </div>

            ${isKeyword ? `<button id="spinBtn" onclick="requestSpin()">🔄 Spin Again (1 Coin)</button>` : ''}
            <div id="errorMsg" class="error"></div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function requestSpin() {
                    const btn = document.getElementById('spinBtn');
                    btn.disabled = true;
                    btn.innerText = "Spinning...";
                    document.getElementById('errorMsg').style.display = 'none';
                    
                    vscode.postMessage({ command: 'spinAgain' });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    const btn = document.getElementById('spinBtn');

                    switch (message.command) {
                        case 'reload':
                            const img = document.getElementById('rewardImage');
                            const baseUrl = "https://loremflickr.com/800/600/${encodeURIComponent(reward.content)}";
                            const newUrl = baseUrl + '?lock=' + Math.floor(Math.random() * 100000);
                            
                            img.style.opacity = 0.5;
                            img.src = newUrl;
                            
                            img.onload = () => { 
                                img.style.opacity = 1; 
                                btn.disabled = false;
                                btn.innerText = "🔄 Spin Again (1 Coin)";
                            };
                            break;
                            
                        case 'error':
                            btn.disabled = false;
                            btn.innerText = "🔄 Spin Again (1 Coin)";
                            const errorDiv = document.getElementById('errorMsg');
                            errorDiv.innerText = message.text;
                            errorDiv.style.display = 'block';
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
