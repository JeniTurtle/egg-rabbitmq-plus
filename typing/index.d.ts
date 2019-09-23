import { Context, Application, EggAppConfig, Service } from 'egg'

declare module 'egg' {
  interface Application {
    rabbitmq: any;
  }
}

abstract class BaseConsumer {
  protected ctx: Context;
  protected app: Application;
  protected config: EggAppConfig;
  init(ctx: Context): BaseConsumer
  abstract subscribe(data: any): void;
}
