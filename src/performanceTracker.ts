import * as vscode from 'vscode';

export interface PerformanceStats {
    wpm: number;
    flowDurationMinutes: number;
    errorCount: number;
    errorsFixed: number; // Positive if errors decreased, negative if increased
    isClean: boolean;
}

export class PerformanceTracker {
    // Flow State
    private sessionStartTime: number = Date.now();
    private lastActivityTime: number = Date.now();
    private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    // WPM Tracking
    private charTimestamps: number[] = [];
    private readonly WPM_WINDOW = 10000; // 10 seconds window

    // Diagnostics (Error Tracking)
    private previousErrorCounts = new Map<string, number>();

    constructor() {}

    public onDidChange(event: vscode.TextDocumentChangeEvent, bulkThreshold: number) {
        const now = Date.now();
        this.updateFlow(now);
        this.updateWPM(now, event, bulkThreshold);
    }

    private updateFlow(now: number) {
        if (now - this.lastActivityTime > this.IDLE_TIMEOUT) {
            // Reset session if idle too long
            this.sessionStartTime = now;
        }
        this.lastActivityTime = now;
    }

    private updateWPM(now: number, event: vscode.TextDocumentChangeEvent, bulkThreshold: number) {
        // Iterate changes to filter out pastes/generations
        for (const change of event.contentChanges) {
            const length = change.text.length;
            
            // Heuristic: If change is too large, assume it's a paste or gen -> Ignore for WPM
            if (length > 0 && length <= bulkThreshold) {
                for (let i = 0; i < length; i++) {
                    this.charTimestamps.push(now);
                }
            }
        }
        
        // Clean up old timestamps
        const cutoff = now - this.WPM_WINDOW;
        while (this.charTimestamps.length > 0 && this.charTimestamps[0] < cutoff) {
            this.charTimestamps.shift();
        }
    }

    public getStats(document: vscode.TextDocument): PerformanceStats {
        const now = Date.now();
        
        // 1. WPM Calculation
        // chars in last 10s / 5 chars per word * (60 / 10) = chars * 1.2
        const wpm = Math.round((this.charTimestamps.length / 5) * (60 / (this.WPM_WINDOW / 1000)));

        // 2. Flow Duration
        const flowDurationMinutes = Math.floor((now - this.sessionStartTime) / 60000);

        // 3. Diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
        
        const key = document.uri.toString();
        const prevErrors = this.previousErrorCounts.get(key) ?? errorCount; // Default to current if new
        const errorsFixed = prevErrors - errorCount;
        
        // Update for next time
        this.previousErrorCounts.set(key, errorCount);

        return {
            wpm,
            flowDurationMinutes,
            errorCount,
            errorsFixed,
            isClean: errorCount === 0
        };
    }

    public onDidClose(document: vscode.TextDocument) {
        this.previousErrorCounts.delete(document.uri.toString());
    }
}
