const Secret = require('./Secret.js');
const Common = require('./Common.js');
const got = require('got');
const querystring = require('querystring');

'use strict';

class Eta {
    /**
     * Create an ETA entry
     *
     * @param {!StopRoute} stopRoute The stop-route where the ETA was queried
     * @param {!Date} time The ETA time
     * @param {?int} distance The distance (in metres) of the bus from the stop
     * @param {string} remark The remark of the ETA (e.g. KMB/NWFB, Scheduled)
     * @param {boolean} realTime If the ETA is real-time
     */
    constructor(stopRoute, time, distance, remark, realTime) {
        this.stopRoute = stopRoute;
        this.time = time;
        this.distance = distance;
        this.remark = remark;
        this.realTime = realTime;
    }
}

Eta.WEB_API = 1;
Eta.MOBILE_API = 2;

Eta.API_USED = Eta.MOBILE_API;
Eta.MOBILE_API_METHOD = 'GET';

/**
 * Compare two ETA entries by time
 *
 * @param {Eta} a
 * @param {Eta} b
 * @returns {int}
 */
Eta.compare = function (a, b) {
    return (a.time === null ? Infinity : a.time.getTime()) - (b.time === null ? Infinity : b.time.getTime());
};

/**
 * Get a list of ETAs by a route at stop
 *
 * @param {StopRoute} stopRoute
 * @param {function(Array<Eta>)} callback
 */
Eta.get = function (stopRoute, callback) {
    /**
     * @param {array|object} json
     * @param {XMLHttpRequest} jqXHR
     * @param {object[]} json.data.response
     */
    const handler = function (json, jqXHR) {
        //if (jqXHR.readyState === 4 && jqXHR.status === 403) {
        if (false) {
            Eta.get(stopRoute, callback);
        } else {
            callback(
                (Eta.API_USED === Eta.WEB_API
                    ? json.data.response
                    : Eta.API_USED === Eta.MOBILE_API ? json[0].eta : []
                )
                    .map(
                        /**
                         *
                         * @param {String} obj.t
                         * @param {String} obj.eot
                         * @param {int} obj.dis
                         */
                        obj => (
                            {
                                time: obj.t.substr(0, 5),
                                remark: obj.t.substr(5),
                                real_time: typeof obj.dis === 'number',
                                distance: obj.dis === undefined ? null : obj.dis,
                            }
                        )
                    )
                    .filter(obj => obj.time.match(/^[0-9][0-9]:[0-9][0-9]$/) !== null)
                    .map(
                        obj => {
                            /*
                            const time = new Date();
                            time.setHours(Number(obj.time.split(':')[0]), Number(obj.time.split(':')[1]));
                            if (time.getTime() - Date.now() < -60 * 60 * 1000 * 2) {
                                // the time is less than 2 hours past - assume midnight rollover
                                time.setDate(time.getDate() + 1);
                            }
                            if (time.getTime() - Date.now() > 60 * 60 * 1000 * 6) {
                                // the time is more than 6 hours in the future - assume midnight rollover
                                time.setDate(time.getDate() - 1);
                            }
                            */
                            const time = obj.time;
                            return new Eta(stopRoute, time, obj.distance, obj.remark, obj.real_time);
                        }
                    )
            );
        }
    };
    if (Eta.API_USED === Eta.WEB_API) {
        /** @type {!Date} */
        const current_date = new Date;
        /** @type {string} */
        const date_string = current_date.getUTCFullYear() + "-" + ("00" + (current_date.getUTCMonth() + 1)).slice(-2) + "-" + ("00" + current_date.getUTCDate()).slice(-2) + " " + ("00" + current_date.getUTCHours()).slice(-2) + ":" + ("00" + current_date.getUTCMinutes()).slice(-2) + ":" + ("00" + current_date.getUTCSeconds()).slice(-2) + "." + ("00" + current_date.getUTCMilliseconds()).slice(-2) + ".";
        /** @type {string} */
        const sep = "--31" + date_string + "13--";
        var token = "EA" + btoa(stopRoute.variant.route.number + sep + stopRoute.variant.route.bound + sep + stopRoute.variant.serviceType + sep + stopRoute.stop.id.trim().replace(/-/gi, '') + sep + stopRoute.sequence + sep + (new Date).getTime());
        /*
        $.post(
            (location.protocol === 'https:' ? Common.PROXY_URL : '') + Common.API_ENDPOINT + "?action=get_ETA&lang="
            + { 'en': 0, 'zh-hant': 1, 'zh-hans': 2 }[Common.getLanguage()]
            , {
                token: token,
                t: date_string,
            }
            , handler
        );
        */
    } else if (Eta.API_USED === Eta.MOBILE_API) {
        const secret = Secret.getSecret(new Date().toISOString().split('.')[0] + 'Z')
        const query = {
            lang: { 'en': 'en', 'zh-hans': 'sc', 'zh-hant': 'tc' }[Common.getLanguage()],
            route: stopRoute.variant.route.number,
            bound: stopRoute.variant.route.bound,
            stop_seq: stopRoute.sequence,
            service_type: stopRoute.variant.serviceType,
            vendor_id: Secret.VENDOR_ID,
            apiKey: secret.apiKey,
            ctr: secret.ctr
        };
        const encrypted_query = Secret.getSecret('?' + new URLSearchParams(query).toString(), secret.ctr);
        const retry = /** XMLHttpRequest */ jqXHR => {
            if (jqXHR.readyState === 4 && jqXHR.status === 403) {
                Eta.get(stopRoute, callback);
            }
        }
        if (Eta.MOBILE_API_METHOD === 'POST') {
            /*
            $.post(
                {
                    url: Common.PROXY_URL + 'https://etav3.kmb.hk/?action=geteta',
                    data: JSON.stringify(
                        {
                            d: encrypted_query.apiKey,
                            ctr: encrypted_query.ctr
                        }
                    ),
                    success: handler,
                    error: retry,
                    contentType: 'application/json',
                }
            );
            */
        } else {
            //$.get(Common.PROXY_URL + 'https://etav3.kmb.hk/?action=geteta', query, handler).fail(retry);
            const url = 'https://etav3.kmb.hk/?action=geteta&' + querystring.stringify(query);
            (async () => {
                try {
                    const { body } = await got(url, {
                        responseType: 'json',
                        https: {
                            rejectUnauthorized: false
                        }
                    });
                    handler(body);
                } catch (error) {
                    //console.log("Error: " + error);
                    //handler(error);
                }
            })();
        }
    } else {

    }
};

module.exports = Eta;