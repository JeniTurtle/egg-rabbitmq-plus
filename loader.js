"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const assert = require("assert");
const uuidV1 = require("uuid/v1");
const is = require("is-type-of");
const typedi_1 = require("typedi");
exports.contextId = Symbol('rabbitMqConsumerContextId');
typedi_1.Container.of = function (instanceId) {
    if (instanceId === undefined)
        // @ts-ignore
        return this.globalInstance;
    // @ts-ignore
    var container = this.instances.find(function (instance) { return instance.id === instanceId; });
    if (!container) {
        container = new typedi_1.ContainerInstance(instanceId);
        // @ts-ignore
        container.services.push(...this.globalInstance.services.map(s => (Object.assign(Object.assign({}, s), { value: s.global ? s.value : undefined }))));
        // @ts-ignore
        this.instances.push(container);
    }
    return container;
};
exports.default = app => {
    const dirs = app.loader.getLoadUnits().map(unit => path.join(unit.path, 'app/consumer'));
    dirs.push(...app.config.rabbitmq.consumer.directory);
    const Loader = getConsumerLoader(app);
    const consumers = (app.consumers = {});
    new Loader({
        directory: dirs,
        target: consumers,
        inject: app,
    }).load();
    return consumers;
};
const initCtx = (target, ctx) => {
    target.ctx = ctx;
    target.app = ctx.app;
    target.config = ctx.app.config;
    target.service = ctx.service;
    target[exports.contextId] = ctx[exports.contextId];
};
const injectContext = (obj, ctx) => {
    Object.getOwnPropertyNames(obj).map(prop => {
        if (obj[prop] && typeof obj[prop] === 'object') {
            const type = obj[prop].constructor;
            if (obj[exports.contextId] !== ctx[exports.contextId] && (typedi_1.Container.has(type) || typedi_1.Container.has(type.name))) {
                injectContext(obj[prop], ctx);
                initCtx(obj[prop], ctx);
            }
        }
    });
};
function getConsumerLoader(app) {
    return class ConsumerLoader extends app.loader.FileLoader {
        load() {
            // @ts-ignore
            const target = this.options.target;
            const items = this.parse();
            for (const item of items) {
                const consumer = item.exports;
                const fullpath = item.fullpath;
                const config = consumer.config;
                assert(config, `consumer(${fullpath}): must have config and subscribe properties`);
                assert(config.queue, `consumer(${fullpath}): consumer.config must have queue properties`);
                assert(is.class(consumer) || is.function(consumer.subscribe), `consumer(${fullpath}: consumer.subscribe should be function or consumer should be class`);
                let subscribe;
                if (is.class(consumer)) {
                    subscribe = ctx => async (data) => {
                        ctx[exports.contextId] = uuidV1();
                        const instance = typedi_1.Container.of(ctx[exports.contextId]).get(consumer);
                        injectContext(instance, ctx);
                        initCtx(instance, ctx);
                        instance.subscribe = app.toAsyncFunction(instance.subscribe);
                        const ret = await instance.subscribe(data);
                        typedi_1.Container.reset(ctx[exports.contextId]);
                        return ret;
                    };
                }
                else {
                    subscribe = () => app.toAsyncFunction(consumer.subscribe);
                }
                const env = app.config.env;
                const envList = config.env;
                if (is.array(envList) && !envList.includes(env)) {
                    app.coreLogger.info(`[egg-rabbitmq]: ignore consumer ${fullpath} due to \`consumer.env\` not match`);
                    continue;
                }
                target[fullpath] = {
                    consumer: config,
                    subscribe,
                    key: fullpath,
                };
            }
            return target;
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibG9hZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLGlDQUFpQztBQUNqQyxrQ0FBa0M7QUFFbEMsaUNBQWtDO0FBQ2xDLG1DQUFzRDtBQUV6QyxRQUFBLFNBQVMsR0FBRyxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQztBQUU3RCxrQkFBUyxDQUFDLEVBQUUsR0FBRyxVQUFVLFVBQVU7SUFDakMsSUFBSSxVQUFVLEtBQUssU0FBUztRQUMxQixhQUFhO1FBQ2IsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQzdCLGFBQWE7SUFDZCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLFFBQVEsSUFBSSxPQUFPLFFBQVEsQ0FBQyxFQUFFLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEcsSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNiLFNBQVMsR0FBRyxJQUFJLDBCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzlDLGFBQWE7UUFDZixTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGlDQUM3RCxDQUFDLEtBQ0osS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsSUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFDTCxhQUFhO1FBQ2YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDL0I7SUFDRCxPQUFPLFNBQVMsQ0FBQztBQUNsQixDQUFDLENBQUM7QUFFRixrQkFBZSxHQUFHLENBQUMsRUFBRTtJQUNuQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMs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