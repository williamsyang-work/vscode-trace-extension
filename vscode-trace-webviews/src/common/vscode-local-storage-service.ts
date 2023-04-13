
import { PersistedState } from "traceviewer-react-components/lib/components/trace-context-component";
import { Memento } from "vscode";

// Functional paradigm so we can bind the storage without needing to 
//  instantiate a class.
const key = "PERSISTED_STATE";
let storage: Memento;

export default {

    bindStorage(s: Memento): void {
        storage = s;
    },

    getValue<T>(key: string): T | undefined {
        return storage.get<T>(key);
    },

    setValue<T>(key: string, value: T): void {
        storage.update(key, value);
    },

    getPersistedState(): PersistedState | undefined {
        return storage.get<PersistedState>(key);
    },

    setPersistedState(ps: PersistedState): void {
        storage.update(key, ps);
    },
}