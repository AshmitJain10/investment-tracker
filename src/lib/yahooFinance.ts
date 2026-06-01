import YahooFinance from "yahoo-finance2";

const rawYahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey", "ripHistorical"]
});

const handler: ProxyHandler<typeof rawYahooFinance> = {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === "function") {
      if (prop === "search" || prop === "quote" || prop === "historical") {
        return function (...args: any[]) {
          const query = args[0];
          const queryOptions = args[1] || {};
          const moduleOptions = args[2] || {};
          const mergedModuleOptions = { ...moduleOptions, validateResult: false };
          return value.call(target, query, queryOptions, mergedModuleOptions);
        };
      }
      return value.bind(target);
    }
    return value;
  }
};

const yahooFinance = new Proxy(rawYahooFinance, handler);

export default yahooFinance;

