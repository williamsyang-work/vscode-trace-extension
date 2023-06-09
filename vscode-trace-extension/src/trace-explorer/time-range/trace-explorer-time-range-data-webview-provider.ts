import * as vscode from 'vscode';
import { getTraceServerUrl } from 'vscode-trace-extension/src/utils/tspClient';
import JSONBigConfig from 'json-bigint';
import { Signals, signalManager } from 'traceviewer-base/lib/signals/signal-manager';
import { TimeRangeUpdatePayload } from 'traceviewer-base/lib/signals/time-range-data-signal-payloads';
import { Experiment } from 'tsp-typescript-client/lib/models/experiment';
import { convertSignalExperiment } from 'vscode-trace-common/lib/signals/vscode-signal-converter';
import { VSCODE_MESSAGES } from 'vscode-trace-common/lib/messages/vscode-message-manager';

const JSONBig = JSONBigConfig({
    useNativeBigInt: true,
});

export class TraceExplorerTimeRangeDataProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'traceExplorer.timeRangeData';
  private _view: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
  ): void {
      this._view = webviewView;
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
      webviewView.webview.options = {
          // Allow scripts in the webview
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'pack')],
      };

      webviewView.webview.onDidReceiveMessage(message => {
          const command = message?.command;
          const parsedData = message?.data ? JSONBig.parse(message.data) : undefined;
          
            switch (command) {
                case VSCODE_MESSAGES.EXPERIMENT_SELECTED:
                    signalManager().fireExperimentExperimentSignal(
                        parsedData?.wrapper ? convertSignalExperiment(parsedData.wrapper) : parsedData
                    );
                    break;
                case VSCODE_MESSAGES.EXPERIMENT_UPDATED:
                    signalManager().fireExperimentUpdatedSignal(
                        parsedData?.wrapper ? convertSignalExperiment(parsedData.wrapper) : parsedData
                    );
                    break;
                case VSCODE_MESSAGES.EXPERIMENT_CLOSED:
                    signalManager().fireExperimentClosedSignal(
                        parsedData?.wrapper ? convertSignalExperiment(parsedData.wrapper) : parsedData
                    );
                    break;
                case VSCODE_MESSAGES.SELECTION_RANGE_UPDATED:
                    signalManager().fireSelectionRangeUpdated(parsedData);
                    break;
                case VSCODE_MESSAGES.VIEW_RANGE_UPDATED:
                    signalManager().fireViewRangeUpdated(parsedData);
                    break;
                case VSCODE_MESSAGES.REQUEST_SELECTION_RANGE_CHANGE:
                    signalManager().fireRequestSelectionRangeChange(parsedData);
                    break;
                default:
                    console.log(`${command} is not a valid message for Time Range Data Widget`);
                    console.dir(message);
                    break;
            }
      }, undefined, this._disposables);

      signalManager().on(Signals.VIEW_RANGE_UPDATED, this.onViewRangeUpdated);
      signalManager().on(Signals.SELECTION_RANGE_UPDATED, this.onSelectionRangeUpdated);
      signalManager().on(Signals.EXPERIMENT_SELECTED, this.onExperimentSelected);
      signalManager().on(Signals.EXPERIMENT_UPDATED, this.onExperimentUpdated);
      signalManager().on(Signals.EXPERIMENT_CLOSED, this.onExperimentClosed);

      webviewView.onDidDispose(_event => {
        signalManager().off(Signals.VIEW_RANGE_UPDATED, this.onViewRangeUpdated);
        signalManager().off(Signals.SELECTION_RANGE_UPDATED, this.onSelectionRangeUpdated);
        signalManager().off(Signals.EXPERIMENT_SELECTED, this.onExperimentSelected);
        signalManager().off(Signals.EXPERIMENT_UPDATED, this.onExperimentUpdated);
        signalManager().off(Signals.EXPERIMENT_CLOSED, this.onExperimentClosed);
      }, undefined, this._disposables);
  }

  /* EVENT HANDLERS */
  private onViewRangeUpdated = (update: TimeRangeUpdatePayload) => {
    this._view.webview.postMessage({ command: VSCODE_MESSAGES.VIEW_RANGE_UPDATED, data: JSONBig.stringify(update)});
  }
  private onSelectionRangeUpdated = (update: TimeRangeUpdatePayload) => {
    this._view.webview.postMessage({ command: VSCODE_MESSAGES.SELECTION_RANGE_UPDATED, data: JSONBig.stringify(update)});
  }
  
  private onExperimentSelected = (experiment: Experiment) => {
    const data = { wrapper: JSONBig.stringify(experiment) }
    this._view.webview.postMessage({ command: VSCODE_MESSAGES.EXPERIMENT_SELECTED, data });
  }
  private onExperimentUpdated = (experiment: Experiment) => {
    const data = { wrapper: JSONBig.stringify(experiment) };
    this._view.webview.postMessage({ command: VSCODE_MESSAGES.EXPERIMENT_UPDATED, data });
  }
  private onExperimentClosed = (experiment: Experiment) => {
    const data = { wrapper: JSONBig.stringify(experiment) };
    this._view.webview.postMessage({ command: VSCODE_MESSAGES.EXPERIMENT_CLOSED, data });
  }

  /* eslint-disable max-len */
  private _getHtmlForWebview(webview: vscode.Webview) {
      // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
      const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'pack', 'timeRangePanel.js'));

      // Use a nonce to only allow a specific script to be run.
      const nonce = getNonce();

      return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>React App</title>
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}' 'unsafe-eval';style-src vscode-resource: 'unsafe-inline' http: https: data:;connect-src ${getTraceServerUrl()};">
				<base href="${vscode.Uri.joinPath(this._extensionUri, 'pack').with({ scheme: 'vscode-resource' })}/">
			</head>

			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				
                <script nonce="${nonce}">
					const vscode = acquireVsCodeApi();
				</script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
			</html>`;
  }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

