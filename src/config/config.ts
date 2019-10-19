import * as vscode from 'vscode';
import { HasDisposables } from '../disposable';
import { EventSource, EventHandler, EventHandlerRegistrar, isEventSource } from '../event/event';
import { SymbolResolverI, WorkspaceSymbolResolver, resolveSymbols } from './symbol';

export interface ConfigurationPropertyI<Id extends string, Group extends string> {
  readonly name: Id;
  readonly group: Group;
  readonly symbolResolvers: SymbolResolverI[];
  reload(vscodeConfig: vscode.WorkspaceConfiguration): void;
  get(vscodeConfig: vscode.WorkspaceConfiguration): any | undefined;
  isValid(): boolean;
}

export class ConfigurationProperty<Id extends string, Group extends string, Value>
  extends EventSource<Value | undefined>
  implements ConfigurationPropertyI<Id, Group> {
  private value = this.defaultValue;
  private valid = this.validator(this.value);

  public constructor(
    public readonly name: Id,
    public readonly group: Group,
    private validator: (value: Value | undefined) => boolean,
    private readonly defaultValue: Value | undefined = undefined,
    public readonly symbolResolvers: SymbolResolverI[] = [],
    private readonly cached: boolean = false
  ) {
    super();
  }

  public reload(vscodeConfig: vscode.WorkspaceConfiguration): void {
    if (this.cached) {
      this.refresh(vscodeConfig);
    }
  }

  public get(vscodeConfig: vscode.WorkspaceConfiguration): Value | undefined {
    if (!this.cached) {
      this.refresh(vscodeConfig);
    }
    return this.value;
  }

  public isValid(): boolean {
    return this.valid;
  }

  private refresh(vscodeConfig: vscode.WorkspaceConfiguration) {
    let v = this.defaultValue
      ? vscodeConfig.get<Value>(this.name, this.defaultValue)
      : vscodeConfig.get<Value>(this.name);
    let changed = this.value != v;
    this.value = v;
    this.valid = this.validator(v);
    if (changed) {
      this.notify(this.value);
    }
    return this.value;
  }
}

/**
 * Configuration class to hold a map of properties.
 *
 * @template Id Restriction type for property names
 */
export class Configuration<Id extends string, Group extends string> extends HasDisposables {
  private symbolResolvers = new Array<SymbolResolverI>();

  public constructor(
    public readonly configurationName: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    private properties: Map<string, ConfigurationPropertyI<Id, Group>>
  ) {
    super();

    // Create a default symbol resolver for the current workspace:
    this.symbolResolvers.push(new WorkspaceSymbolResolver(this.workspaceFolder));

    // Register the config change handler to refresh changed values:
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((configChange: vscode.ConfigurationChangeEvent) => {
        let refreshPropertyIfChanged = (property: ConfigurationPropertyI<Id, Group>): void => {
          if (
            configChange.affectsConfiguration(this.getPropertyIdentifier(property, 'long'), this.workspaceFolder.uri)
          ) {
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

  public getProperty(name: Id): ConfigurationPropertyI<Id, Group> | undefined {
    return this.properties.get(name);
  }

  public getProperties(filter?: Group): ConfigurationPropertyI<Id, Group>[] {
    let ps = new Array<ConfigurationPropertyI<Id, Group>>();
    this.properties.forEach((p) => {
      if (filter == undefined || filter == p.group) {
        ps.push(p);
      }
    });
    return ps;
  }

  public subscribeToProperty<T>(name: Id, handler: EventHandler<T>): EventHandlerRegistrar {
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

  public getPropertyIdentifier(property: ConfigurationPropertyI<Id, Group>, kind: 'short' | 'long' = 'short'): string {
    return kind == 'long' ? `${this.configurationName}.${property.name}` : property.name;
  }

  private get vscodeConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(this.configurationName, this.workspaceFolder.uri);
  }

  private resolveValue(value: any, symbolResolvers: SymbolResolverI[]): any {
    return resolveSymbols(value, this.symbolResolvers.concat(symbolResolvers));
  }
}
