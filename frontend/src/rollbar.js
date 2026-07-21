const rollbarConfig = {
  accessToken: process.env.REACT_APP_ROLLBAR_ACCESS_TOKEN
    || '039cd1bd17964b28a91276f05b2fccf65a87a36240dbba828b6cc1f15f029697706abd15d38a2f8237e0acc0ea045f8a',
  environment: process.env.NODE_ENV,
  captureUncaught: true,
  captureUnhandledRejections: true,
};

export default rollbarConfig;
