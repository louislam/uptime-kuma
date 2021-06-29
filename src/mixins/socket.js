import {io} from "socket.io-client";
import { useToast } from 'vue-toastification'
const toast = useToast()

let storage = localStorage;
let socket;

export default {

    data() {
        return {
            socket: {
                token: null,
                firstConnect: true,
                connected: false,
                connectCount: 0,
            },
            allowLoginDialog: false,        // Allowed to show login dialog, but "loggedIn" have to be true too. This exists because prevent the login dialog show 0.1s in first before the socket server auth-ed.
            loggedIn: false,
            monitorList: [

            ],

            heartbeatList: {

            },
        }
    },

    created() {
        socket = io("http://localhost:3001", {
            transports: ['websocket']
        });

        socket.on('monitorList', (data) => {
            this.monitorList = data;
        });

        socket.on('heartbeat', (data) => {
            if (! (data.monitorID in this.heartbeatList)) {
                this.heartbeatList[data.monitorID] = [];
            }

            this.heartbeatList[data.monitorID].push(data)
        });

        socket.on('heartbeatList', (monitorID, data) => {
            if (! (monitorID in this.heartbeatList)) {
                this.heartbeatList[monitorID] = data;
            } else {
                this.heartbeatList[monitorID] = data.concat(this.heartbeatList[monitorID])
            }
        });


        socket.on('disconnect', () => {
            console.log("disconnect")
            this.socket.connected = false;
        });

        socket.on('connect', () => {
            console.log("connect")
            this.socket.connectCount++;
            this.socket.connected = true;

            // Reset Heartbeat list if it is re-connect
            if (this.socket.connectCount >= 2) {
                console.log("reset heartbeat list")
                this.heartbeatList = {}
            }

            if (storage.token) {
                this.loginByToken(storage.token)
            } else {
                this.allowLoginDialog = true;
            }

            this.socket.firstConnect = false;
        });

    },

    methods: {

        getSocket() {
          return socket;
        },

        toastRes(res) {
            if (res.ok) {
                toast.success(res.msg);
            } else {
                toast.error(res.msg);
            }
        },

        login(username, password, callback) {
            socket.emit("login", {
                username,
                password,
            }, (res) => {

                if (res.ok) {
                    storage.token = res.token;
                    this.socket.token = res.token;
                    this.loggedIn = true;

                    // Trigger Chrome Save Password
                    history.pushState({}, '')
                }

                callback(res)
            })
        },

        loginByToken(token) {
            socket.emit("loginByToken", token, (res) => {
                this.allowLoginDialog = true;

                if (! res.ok) {
                    this.logout()
                } else {
                    this.loggedIn = true;
                }
            })
        },

        logout() {
            storage.removeItem("token");
            this.socket.token = null;

            socket.emit("logout", () => {
                window.location.reload()
            })
        },

        add(monitor, callback) {
            socket.emit("add", monitor, callback)
        },

        deleteMonitor(monitorID, callback) {
            socket.emit("deleteMonitor", monitorID, callback)
        },

    },

    computed: {
        lastHeartbeatList() {
            let result = {}

            for (let monitorID in this.heartbeatList) {
                let index = this.heartbeatList[monitorID].length - 1;
                result[monitorID] = this.heartbeatList[monitorID][index];
            }

            return result;
        },

        // TODO: handle history + real time
        importantHeartbeatList() {
            let result = {}

            for (let monitorID in this.heartbeatList) {
                result[monitorID] = [];

                let index = this.heartbeatList[monitorID].length - 1;
                let list = this.heartbeatList[monitorID];

                for (let heartbeat of list) {
                    if (heartbeat.important) {
                        result[monitorID].push(heartbeat)
                    }
                }
            }

            return result;
        },

        statusList() {
            let result = {}

            let unknown = {
                text: "Unknown",
                color: "secondary"
            }

            for (let monitorID in this.lastHeartbeatList) {
                let lastHeartBeat = this.lastHeartbeatList[monitorID]

                if (! lastHeartBeat) {
                    result[monitorID] = unknown;
                } else if (lastHeartBeat.status === 1) {
                    result[monitorID] = {
                        text: "Up",
                        color: "primary"
                    };
                } else if (lastHeartBeat.status === 0) {
                    result[monitorID] = {
                        text: "Down",
                        color: "danger"
                    };
                } else {
                    result[monitorID] = unknown;
                }
            }

            return result;
        }
    }

}

