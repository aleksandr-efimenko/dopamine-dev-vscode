import * as assert from 'assert';
import * as vscode from 'vscode';
import { DiffTracker, ThresholdConfig } from '../src/diffTracker';

suite('DiffTracker Tests', () => {
    let diffTracker: DiffTracker;
    const bulkThreshold = 50;

    setup(() => {
        diffTracker = new DiffTracker();
    });

    function createMockDocument(uri: string, getText: (range: vscode.Range) => string) {
        return {
            uri: vscode.Uri.parse(uri),
            getText: getText
        } as vscode.TextDocument;
    }

    function createMockChangeEvent(document: vscode.TextDocument, changes: { text: string, range: vscode.Range }[]) {
        return {
            document: document,
            contentChanges: changes.map(c => ({
                range: c.range,
                rangeOffset: 0,
                rangeLength: 0,
                text: c.text
            })),
            reason: undefined
        } as vscode.TextDocumentChangeEvent;
    }

    test('Tracks typed additions correctly', () => {
        const uri = 'file:///test.ts';
        const doc = createMockDocument(uri, () => "");
        
        // Simulate typing "const a = 1;"
        const changes = [{
            text: "const a = 1;",
            range: new vscode.Range(0, 0, 0, 0)
        }];

        diffTracker.onDidChange(createMockChangeEvent(doc, changes), bulkThreshold);
        const stats = diffTracker.getAndResetStats(doc);

        assert.strictEqual(stats.charsAdded, 9); // "consta=1;" (spaces removed)
        assert.strictEqual(stats.typedCharsAdded, 9);
        assert.strictEqual(stats.bulkCharsAdded, 0);
    });

    test('Tracks bulk additions (paste) correctly', () => {
        const uri = 'file:///test.ts';
        const doc = createMockDocument(uri, () => "");
        
        // Simulate pasting a long string
        const longText = "a".repeat(60); // > 50 bulk threshold
        const changes = [{
            text: longText,
            range: new vscode.Range(0, 0, 0, 0)
        }];

        diffTracker.onDidChange(createMockChangeEvent(doc, changes), bulkThreshold);
        const stats = diffTracker.getAndResetStats(doc);

        assert.strictEqual(stats.charsAdded, 60);
        assert.strictEqual(stats.typedCharsAdded, 0);
        assert.strictEqual(stats.bulkCharsAdded, 60);
    });

    test('Tracks deletions correctly', () => {
        const uri = 'file:///test.ts';
        const deletedText = "deleted code";
        const doc = createMockDocument(uri, (range) => deletedText);
        
        const changes = [{
            text: "", // Deletion adds empty text
            range: new vscode.Range(0, 0, 0, 12) // Length of deleted text
        }];

        diffTracker.onDidChange(createMockChangeEvent(doc, changes), bulkThreshold);
        const stats = diffTracker.getAndResetStats(doc);

        assert.strictEqual(stats.charsRemoved, 11); // "deletedcode"
        assert.strictEqual(stats.typedCharsRemoved, 11);
    });

    test('Calculates Magnitude correctly', () => {
        const config: ThresholdConfig = {
            medium: { lines: 5, chars: 100 },
            large: { lines: 20, chars: 500 },
            epic: { lines: 50, chars: 2000 }
        };

        const uri = 'file:///test.ts';
        const doc = createMockDocument(uri, () => "");

        // 1. Small
        let changes = [{ text: "small change", range: new vscode.Range(0,0,0,0) }];
        diffTracker.onDidChange(createMockChangeEvent(doc, changes), bulkThreshold);
        let stats = diffTracker.getAndResetStats(doc);
        assert.strictEqual(diffTracker.getMagnitude(stats, config), 'Small');

        // 2. Medium ( > 100 chars)
        const mediumText = "a".repeat(101);
        changes = [{ text: mediumText, range: new vscode.Range(0,0,0,0) }];
        diffTracker.onDidChange(createMockChangeEvent(doc, changes), bulkThreshold);
        stats = diffTracker.getAndResetStats(doc); // Note: this is treated as bulk usually if threshold is 50
        
        // Wait, if bulk threshold is 50, this is bulk.
        // Bulk weight is 0.2. So 100 chars * 0.2 = 20 effective chars. Still Small.
        // Let's try multiple small typed changes to accumulate magnitude.
        
        // Reset
        diffTracker = new DiffTracker();
        
        // Simulate many small changes (typing)
        for(let i=0; i<11; i++) {
            diffTracker.onDidChange(createMockChangeEvent(doc, [{ text: "1234567890", range: new vscode.Range(0,0,0,0) }]), bulkThreshold);
        }
        stats = diffTracker.getAndResetStats(doc);
        // 110 typed chars. > 100 threshold.
        assert.strictEqual(diffTracker.getMagnitude(stats, config), 'Medium');
    });
});
