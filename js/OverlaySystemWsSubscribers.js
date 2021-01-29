const OverlayWsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    init: function(port, debug, debugFilters) {
        port = port || 49321;
        debug = debug || false;
        if (debug) {
            if (debugFilters !== undefined) {
                console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
            } else {
                console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
            }
        }
        OverlayWsSubscribers.webSocket = new WebSocket("wss://rl-overlay-control-system-ws.herokuapp.com/");
        //OverlayWsSubscribers.webSocket = new WebSocket("ws://localhost:4000");
        OverlayWsSubscribers.webSocket.onmessage = function (event) {
            let jEvent = JSON.parse(event.data);
            if (!jEvent.hasOwnProperty('event')) {
                return;
            }
            let eventSplit = jEvent.event.split(':');
            let channel = eventSplit[0];
            let event_event = eventSplit[1];
            if (debug) {
                if (!debugFilters) {
                    console.log(channel, event_event, jEvent);
                } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                    console.log(channel, event_event, jEvent);
                }
            }
            OverlayWsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        OverlayWsSubscribers.webSocket.onopen = function () {
            OverlayWsSubscribers.triggerSubscribers("ws", "open");
            OverlayWsSubscribers.webSocketConnected = true;
            OverlayWsSubscribers.registerQueue.forEach((r) => {
                OverlayWsSubscribers.send("wsRelay", "register", r);
            });
            OverlayWsSubscribers.registerQueue = [];
        };
        OverlayWsSubscribers.webSocket.onerror = function () {
            OverlayWsSubscribers.triggerSubscribers("ws", "error");
            OverlayWsSubscribers.webSocketConnected = false;
        };
        OverlayWsSubscribers.webSocket.onclose = function () {
            OverlayWsSubscribers.triggerSubscribers("ws", "close");
            OverlayWsSubscribers.webSocketConnected = false;
        };
    },
    /**
    * Add callbacks for when certain events are thrown
    * Execution is guaranteed to be in First In First Out order
    * @param channels
    * @param events
    * @param callback
    */
    subscribe: function(channels, events, callback) {
        if (typeof channels === "string") {
            let channel = channels;
            channels = [];
            channels.push(channel);
        }
        if (typeof events === "string") {
            let event = events;
            events = [];
            events.push(event);
        }
        channels.forEach(function(c) {
            events.forEach(function (e) {
                if (!OverlayWsSubscribers.__subscribers.hasOwnProperty(c)) {
                    OverlayWsSubscribers.__subscribers[c] = {};
                }
                if (!OverlayWsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                    OverlayWsSubscribers.__subscribers[c][e] = [];
                    if (OverlayWsSubscribers.webSocketConnected) {
                        OverlayWsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                    } else {
                        OverlayWsSubscribers.registerQueue.push(`${c}:${e}`);
                    }
                }
                OverlayWsSubscribers.__subscribers[c][e].push(callback);
            });
        })
    },
    clearEventCallbacks: function (channel, event) {
        if (OverlayWsSubscribers.__subscribers.hasOwnProperty(channel) && OverlayWsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            OverlayWsSubscribers.__subscribers[channel] = {};
        }
    },
    triggerSubscribers: function (channel, event, data) {
        if (OverlayWsSubscribers.__subscribers.hasOwnProperty(channel) && OverlayWsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            OverlayWsSubscribers.__subscribers[channel][event].forEach(function(callback) {
                if (callback instanceof Function) {
                    callback(data);
                }
            });
        }
    },
    send: function (channel, event, data) {
        if (typeof channel !== 'string') {
            console.error("Channel must be a string");
            return;
        }
        if (typeof event !== 'string') {
            console.error("Event must be a string");
            return;
        }
        if (channel === 'local') {
            this.triggerSubscribers(channel, event, data);
        } else {
            let cEvent = channel + ":" + event;
            OverlayWsSubscribers.webSocket.send(JSON.stringify({
                'event': cEvent,
                'data': data
            }));
        }
    }
};