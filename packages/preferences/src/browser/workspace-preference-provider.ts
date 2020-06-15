import { Injectable, Autowired } from '@ali/common-di';
import { URI, DisposableCollection } from '@ali/ide-core-browser';
import { PreferenceScope, PreferenceProvider } from '@ali/ide-core-browser/lib/preferences';
import { IWorkspaceService } from '@ali/ide-workspace';
import { WorkspaceFilePreferenceProviderFactory } from './workspace-file-preference-provider';

@Injectable()
export class WorkspacePreferenceProvider extends PreferenceProvider {

  public name: 'workspace';

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(WorkspaceFilePreferenceProviderFactory)
  protected readonly workspaceFileProviderFactory: WorkspaceFilePreferenceProviderFactory;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Folder })
  protected readonly folderPreferenceProvider: PreferenceProvider;

  constructor() {
    super();
    this.init();
  }

  protected async init(): Promise<void> {
    this._ready.resolve();
    this.ensureDelegateUpToDate();
    this.workspaceService.onWorkspaceLocationChanged(() => this.ensureDelegateUpToDate());
  }

  getConfigUri(resourceUri: string | undefined = this.ensureResourceUri()): URI | undefined {
    const delegate = this.delegate;
    return delegate && delegate.getConfigUri(resourceUri);
  }

  protected _delegate: PreferenceProvider | undefined;
  protected get delegate(): PreferenceProvider | undefined {
    if (!this._delegate) {
      this.ensureDelegateUpToDate();
    }
    return this._delegate;
  }

  protected readonly toDisposeOnEnsureDelegateUpToDate = new DisposableCollection();
  protected ensureDelegateUpToDate(): void {
    const delegate = this.createDelegate();
    if (this._delegate !== delegate) {
      this.toDisposeOnEnsureDelegateUpToDate.dispose();
      this.toDispose.push(this.toDisposeOnEnsureDelegateUpToDate);

      this._delegate = delegate;

      if (delegate) {
        this.toDisposeOnEnsureDelegateUpToDate.pushAll([
          delegate,
          delegate.onDidPreferencesChanged((changes) => this.emitPreferencesChangedEvent(changes)),
        ]);
      }
    }
  }

  protected createDelegate(): PreferenceProvider | undefined {
    const workspace = this.workspaceService.workspace;
    if (!workspace) {
      return undefined;
    }
    // 如果不是在多工作区模式下，返回folderPreferenceProvider
    if (!this.workspaceService.isMultiRootWorkspaceOpened) {
      return this.folderPreferenceProvider;
    }
    return this.workspaceFileProviderFactory({
      workspaceUri: new URI(workspace.uri),
    });
  }

  doGet<T>(preferenceName: string, resourceUri: string | undefined = this.ensureResourceUri(), language?: string): T | undefined {
    const delegate = this.delegate;
    return delegate ? delegate.get<T>(preferenceName, resourceUri, language) : undefined;
  }

  doResolve<T>(preferenceName: string, resourceUri: string | undefined = this.ensureResourceUri(), language?: string): { value?: T, configUri?: URI } {
    const delegate = this.delegate;
    return delegate ? delegate.resolve<T>(preferenceName, resourceUri, language) : {};
  }

  getPreferences(resourceUri: string | undefined = this.ensureResourceUri(), language?: string): { [p: string]: any } {
    const delegate = this.delegate;
    return delegate ? delegate.getPreferences(resourceUri, language) : {};
  }

  getLanguagePreferences(resourceUri: string | undefined = this.ensureResourceUri()) {
    const delegate = this.delegate;
    return delegate ? delegate.getLanguagePreferences(resourceUri) : {};
  }

  async doSetPreference(preferenceName: string, value: any, resourceUri: string | undefined = this.ensureResourceUri(), language?: string): Promise<boolean> {
    const delegate = this.delegate;
    if (delegate) {
      return delegate.setPreference(preferenceName, value, resourceUri, language);
    }
    return false;
  }

  protected ensureResourceUri(): string | undefined {
    if (this.workspaceService.workspace && !this.workspaceService.isMultiRootWorkspaceOpened) {
      return this.workspaceService.workspace.uri;
    }
    return undefined;
  }

}
