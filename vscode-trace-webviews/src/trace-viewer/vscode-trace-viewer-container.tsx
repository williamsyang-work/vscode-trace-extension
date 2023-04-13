/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham-dark.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';
import JSONBigConfig from 'json-bigint';
import * as React from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { signalManager, Signals } from 'traceviewer-base/lib/signals/signal-manager';
import { PersistedState, TraceContextComponent } from 'traceviewer-react-components/lib/components/trace-context-component';
import 'traceviewer-react-components/style/trace-context-style.css';
import { Experiment } from 'tsp-typescript-client/lib/models/experiment';
import { OutputDescriptor } from 'tsp-typescript-client/lib/models/output-descriptor';
import { TspClient } from 'tsp-typescript-client/lib/protocol/tsp-client';
import { VsCodeMessageManager } from '../common/vscode-message-manager';
import { convertSignalExperiment } from '../common/vscode-signal-converter';
import '../style/trace-viewer.css';

const JSONBig = JSONBigConfig({
    useNativeBigInt: true,
});

interface VscodeAppProps { 
    persistedState?: PersistedState;
    storePersistedState: (pState: PersistedState, experimentString: string) => void;
}

interface VscodeAppState {
  experiment: Experiment | undefined;
  tspClient: TspClient | undefined;
  outputs: OutputDescriptor[];
  overviewOutputDescriptor: OutputDescriptor| undefined;
  theme: string;
}

class TraceViewerContainer extends React.Component<VscodeAppProps, VscodeAppState>  {
  private DEFAULT_OVERVIEW_DATA_PROVIDER_ID = 'org.eclipse.tracecompass.internal.tmf.core.histogram.HistogramDataProvider';

  private _signalHandler: VsCodeMessageManager;
  private _interval: ReturnType<typeof setInterval>;

  private _onProperties = (properties: { [key: string]: string }): void => this.doHandlePropertiesSignal(properties);
  /** Signal Handlers */
  private doHandlePropertiesSignal(properties: { [key: string]: string }) {
      this._signalHandler.propertiesUpdated(properties);
  }

  // TODO add support for marker sets
  private selectedMarkerCategoriesMap: Map<string, string[]> = new Map<string, string[]>();
  private selectedMarkerSetId = '';

  private _onOverviewSelected = (payload: {traceId: string, outputDescriptor: OutputDescriptor}): void => this.doHandleOverviewSelectedSignal(payload);

  protected resizeHandlers: (() => void)[] = [];
  protected readonly addResizeHandler = (h: () => void): void => {
      this.resizeHandlers.push(h);
  };
  protected readonly removeResizeHandler = (h: () => void): void => {
      const index = this.resizeHandlers.indexOf(h, 0);
      if (index > -1) {
          this.resizeHandlers.splice(index, 1);
      }
  };

  protected traceContextComponent = React.createRef<TraceContextComponent>();

  constructor(props: VscodeAppProps) {
      super(props);
      this.state = {
          experiment: undefined,
          tspClient: undefined,
          outputs: this.props.persistedState?.outputs || [],
          overviewOutputDescriptor: undefined,
          theme: 'light'
      };
      this._signalHandler = new VsCodeMessageManager();

      window.addEventListener('message', event => {

          const message = event.data; // The JSON data our extension sent
          switch (message.command) {
          case 'set-experiment':
              this.doHandleExperimentSetSignal(convertSignalExperiment(JSONBig.parse(message.data)));
              break;
          case 'set-tspClient':
              this.setState({tspClient: new TspClient(message.data)});
              break;
          case 'add-output':
              // FIXME: JSONBig.parse() create bigint if numbers are small
              // Not an issue right now for output descriptors.
              const descriptor = JSONBig.parse(message.data);
              this.setState({outputs: [...this.state.outputs, descriptor] });
              break;
          case 'open-overview':
              this.doHandleExperimentSetSignal(this.state.experiment);
              break;
          case 'set-theme':
              this.doHandleThemeChanged(message.data);
          }
      });
      window.addEventListener('resize', this.onResize);
      this.onOutputRemoved = this.onOutputRemoved.bind(this);
      this.onOverviewRemoved = this.onOverviewRemoved.bind(this);
      signalManager().on(Signals.OVERVIEW_OUTPUT_SELECTED, this._onOverviewSelected);
      this._interval = setInterval(() => this.storePersistedState(), 2000);
  }

