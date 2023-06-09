[] /* eslint-disable @typescript-eslint/ban-types */
import * as React from 'react';
import { Signals, signalManager } from 'traceviewer-base/lib/signals/signal-manager';
import { ReactTimeRangeDataWidget } from 'traceviewer-react-components/lib/trace-explorer/trace-explorer-time-range-data-widget';
import 'traceviewer-react-components/style/trace-explorer.css';
// import { Experiment } from 'tsp-typescript-client/lib/models/experiment';
import '../../style/react-contextify.css';
import '../../style/trace-viewer.css';
import JSONBigConfig from 'json-bigint';
import { convertSignalExperiment } from 'vscode-trace-common/lib/signals/vscode-signal-converter';
import { VSCODE_MESSAGES, VsCodeMessageManager } from 'vscode-trace-common/lib/messages/vscode-message-manager';
import { TimeRangeUpdatePayload } from 'traceviewer-base/lib/signals/time-range-data-signal-payloads';

const JSONBig = JSONBigConfig({
    useNativeBigInt: true,
});

class TimeRangeDataWidget extends React.Component {
  private _signalHandler: VsCodeMessageManager;

  static ID = 'trace-explorer-time-range-data-widget';
  static LABEL = 'Time Range Data';

  constructor(props: {}) {
      super(props);
      this._signalHandler = new VsCodeMessageManager();
      window.addEventListener('message', this.onMessage);
  }

  componentWillMount(): void {
    signalManager().on(Signals.REQUEST_SELECTION_RANGE_CHANGE, this.onRequestSelectionChange);
  }

  componentWillUnmount(): void {
    signalManager().off(Signals.REQUEST_SELECTION_RANGE_CHANGE, this.onRequestSelectionChange);
  }

  onRequestSelectionChange = (payload: TimeRangeUpdatePayload) => {
    this._signalHandler.requestSelectionRangeChange(payload);
  }

  onMessage = (event: MessageEvent<any>): void => {

    const { command, data } = event.data;

    const experiment = data.wrapper ? convertSignalExperiment(JSONBig.parse(data.wrapper)) : undefined;
    const parsedData: TimeRangeUpdatePayload = !experiment ? JSONBig.parse(data) : undefined;

    switch (command) {
        case VSCODE_MESSAGES.EXPERIMENT_SELECTED:
            signalManager().fireExperimentSelectedSignal(experiment);
            break;
        case VSCODE_MESSAGES.EXPERIMENT_UPDATED:
            experiment && signalManager().fireExperimentUpdatedSignal(experiment);
            break;
        case VSCODE_MESSAGES.EXPERIMENT_CLOSED:
            // TODO - make sure this signal is getting passed.
            experiment && signalManager().fireExperimentClosedSignal(experiment);
            break;
        case VSCODE_MESSAGES.SELECTION_RANGE_UPDATED:
            parsedData && signalManager().fireSelectionRangeUpdated(parsedData);
            break;
        case VSCODE_MESSAGES.VIEW_RANGE_UPDATED:
            parsedData && signalManager().fireViewRangeUpdated(parsedData);
            break;
    }
    
  }


  componentDidMount(): void {
      this._signalHandler.notifyReady();
  }

  public render(): React.ReactNode {
      return (
        <div>
            <ReactTimeRangeDataWidget
                id={TimeRangeDataWidget.ID}
                title={TimeRangeDataWidget.LABEL}
            />
        </div>
      )
  }
}

export default TimeRangeDataWidget;
