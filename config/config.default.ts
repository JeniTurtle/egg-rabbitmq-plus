module.exports = () => {
  const config: any = {
    rabbitmq: {
      enable: true,
    },
  };

  config.rabbitmq.consumer = {
    // custom additional directory, full path
    directory: [],
  };

  return config;
};
