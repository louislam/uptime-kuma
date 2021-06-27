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
            },
            allowLoginDialog: false,        // Allowed to show login dialog, but "loggedIn" have to be true too. This exists because prevent the login dialog show 0.1s in first before the socket server auth-ed.
            loggedIn: false,
            monitorList: [

            ],
            importantHeartbeatList: [

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


        socket.on('disconnect', () => {
            this.socket.connected = false;
        });

        socket.on('connect', () => {
            this.socket.connected = true;
            this.socket.firstConnect = false;

            if (storage.token) {
                this.loginByToken(storage.token)
            } else {
                this.allowLoginDialog = true;
            }

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
            this.loggedIn = false;

            socket.emit("logout", () => {
                toast.success("Logout Successfully")
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

