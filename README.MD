# egg-rabbitmq-plus
egg rabbitmq插件，超级好用！！！！！

# 安装
$ npm i egg-rabbitmq-plus --save

# 多连接实例配置
```js
// {app_root}/config/config.default.js
config.rabbitmq = {
  enable: true,
  clients: {
    messageServe: {
      url: {
        protocol: 'amqp',
        hostname: '${rabbitmq.host}',  // 根据情况配置
        port: '${rabbitmq.port}',
        username: '${rabbitmq.username}',
        password: '${rabbitmq.password}',
        locale: 'en_US',
        frameMax: 0,
        heartbeat: 0,
        vhost: '${rabbitmq.virtual-host}',
      },
      reconnectTime: 5000, // 重连时间间隔
      options: {},
      exchanges: {
        messageExchange: {
          name: 'message_exchange', // 消息推送交换机
          type: 'direct',
          options: {
            durable: true,
          },
        },
        dlxMessageExchange: {
          name: 'dlx_message_exchange', // 消息失败的死信交换机
          type: 'direct',
          options: {
            durable: true,
          },
        },
      },
      queues: {
        messageQueue: {
          // 推送消息队列
          exchange: 'message_exchange',
          name: 'message_queue',
          keys: {
            wechatTemplateMessage: 'wechat/message/template',
          },
          options: {
            exclusive: false,
            durable: true,
            maxPriority: 10,
            prefetch: 1,
            deadLetterRoutingKey: 'wechat/message/template',
            deadLetterExchange: 'dlx_message_exchange',
          },
          autoSubscribe: true, // 启动时自动开启订阅。
          subscribeOptions: {}, // 开启自动订阅时的消费者配置，不开启不用配置
        },
        dlxMessageQueue: {
          // 推送失败的队列，目前不做失败后的处理
          exchange: 'dlx_message_exchange',
          name: 'dlx_message_queue',
          keys: {
            wechatTemplateMessage: 'wechat/message/template', // 这里是deadLetterRoutingKey
          },
          options: {
            exclusive: false,
            durable: true,
            maxPriority: 10,
            prefetch: 1,
          },
          autoSubscribe: false, // 关闭自动订阅。
          subscribeOptions: {}, // 开启自动订阅时的消费者配置，不开启不用配置
        },
      },
    },
  }
};
```

# 使用

## 发布消息示例

```js
class RBMQPublishService extends BaseService {
  /**
   * 获取交换机和队列配置信息
   * @param vhostName
   * @param exchangeName
   * @param queueName
   */
  private getQueueInfo(vhostName, exchangeName, queueName) {
    const { exchanges, queues } = this.app.config.rabbitmq.clients[vhostName];
    const exchange = exchanges[exchangeName].name;
    const queue = queues[queueName].name;
    const routingKeys = queues[queueName].keys;
    const { clients } = this.app.rabbitmq;
    const channel = clients.get(vhostName);
    return { channel, exchange, queue, routingKeys };
  }

  /**
   * 发布消息到队列
   * @param channel
   * @param exchange
   * @param key
   * @param data
   */
  private sendToQueue(channel, exchange, key, data, opts = {}): boolean {
    const message = {
      exchange,
      key,
      message: data,
      options: {
        priority: 10,
        persistent: true,
        mandatory: true,
        ...opts,
      },
    };
    return channel.publish(message);
  }

  /**
   * 获取消息的交换机和队列信息
   */
  public getMessageQueueInfo() {
    return this.getQueueInfo('messageServe', 'messageExchange', 'messageQueue');
  }

  /**
   * 获取失败消息的交换机和队列信息
   */
  public getFailedMessageQueueInfo() {
    return this.getQueueInfo('messageServe', 'dlxMessageExchange', 'dlxMessageQueue');
  }

  /**
   * 发布消息到message_queue
   * @param data
   */
  public sendToMessageQueue(data: object): boolean {
    const { channel, exchange, routingKeys } = this.getMessageQueueInfo();
    return this.sendToQueue(channel, exchange, routingKeys.wechatTemplateMessage, data);
  }
}
```

## 消费消息示例（注：在配置文件中开启autoSubscribe选项，会自动执行app/consumer目录下所有class的subscribe方法）

### 1、先在app目录下新建文件夹consumer

### 2、创建文件，继承BaseConsumer类
```js
import { BaseContextClass } from 'egg';
import { BaseConsumer } from 'egg-rabbitmq-plus'

export default class SubscribePush extends BaseConsumer {
  static get config() {
    return {
      env: ['local'], // 可选，默认为所有环境
      disable: false, // 可选，默认为false
      queue: 'message_queue', // 监听的队列
      routingKey: 'wechat_message', // 绑定交换机时的routingKey，如果不指定key，会拿到队列所有的消息
    };
  }

  async subscribe(data) {
    const { channel } = this.service.message.rabbitmq.getMessageQueueInfo();
    try {
      this.ctx.logger.info(data.content.toString());
      channel.ack(data);
    } catch (err) {
      this.ctx.logger.error(err);
      channel.nack(data);
    }
  }
}

```



