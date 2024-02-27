import { ExperimentManager } from 'traceviewer-base/lib/experiment-manager';
import { TraceManager } from 'traceviewer-base/lib/trace-manager';
import { TspClient } from 'tsp-typescript-client/lib/protocol/tsp-client';
import * as vscode from 'vscode';
import { TspClientProvider } from 'vscode-trace-common/lib/client/tsp-client-provider-impl';

/**
 * Use a single TspClientProvider for the VSCode Backend.
 */

let _root = updateUriRootFromUserSettings();
let _path = updateApiPathFromUserSettings();
let _url = _root + _path;

const backendTspClientProvider = new TspClientProvider(_url, undefined);

export const getTraceServerUrl = (): string => _root;
export const getTspApiEndpoint = (): string => _path;
export const getTspClientUrl = (): string => _url;

export const getTspClient = (): TspClient => backendTspClientProvider.getTspClient();
export const getExperimentManager = (): ExperimentManager => backendTspClientProvider.getExperimentManager();
export const getTraceManager = (): TraceManager => backendTspClientProvider.getTraceManager();

export const updateTspUrl = (): void => {
    _root = updateUriRootFromUserSettings();
    _path = updateApiPathFromUserSettings();
    _url = _root + _path;
    backendTspClientProvider.updateTspClientUri(_url);
}

export const addTspClientChangeListener = (listenerFunction: (tspClient: TspClient) => void): void => {
    backendTspClientProvider.addTspClientChangeListener(listenerFunction);
}

function updateUriRootFromUserSettings(): string {
    const tsConfig = vscode.workspace.getConfiguration('trace-compass.traceserver');
    const traceServerUrl: string = tsConfig.get<string>('url') || 'http://localhost:8080';
    _root = traceServerUrl.endsWith('/') ? traceServerUrl : traceServerUrl + '/';
    return _root;
}

function updateApiPathFromUserSettings(): string {
    const tsConfig = vscode.workspace.getConfiguration('trace-compass.traceserver');
    _path = tsConfig.get<string>('apiPath') || 'tsp/api';
    return _path;
}

