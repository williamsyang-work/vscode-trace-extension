'use strict';
import * as vscode from 'vscode';
import { AnalysisProvider } from './trace-explorer/analysis-tree';
import { TraceExplorerItemPropertiesProvider } from './trace-explorer/properties/trace-explorer-properties-view-webview-provider';
import { TraceExplorerAvailableViewsProvider } from './trace-explorer/available-views/trace-explorer-available-views-webview-provider';
import { TraceExplorerOpenedTracesViewProvider } from './trace-explorer/opened-traces/trace-explorer-opened-traces-webview-provider';
import { fileHandler, openOverviewHandler } from './trace-explorer/trace-tree';
import { TraceViewerPanel } from './trace-viewer-panel/trace-viewer-webview-panel';
import { updateTspClient } from './utils/tspClient';
import { PersistedState } from 'traceviewer-react-components/lib/components/trace-context-component';

export function activate(context: vscode.ExtensionContext): void {

    const tracesProvider = new TraceExplorerOpenedTracesViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TraceExplorerOpenedTracesViewProvider.viewType, tracesProvider));

    const myAnalysisProvider = new TraceExplorerAvailableViewsProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TraceExplorerAvailableViewsProvider.viewType, myAnalysisProvider));

    const propertiesProvider = new TraceExplorerItemPropertiesProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TraceExplorerItemPropertiesProvider.viewType, propertiesProvider));

    context.subscriptions.push(vscode.commands.registerCommand('messages.post.propertiespanel', (command: string, data) => {
        if (propertiesProvider) {
            propertiesProvider.postMessagetoWebview(command, data);
        }
    }));

    const analysisProvider = new AnalysisProvider();
    // TODO: For now, a different command opens traces from file explorer. Remove when we have a proper trace finder
    const fileOpenHandler = fileHandler(analysisProvider);
    context.subscriptions.push(vscode.commands.registerCommand('traces.openTraceFile', file => {
        fileOpenHandler(context, file);
    }));

    // Listening to configuration change for the trace server URL
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('trace-compass.traceserver.url') || e.affectsConfiguration('trace-compass.traceserver.apiPath')) {
            updateTspClient();
        }
    }));

    const overViewOpenHanlder = openOverviewHandler();
    context.subscriptions.push(vscode.commands.registerCommand('outputs.openOverview', () => {
        overViewOpenHanlder();
    }));

    vscode.window.registerWebviewPanelSerializer(TraceViewerPanel.viewType, {
        async deserializeWebviewPanel(
            webviewPanel: vscode.WebviewPanel,
            state: { pState: PersistedState, experimentString: string }
        ) {
            console.dir('deserializeWebviewPanel')
            if (state) {
                const { pState, experimentString } = state;
                console.dir(state);
                console.dir(`experiment`);
                console.dir(experimentString);
                TraceViewerPanel.revive(webviewPanel, context.extensionUri, pState, experimentString);
            } else {
                webviewPanel.dispose();
            }
        },
    });
}
