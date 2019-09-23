import RabbitMQ from './rabbitmq';
import loaderConsumer from './loader';
import * as assert from 'assert';
import * as qs from 'querystring';

export default app => {
  if (app.config.rabbitmq) {
    app.addSingleton('rabbitmq', createRabbitMQ);
  }
};

function registerConsumer(app, client, consumers) {
  for (const key in consumers) {
    const consumer = consumers[key];
    const { queue, routingKey } = consumer.consumer;
    if (consumer.consumer.disable) {
      continue;
    }
    app.logger.info('[egg-rabbitmq]: register consumer %s', consumer.key);
    const ctx = app.createAnonymousContext({
      method: 'CONSUMER',
      url: `/__consumer?path=${key}&${qs.stringify(consumer.consumer)}`,
    });
    const subscribe = consumer.subscribe(ctx);
    client.registerSubscribe(queue, routingKey, subscribe);
  }
}

function createRabbitMQ(config, app) {
  assert(config.url && config.exchanges && config.queues);
  const client = new RabbitMQ(config);
  const consumers = loaderConsumer(app);

  client.on('connect', connection => {
    app.logger.info(
      '[egg-rabbitmq] server connected! connection=' +
        connection.connection.stream.localAddress +
        ':' +
        connection.connection.stream.localPort,
    );
  });

  client.on('close', error => {
    app.logger.info('[egg-rabbitmq] connection closed due to error:', error);
  });

  client.on('error', error => {
    app.logger.error('[egg-rabbitmq] connection error:', error);
  });

  client.on('ch_open', _channel => {
    app.logger.info('[egg-rabbitmq] channel opened!');
  });

  client.on('ch_close', () => {
    app.logger.info('[egg-rabbitmq] channel closed');
  });

  client.on('ch_error', error => {
    app.logger.error('[egg-rabbitmq] channel error:', error);
  });

  client.on('ch_drain', () => {
    app.logger.error('[egg-rabbitmq] channel drain event');
  });

  app.beforeStart(async () => {
    // 注册消费者
    registerConsumer(app, client, consumers);
    await client.init();
  });

  return client;
}