  componentDidMount(): void {
      console.dir(`component did mount :)`);
      this._signalHandler.notifyReady();
      signalManager().on(Signals.ITEM_PROPERTIES_UPDATED, this._onProperties);
  }

  componentWillUnmount(): void {
      signalManager().off(Signals.ITEM_PROPERTIES_UPDATED, this._onProperties);
      signalManager().off(Signals.OVERVIEW_OUTPUT_SELECTED, this._onOverviewSelected);
      clearInterval(this._interval);
      window.removeEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
      this.resizeHandlers.forEach(h => h());
  };

  private onOutputRemoved(outputId: string) {
      const outputToKeep = this.state.outputs.filter(output => output.id !== outputId);
      this.setState({outputs: outputToKeep});
  }

  protected onOverviewRemoved(): void {
      this.setState({overviewOutputDescriptor: undefined});
  }

  protected async doHandleExperimentSetSignal(experiment: Experiment| undefined): Promise<void> {
      if (experiment) {
          const defaultOverviewDescriptor: OutputDescriptor | undefined  = await this.getDefaultTraceOverviewOutputDescriptor(experiment);
          this.setState({
              experiment: experiment,
              overviewOutputDescriptor: defaultOverviewDescriptor});
      }
  }

  protected doHandleOverviewSelectedSignal(payload: {traceId: string, outputDescriptor: OutputDescriptor}): void {
      if (this.state.experiment && payload && payload?.traceId === this.state.experiment.UUID && payload.outputDescriptor){
          this.setState({overviewOutputDescriptor: payload.outputDescriptor});
      }
  }

  protected doHandleThemeChanged(theme: string): void {
      this.setState({ theme }, () => {
          signalManager().fireThemeChangedSignal(theme);
      });
  }

  protected async getDefaultTraceOverviewOutputDescriptor(experiment: Experiment| undefined): Promise<OutputDescriptor | undefined> {
      const availableDescriptors = await this.getAvailableTraceOverviewOutputDescriptor(experiment);
      return availableDescriptors?.find(output => output.id === this.DEFAULT_OVERVIEW_DATA_PROVIDER_ID);
  }

  protected async getAvailableTraceOverviewOutputDescriptor(experiment: Experiment| undefined): Promise<OutputDescriptor[] | undefined> {
      let descriptors: OutputDescriptor[] | undefined;
      if (experiment && this.state.tspClient) {
          const outputsResponse = await this.state.tspClient.experimentOutputs(experiment.UUID);
          if (outputsResponse && outputsResponse.isOk()) {
              descriptors = outputsResponse.getModel();
          }
          const overviewOutputDescriptors = descriptors?.filter(output => output.type === 'TREE_TIME_XY');
          return overviewOutputDescriptors;
      }
  }

  public storePersistedState = (): void => {
    // WILLY - figure out when / where / how to fire this.
    // Persisted state is not stored on close.  It is stored stored ongoing througout use. ??? fml.
    if (this.traceContextComponent.current) {
        try {
            const experimentString = JSONBig.stringify(this.state.experiment);
            this.props.storePersistedState(this.traceContextComponent.current.persistedState, experimentString);
        } catch (err) {
            console.dir(this.props.storePersistedState);
            console.dir(err);
        }
    }
  }

  public render(): React.ReactNode {
      return (
          <div className="trace-viewer-container">
              { this.state.experiment && this.state.tspClient && <TraceContextComponent
                  ref={this.traceContextComponent}
                  experiment={this.state.experiment}
                  tspClient={this.state.tspClient}
                  outputs={this.state.outputs}
                  overviewDescriptor={this.state.overviewOutputDescriptor}
                  markerCategoriesMap={this.selectedMarkerCategoriesMap}
                  markerSetId={this.selectedMarkerSetId}
                  messageManager={this._signalHandler}
                  onOutputRemove={this.onOutputRemoved}
                  onOverviewRemove={this.onOverviewRemoved}
                  // eslint-disable-next-line @typescript-eslint/no-empty-function
                  addResizeHandler={this.addResizeHandler}
                  removeResizeHandler={this.removeResizeHandler}
                  backgroundTheme={this.state.theme}
                  persistedState={this.props.persistedState}></TraceContextComponent>
              }
          </div>
      );
  }
}

export default TraceViewerContainer;
