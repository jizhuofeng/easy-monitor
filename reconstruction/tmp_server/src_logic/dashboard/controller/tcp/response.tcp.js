'use strict';
const co = require('co');
const lodash = require('lodash');

module.exports = function (server) {
    //取出公共对象
    const common = this.common;
    const config = this.config;
    const dbl = this.dbl;
    const controller = this.controller;
    const cacheUtils = common.cache;

    /**
     * @param {string} responseType 
     * @description 工厂方法，根据返回值生成对应的回调函数
     */
    function factory(responseType) {
        /**
         * @param {socket} socket @param {string} data
         * @description 给 tcp 请求设置回调函数，本回调函数处理 cpu / memory profiling 响应操作
        */
        return function (socket, data) {
            return co(_response, socket, data);

            /**
             * @param {socket} socket @param {string} data
             * @description 内部方法，具体处理 response 逻辑
             */
            function* _response(socket, data) {
                data = typeof data === 'object' && data || common.utils.jsonParse(data);

                //根据类型，计算得出 loadingMsg
                let loadingMsg = '';
                switch (responseType) {
                    //针对通知客户端开始进行 profiling 操作
                    case config.message.response[3]:
                        loadingMsg = config.profiler[data.raw.opt].end(data.result);
                        break;
                    default:
                        break;
                }

                //根据原始参数组装出 key
                const key = common.profiler.composeKey(lodash.merge({ opt: data.opt }, data.raw));

                //从缓存中取出原始数据
                let oldData = yield cacheUtils.storage.getP(key, config.cache.opt_list);
                oldData = common.utils.jsonParse(oldData);

                //此时数据设置成功
                if (oldData && oldData.results && oldData.results.loadingMsg) {
                    oldData.done = true;
                    oldData.setSize = false;
                    oldData.results.sequence = data.sequence;
                    oldData.results.data = data.result;
                    oldData.results.loadingMsg = loadingMsg;
                }
                //更新完毕后的数据重新塞进缓存
                yield cacheUtils.storage.setP(`${key}${data.sequence}`, oldData, config.cache.opt_list);
            }
        }
    }

    //取出开始 profiling 操作响应的类型，并且设置对应的处理函数
    const profilerTypeResponse = config.message && config.message.response && config.message.response[3];

    /**
     * @description /针对需要处理的响应的回调函数
     */
    //处理通知业务进程开始 profiling 回调
    controller[profilerTypeResponse] = factory(profilerTypeResponse);
}