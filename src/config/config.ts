import * as vscode from 'vscode';
import { HasDisposables } from '../disposable';
import { EventSource, EventHandler, EventHandlerRegistrar, isEventSource } from '../event/event';
import { SymbolResolverI, WorkspaceSymbolResolver, resolveSymbols } from './symbol';

export interface ConfigurationPropertyI {
  readonly name: string;
  hardResetOnChange: boolean;
  readonly symbolResolvers: SymbolResolverI[];
  reload(vscodeConfig: vscode.WorkspaceConfiguration): void;
  get(vscodeConfig: vscode.WorkspaceConfiguration): any | undefined;
}

export class ConfigurationProperty<T> extends EventSource<T | undefined> implements ConfigurationPropertyI {
  private value = this.defaultValue;
  public constructor(
    public readonly name: string,
    private readonly defaultValue: T | undefined,
    public readonly hardResetOnChange: boolean = false,
    public readonly symbolResolvers: SymbolResolverI[] = []
  ) {
    super();
  }
  public reload(): void {}
  public get(vscodeConfig: vscode.WorkspaceConfiguration): T | undefined {
    let v = this.defaultValue ? vscodeConfig.get<T>(this.name, this.defaultValue) : vscodeConfig.get<T>(this.name);
    let changed = this.value != v;
    this.value = v;
    if (changed) {
      this.notify(this.value);
    }
    return this.value;
  }
}

export class ConfigurationPropertyCached<T> extends EventSource<T | undefined> implements ConfigurationPropertyI {
  private value = this.defaultValue;
  public constructor(
    public readonly name: string,
    private readonly defaultValue: T | undefined,
    public readonly hardResetOnChange: boolean = false,
    public readonly symbolResolvers: SymbolResolverI[] = []
  ) {
    super();
  }
  public reload(vscodeConfig: vscode.WorkspaceConfiguration): void {
    let v = this.defaultValue ? vscodeConfig.get<T>(this.name, this.defaultValue) : vscodeConfig.get<T>(this.name);
    let changed = this.value != v;
    this.value = v;
    if (changed) {
      this.notify(this.value);
    }
  }
  public get(): T | undefined {
    return this.value;
  }
}

export class Configuration extends HasDisposables {
  private symbolResolvers = new Array<SymbolResolverI>();

  public constructor(
    public readonly configurationName: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    private properties: Map<string, ConfigurationPropertyI>
  ) {
    super();

    // Create a default symbol resolver for the current workspace:
    this.symbolResolvers.push(new WorkspaceSymbolResolver(this.workspaceFolder));

    // Register the config change handler to refresh changed values:
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((configChange: vscode.ConfigurationChangeEvent) => {
        let refreshPropertyIfChanged = (property: ConfigurationPropertyI): void => {
          if (configChange.affectsConfiguration(this.getPropertyName(property, 'long'), this.workspaceFolder.uri)) {
            property.reload(this.vscodeConfig);
          }
        };
        this.getProperties().forEach(refreshPropertyIfChanged);
      })
    );

    // Initial reload:
    this.reload();
  }

  public get cwd(): string {
    return this.workspaceFolder.uri.fsPath;
  }

  public reload() {
    this.properties.forEach((p) => p.reload(this.vscodeConfig));
  }

  public getResolvedPropertyValue<T = any>(property: string): T | undefined {
    let prop = this.properties.get(property);
    return prop ? (this.resolveValue(prop.get(this.vscodeConfig), prop.symbolResolvers) as T) : undefined;
  }

  public getProperty(name: string): ConfigurationPropertyI | undefined {
    return this.properties.get(name);
  }

  public getProperties(filter: 'all' | 'soft' | 'hard' = 'all'): ConfigurationPropertyI[] {
    let ps = new Array<ConfigurationPropertyI>();
    this.properties.forEach((p) => {
      if (filter == 'all' || (filter == 'hard' && p.hardResetOnChange) || (filter == 'soft' && !p.hardResetOnChange)) {
        ps.push(p);
      }
    });
    return ps;
  }

  public subscribeToProperty<T>(name: string, handler: EventHandler<T>): EventHandlerRegistrar {
    let p = this.getProperty(name);
    if (!p) {
      throw `Could not find a property with name "${name}"`;
    }
    if (!isEventSource<T>(p)) {
      throw `Property with name "${name}" is not of base type EventSource`;
    }
    const eventSource = (p as any) as EventSource<T>;
    return eventSource.register(handler);
  }

  public getPropertyName(property: ConfigurationPropertyI, kind: 'short' | 'long' = 'short') {
    return kind == 'long' ? `${this.configurationName}.${property.name}` : property.name;
  }

  private get vscodeConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(this.configurationName, this.workspaceFolder.uri);
  }

  private resolveValue(value: any, symbolResolvers: SymbolResolverI[]): any {
    return resolveSymbols(value, this.symbolResolvers.concat(symbolResolvers));
  }
}
