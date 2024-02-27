import { ExperimentManager } from 'traceviewer-base/lib/experiment-manager';
import { TraceManager } from 'traceviewer-base/lib/trace-manager';
import { TspClient } from 'tsp-typescript-client/lib/protocol/tsp-client';
import * as vscode from 'vscode';
import { TspClientProvider } from 'vscode-trace-common/lib/client/tsp-client-provider-impl';

/**
 * Functional paradigm approach for a singleton TspClientProvider
 *  for the Trace Extension's VSCode Backend
 */

let _root = getUriRootFromUserSettings();
let _path = getApiPathFromUserSettings();
let _url = _root + _path;

const backendTspClientProvider = new TspClientProvider(_url, undefined);

export const getTraceServerUrl = (): string => _root;
export const getTspApiEndpoint = (): string => _path;
export const getTspClientUrl = (): string => _url;

export const getTspClient = (): TspClient => backendTspClientProvider.getTspClient();
export const getExperimentManager = (): ExperimentManager => backendTspClientProvider.getExperimentManager();
export const getTraceManager = (): TraceManager => backendTspClientProvider.getTraceManager();

export const updateTspUrl = (): void => {
    _root = getUriRootFromUserSettings();
    _path = getApiPathFromUserSettings();
    _url = _root + _path;
    backendTspClientProvider.updateTspClientUrl(_url);
}

export const addTspClientChangeListener = (listenerFunction: (tspClient: TspClient) => void): void => {
    backendTspClientProvider.addTspClientChangeListener(listenerFunction);
}

/**
 * Get the status of the server.
 * @returns server status as boolean
 */
export async function tspClientStatus(): Promise<boolean> {
    const health = await getTspClient().checkHealth();
    const status = health.getModel()?.status;
    return health.isOk() && status === 'UP';
}

function getUriRootFromUserSettings(): string {
    const tsConfig = vscode.workspace.getConfiguration('trace-compass.traceserver');
    const traceServerUrl: string = tsConfig.get<string>('url') || 'http://localhost:8080';
    _root = traceServerUrl.endsWith('/') ? traceServerUrl : traceServerUrl + '/';
    return _root;
}

function getApiPathFromUserSettings(): string {
    const tsConfig = vscode.workspace.getConfiguration('trace-compass.traceserver');
    _path = tsConfig.get<string>('apiPath') || 'tsp/api';
    return _path;
}

