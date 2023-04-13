
import { PersistedState } from "traceviewer-react-components/lib/components/trace-context-component";
import * as vscode from "vscode";

// Functional paradigm so we can bind the storage without needing to 
//  instantiate a class.

// TODO - make this more robust and less hacky.
const key = "PERSISTED_STATE";
let storage: vscode.Memento;

const LocalStorageService = {

    bindStorage(s: vscode.Memento): void {
        storage = s;
    },

    getValue<T>(key: string): T | undefined {
        return storage.get<T>(key);
    },

    setValue<T>(key: string, value: T): Thenable<void> {
        return storage.update(key, value);
    },

    getPersistedState(): PersistedState | undefined {
        return storage.get<PersistedState>(key);
    },

    setPersistedState(ps: PersistedState): Thenable<void> {
        return storage.update(key, ps);
    },
}

export default LocalStorageService;