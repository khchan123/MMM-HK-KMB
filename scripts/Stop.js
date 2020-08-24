const Common = require('./Common.js');

'use strict';

class Stop {
    constructor(/** string */ id, /** ?string */ name, /** string */ direction, /** int */ sequence) {
        this.id = id;
        //this.name = name ?? localStorage[id + '_' + Common.getLanguage()] ?? null;
        this.name = name;
        this.direction = direction;
        this.sequence = sequence;
        /*
        if (name !== null) {
            localStorage[id + '_' + Common.getLanguage()] = name;
        }
        */
    }
}

Stop.prototype.getStreet = function () {
    return this.id.split('-')[0];
}

Stop.prototype.getDirection = function () {
    return this.id.split('-')[1];
}

Stop.get = function (/** Variant */ variant, /** function(array<Stop>) */ callback) {
    Common.callApi(
        {
            action : 'getstops',
            route : variant.route.number,
            bound : variant.route.bound,
            serviceType : variant.serviceType
        }
        /**
         * @param {array<object>} json.data.routeStops
         */
        , function (json) {
            callback(
                json.data.routeStops.map(
                    /**
                     * @param {string} item.BSICode
                     * @param {string} item.Direction
                     * @param {string} item.Seq
                     * @returns {!Stop}
                     */
                    item => new Stop(
                        item.BSICode
                        , item[
                            {
                                'en' : 'EName',
                                'zh-hans' : 'SCName',
                                'zh-hant' : 'CName'
                            }[Common.getLanguage()]
                        ]
                            .toTitleCase()
                        , item.Direction.trim()
                        , Number(item.Seq)
                    )
                )
            );
        }
    );
};

module.exports = Stop;