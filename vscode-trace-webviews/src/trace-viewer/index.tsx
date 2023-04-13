import * as React from 'react';
import ReactDOM from 'react-dom/client';
import TraceViewerContainer from './vscode-trace-viewer-container';
import { PersistedState } from 'traceviewer-react-components/lib/components/trace-context-component';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

/*
    These are attached to the window in trace-viewer-webview-panel.ts
    in method _getReactHtmlForWebview(): 
*/
declare global {
    interface Window {
        PersistedState: PersistedState;
        storePersistedState: (pState: PersistedState, experimentString: string) => void;
    }
}

root.render(
    <TraceViewerContainer
        persistedState={window.PersistedState}
        storePersistedState={window.storePersistedState}
    />
);
