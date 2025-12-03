import * as vscode from 'vscode';

export interface DiffStats {
    linesAdded: number; // Total lines (typed + pasted)
    linesRemoved: number; // Total lines removed
    charsAdded: number; // Total chars (typed + pasted)
    charsRemoved: number; // Total chars removed
    
    typedLinesAdded: number;
    typedCharsAdded: number;
    bulkLinesAdded: number; // Formerly pastedLinesAdded
    bulkCharsAdded: number; // Formerly pastedCharsAdded

    typedLinesRemoved: number;
    typedCharsRemoved: number;
    bulkLinesRemoved: number;
    bulkCharsRemoved: number;
}

export interface ThresholdConfig {
    medium: { lines: number; chars: number };
    large: { lines: number; chars: number };
    epic: { lines: number; chars: number };
}

export class DiffTracker {
    private changes = new Map<string, DiffStats>();

    constructor() {}

    public onDidChange(event: vscode.TextDocumentChangeEvent, bulkThreshold: number) {
        const key = event.document.uri.toString();
        let stats = this.changes.get(key) || {
            linesAdded: 0, linesRemoved: 0, charsAdded: 0, charsRemoved: 0,
            typedLinesAdded: 0, typedCharsAdded: 0, bulkLinesAdded: 0, bulkCharsAdded: 0,
            typedLinesRemoved: 0, typedCharsRemoved: 0, bulkLinesRemoved: 0, bulkCharsRemoved: 0
        };

        for (const change of event.contentChanges) {
            const linesAdded = (change.text.match(/\n/g) || []).length;
            const linesRemoved = change.range.end.line - change.range.start.line;
            const charsAdded = change.text.replace(/\s/g, '').length; // Exclude whitespace from count
            const removedText = event.document.getText(change.range);
            const charsRemoved = removedText.replace(/\s/g, '').length; // Exclude whitespace removed

            // Only count lines when non-whitespace content was added/removed
            if (charsAdded > 0) {
                stats.linesAdded += linesAdded;
                stats.charsAdded += charsAdded;
            }
            if (charsRemoved > 0) {
                stats.linesRemoved += linesRemoved;
                stats.charsRemoved += charsRemoved;
            }

            // Classify additions
            if (charsAdded > bulkThreshold) { 
                stats.bulkLinesAdded += linesAdded;
                stats.bulkCharsAdded += charsAdded;
            } else { // Assume typed (includes small autocompletes)
                if (charsAdded > 0) {
                    stats.typedLinesAdded += linesAdded;
                    stats.typedCharsAdded += charsAdded;
                }
            }

            // Classify removals
            if (charsRemoved > bulkThreshold) { 
                stats.bulkLinesRemoved += linesRemoved;
                stats.bulkCharsRemoved += charsRemoved;
            } else { // Assume typed removal (e.g., backspace, small refactor delete)
                if (charsRemoved > 0) {
                    stats.typedLinesRemoved += linesRemoved;
                    stats.typedCharsRemoved += charsRemoved;
                }
            }
        }
        this.changes.set(key, stats);
    }

    public getAndResetStats(document: vscode.TextDocument): DiffStats {
        const key = document.uri.toString();
        const stats = this.changes.get(key) || {
            linesAdded: 0, linesRemoved: 0, charsAdded: 0, charsRemoved: 0,
            typedLinesAdded: 0, typedCharsAdded: 0, bulkLinesAdded: 0, bulkCharsAdded: 0,
            typedLinesRemoved: 0, typedCharsRemoved: 0, bulkLinesRemoved: 0, bulkCharsRemoved: 0
        };
        this.changes.delete(key);
        return stats;
    }

    public getMagnitude(stats: DiffStats, config: ThresholdConfig): 'Small' | 'Medium' | 'Large' | 'Epic' {
        // Define weights for different types of changes
        const TYPED_ADD_WEIGHT = 1.0;
        const BULK_ADD_WEIGHT = 0.2;
        const TYPED_REMOVE_WEIGHT = 0.0; // Deletions are not rewarded
        const BULK_REMOVE_WEIGHT = 0.0; // Deletions are not rewarded

        // Calculate effective lines and characters based on weights
        const effectiveLines = 
            (stats.typedLinesAdded * TYPED_ADD_WEIGHT) +
            (stats.bulkLinesAdded * BULK_ADD_WEIGHT) +
            (stats.typedLinesRemoved * TYPED_REMOVE_WEIGHT) +
            (stats.bulkLinesRemoved * BULK_REMOVE_WEIGHT);

        const effectiveChars = 
            (stats.typedCharsAdded * TYPED_ADD_WEIGHT) +
            (stats.bulkCharsAdded * BULK_ADD_WEIGHT) +
            (stats.typedCharsRemoved * TYPED_REMOVE_WEIGHT) +
            (stats.bulkCharsRemoved * BULK_REMOVE_WEIGHT);
        
        if (effectiveLines > config.epic.lines || effectiveChars > config.epic.chars) {
            return 'Epic';
        }
        if (effectiveLines > config.large.lines || effectiveChars > config.large.chars) {
            return 'Large';
        }
        if (effectiveLines > config.medium.lines || effectiveChars > config.medium.chars) {
            return 'Medium';
        }
        return 'Small';
    }
}
