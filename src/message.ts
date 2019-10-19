import * as vscode from 'vscode';

import { log, LoggerI, SelectiveLogger } from './logger';

type MessageType = 'debug' | 'info' | 'error' | 'warning';
const MessageTypeDebug: MessageType = 'debug';
const MessageTypeInfo: MessageType = 'info';
const MessageTypeError: MessageType = 'error';
const MessageTypeWarning: MessageType = 'warning';

export class Message {
  public static defaultLogger: LoggerI = SelectiveLogger.instance;

  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly details?: string,
    public readonly type: MessageType = MessageTypeInfo
  ) {}

  public isDebug() {
    return this.type == MessageTypeInfo;
  }

  public isInfo() {
    return this.type == MessageTypeInfo;
  }

  public isWarning() {
    return this.type == MessageTypeWarning;
  }

  public isError() {
    return this.type == MessageTypeError;
  }

  public format(): string {
    return `${this.title}: \n${this.description}`;
  }

  public log(logger?: LoggerI) {
    Message.log(this, logger);
  }

  public notify(logger?: LoggerI, forceLog?: boolean) {
    Message.notify(this, logger, forceLog);
  }

  static debug(title: string, description: string, details?: string) {
    return new Message(title, description, details, MessageTypeDebug);
  }

  static info(title: string, description: string, details?: string) {
    return new Message(title, description, details, MessageTypeInfo);
  }

  static warn(title: string, description: string, details?: string) {
    return new Message(title, description, details, MessageTypeWarning);
  }

  static error(title: string, description: string, details?: string) {
    return new Message(title, description, details, MessageTypeError);
  }

  static fromException(title: string, description: string, error: any) {
    let details: string | undefined = '';
    if (typeof error === 'string') {
      if (error.length > 0) details += `\n${error}`;
    } else if (error instanceof Error) {
      details += `\n${error.name} - "${error.message}"`;
      if (error.stack) details += `Stacktrace:\n${error.stack}`;
    } else {
      details = undefined;
    }
    return Message.error(title, description, details);
  }

  static notify(message: Message, logger?: LoggerI, forceLog: boolean = false) {
    if (message.isError()) {
      vscode.window.showErrorMessage(message.format());
    } else if (message.isWarning()) {
      vscode.window.showWarningMessage(message.format());
    } else if (message.isInfo()) {
      vscode.window.showInformationMessage(message.format());
    } else {
      forceLog = true;
    }

    if (forceLog) Message.log(message, logger);
  }

  static log(message: Message, logger?: LoggerI) {
    let msg = `${message.title}: ${message.description}`;
    if (message.details) {
      msg += `\n${message.details}`;
    }
    log(msg, logger || Message.defaultLogger, message.type);
  }
}
