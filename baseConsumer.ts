import { Context, Application, EggAppConfig } from 'egg';

export abstract class BaseConsumer {
  protected ctx: Context;
  protected app: Application;
  protected config: EggAppConfig;

  init(ctx: Context) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.config = ctx.app.config;
    return this;
  }

  abstract subscribe(data: any): void;
}
