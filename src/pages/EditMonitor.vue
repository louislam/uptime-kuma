<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ pageName }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box shadow-box-with-fixed-bottom-bar">
                    <div class="row">
                        <div class="col-md-6">
                            <h2 class="mb-2">{{ $t("General") }}</h2>

                            <div class="my-3">
                                <label for="type" class="form-label">{{ $t("Monitor Type") }}</label>
                                <select id="type" v-model="monitor.type" class="form-select">
                                    <optgroup :label="$t('General Monitor Type')">
                                        <option value="group">
                                            {{ $t("Group") }}
                                        </option>
                                        <option value="http">
                                            HTTP(s)
                                        </option>
                                        <option value="port">
                                            TCP Port
                                        </option>
                                        <option value="ping">
                                            Ping
                                        </option>
                                        <option value="keyword">
                                            HTTP(s) - {{ $t("Keyword") }}
                                        </option>
                                        <option value="json-query">
                                            HTTP(s) - {{ $t("Json Query") }}
                                        </option>
                                        <option value="grpc-keyword">
                                            gRPC(s) - {{ $t("Keyword") }}
                                        </option>
                                        <option value="dns">
                                            DNS
                                        </option>
                                        <option value="docker">
                                            {{ $t("Docker Container") }}
                                        </option>

                                        <option value="real-browser">
                                            HTTP(s) - Browser Engine (Chrome/Chromium) (Beta)
                                        </option>
                                    </optgroup>

                                    <optgroup :label="$t('Passive Monitor Type')">
                                        <option value="push">
                                            Push
                                        </option>
                                    </optgroup>

                                    <optgroup :label="$t('Specific Monitor Type')">
                                        <option value="steam">
                                            {{ $t("Steam Game Server") }}
                                        </option>
                                        <option value="gamedig">
                                            GameDig
                                        </option>
                                        <option value="mqtt">
                                            MQTT
                                        </option>
                                        <option value="kafka-producer">
                                            Kafka Producer
                                        </option>
                                        <option value="sqlserver">
                                            Microsoft SQL Server
                                        </option>
                                        <option value="postgres">
                                            PostgreSQL
                                        </option>
                                        <option value="mysql">
                                            MySQL/MariaDB
                                        </option>
                                        <option value="mongodb">
                                            MongoDB
                                        </option>
                                        <option value="radius">
                                            Radius
                                        </option>
                                        <option value="redis">
                                            Redis
                                        </option>
                                        <option v-if="!$root.info.isContainer" value="tailscale-ping">
                                            Tailscale Ping
                                        </option>
                                    </optgroup>
                                </select>
                            </div>

                            <div v-if="monitor.type === 'tailscale-ping'" class="alert alert-warning" role="alert">
                                {{ $t("tailscalePingWarning") }}
                            </div>

                            <!-- Friendly Name -->
                            <div class="my-3">
                                <label for="name" class="form-label">{{ $t("Friendly Name") }}</label>
                                <input id="name" v-model="monitor.name" type="text" class="form-control" required>
                            </div>

                            <!-- URL -->
                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query' || monitor.type === 'real-browser' " class="my-3">
                                <label for="url" class="form-label">{{ $t("URL") }}</label>
                                <input id="url" v-model="monitor.url" type="url" class="form-control" pattern="https?://.+" required>
                            </div>

                            <!-- gRPC URL -->
                            <div v-if="monitor.type === 'grpc-keyword' " class="my-3">
                                <label for="grpc-url" class="form-label">{{ $t("URL") }}</label>
                                <input id="grpc-url" v-model="monitor.grpcUrl" type="text" class="form-control" required>
                            </div>

                            <!-- Push URL -->
                            <div v-if="monitor.type === 'push' " class="my-3">
                                <label for="push-url" class="form-label">{{ $t("PushUrl") }}</label>
                                <CopyableInput id="push-url" v-model="pushURL" type="url" disabled="disabled" />
                                <div class="form-text">
                                    {{ $t("needPushEvery", [monitor.interval]) }}<br />
                                    {{ $t("pushOptionalParams", ["status, msg, ping"]) }}
                                </div>
                            </div>

                            <!-- Keyword -->
                            <div v-if="monitor.type === 'keyword' || monitor.type === 'grpc-keyword'" class="my-3">
                                <label for="keyword" class="form-label">{{ $t("Keyword") }}</label>
                                <input id="keyword" v-model="monitor.keyword" type="text" class="form-control" required>
                                <div class="form-text">
                                    {{ $t("keywordDescription") }}
                                </div>
                            </div>

                            <!-- Invert keyword -->
                            <div v-if="monitor.type === 'keyword' || monitor.type === 'grpc-keyword'" class="my-3 form-check">
                                <input id="invert-keyword" v-model="monitor.invertKeyword" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="invert-keyword">
                                    {{ $t("Invert Keyword") }}
                                </label>
                                <div class="form-text">
                                    {{ $t("invertKeywordDescription") }}
                                </div>
                            </div>

                            <!-- Json Query -->
                            <div v-if="monitor.type === 'json-query'" class="my-3">
                                <label for="jsonPath" class="form-label">{{ $t("Json Query") }}</label>
                                <input id="jsonPath" v-model="monitor.jsonPath" type="text" class="form-control" required>

                                <!-- eslint-disable-next-line vue/no-v-html -->
                                <div class="form-text" v-html="$t('jsonQueryDescription')">
                                </div>
                                <br>

                                <label for="expectedValue" class="form-label">{{ $t("Expected Value") }}</label>
                                <input id="expectedValue" v-model="monitor.expectedValue" type="text" class="form-control" required>
                            </div>

                            <!-- Game -->
                            <!-- GameDig only -->
                            <div v-if="monitor.type === 'gamedig'" class="my-3">
                                <label for="game" class="form-label"> {{ $t("Game") }} </label>
                                <select id="game" v-model="monitor.game" class="form-select" required>
                                    <option v-for="game in gameList" :key="game.keys[0]" :value="game.keys[0]">
                                        {{ game.pretty }}
                                    </option>
                                </select>
                            </div>

                            <template v-if="monitor.type === 'kafka-producer'">
                                <!-- Kafka Brokers List -->
                                <div class="my-3">
                                    <label for="kafkaProducerBrokers" class="form-label">{{ $t("Kafka Brokers") }}</label>
                                    <VueMultiselect
                                        id="kafkaProducerBrokers"
                                        v-model="monitor.kafkaProducerBrokers"
                                        :multiple="true"
                                        :options="[]"
                                        :placeholder="$t('Enter the list of brokers')"
                                        :tag-placeholder="$t('Press Enter to add broker')"
                                        :max-height="500"
                                        :taggable="true"
                                        :show-no-options="false"
                                        :close-on-select="false"
                                        :clear-on-select="false"
                                        :preserve-search="false"
                                        :preselect-first="false"
                                        @tag="addKafkaProducerBroker"
                                    ></VueMultiselect>
                                </div>

                                <!-- Kafka Topic Name -->
                                <div class="my-3">
                                    <label for="kafkaProducerTopic" class="form-label">{{ $t("Kafka Topic Name") }}</label>
                                    <input id="kafkaProducerTopic" v-model="monitor.kafkaProducerTopic" type="text" class="form-control" required>
                                </div>

                                <!-- Kafka Producer Message -->
                                <div class="my-3">
                                    <label for="kafkaProducerMessage" class="form-label">{{ $t("Kafka Producer Message") }}</label>
                                    <input id="kafkaProducerMessage" v-model="monitor.kafkaProducerMessage" type="text" class="form-control" required>
                                </div>

                                <!-- Kafka SSL -->
                                <div class="my-3 form-check">
                                    <input id="kafkaProducerSsl" v-model="monitor.kafkaProducerSsl" class="form-check-input" type="checkbox">
                                    <label class="form-check-label" for="kafkaProducerSsl">
                                        {{ $t("Enable Kafka SSL") }}
                                    </label>
                                </div>

                                <!-- Kafka SSL -->
                                <div class="my-3 form-check">
                                    <input id="kafkaProducerAllowAutoTopicCreation" v-model="monitor.kafkaProducerAllowAutoTopicCreation" class="form-check-input" type="checkbox">
                                    <label class="form-check-label" for="kafkaProducerAllowAutoTopicCreation">
                                        {{ $t("Enable Kafka Producer Auto Topic Creation") }}
                                    </label>
                                </div>
                            </template>

                            <!-- Hostname -->
                            <!-- TCP Port / Ping / DNS / Steam / MQTT / Radius / Tailscale Ping only -->
                            <div v-if="monitor.type === 'port' || monitor.type === 'ping' || monitor.type === 'dns' || monitor.type === 'steam' || monitor.type === 'gamedig' ||monitor.type === 'mqtt' || monitor.type === 'radius' || monitor.type === 'tailscale-ping'" class="my-3">
                                <label for="hostname" class="form-label">{{ $t("Hostname") }}</label>
                                <input id="hostname" v-model="monitor.hostname" type="text" class="form-control" :pattern="`${monitor.type === 'mqtt' ? mqttIpOrHostnameRegexPattern : ipOrHostnameRegexPattern}`" required>
                            </div>

                            <!-- Port -->
                            <!-- For TCP Port / Steam / MQTT / Radius Type -->
                            <div v-if="monitor.type === 'port' || monitor.type === 'steam' || monitor.type === 'gamedig' || monitor.type === 'mqtt' || monitor.type === 'radius'" class="my-3">
                                <label for="port" class="form-label">{{ $t("Port") }}</label>
                                <input id="port" v-model="monitor.port" type="number" class="form-control" required min="0" max="65535" step="1">
                            </div>

                            <!-- DNS Resolver Server -->
                            <!-- For DNS Type -->
                            <template v-if="monitor.type === 'dns'">
                                <div class="my-3">
                                    <label for="dns_resolve_server" class="form-label">{{ $t("Resolver Server") }}</label>
                                    <input id="dns_resolve_server" v-model="monitor.dns_resolve_server" type="text" class="form-control" :pattern="ipRegex" required>
                                    <div class="form-text">
                                        {{ $t("resolverserverDescription") }}
                                    </div>
                                </div>

                                <!-- Port -->
                                <div class="my-3">
                                    <label for="port" class="form-label">{{ $t("Port") }}</label>
                                    <input id="port" v-model="monitor.port" type="number" class="form-control" required min="0" max="65535" step="1">
                                    <div class="form-text">
                                        {{ $t("dnsPortDescription") }}
                                    </div>
                                </div>

                                <div class="my-3">
                                    <label for="dns_resolve_type" class="form-label">{{ $t("Resource Record Type") }}</label>

                                    <!-- :allow-empty="false" is not working, set a default value instead https://github.com/shentao/vue-multiselect/issues/336   -->
                                    <VueMultiselect
                                        id="dns_resolve_type"
                                        v-model="monitor.dns_resolve_type"
                                        :options="dnsresolvetypeOptions"
                                        :multiple="false"
                                        :close-on-select="true"
                                        :clear-on-select="false"
                                        :preserve-search="false"
                                        :placeholder="$t('Pick a RR-Type...')"
                                        :preselect-first="false"
                                        :max-height="500"
                                        :taggable="false"
                                    ></VueMultiselect>

                                    <div class="form-text">
                                        {{ $t("rrtypeDescription") }}
                                    </div>
                                </div>
                            </template>

                            <!-- Docker Container Name / ID -->
                            <!-- For Docker Type -->
                            <div v-if="monitor.type === 'docker'" class="my-3">
                                <label for="docker_container" class="form-label">{{ $t("Container Name / ID") }}</label>
                                <input id="docker_container" v-model="monitor.docker_container" type="text" class="form-control" required>
                            </div>

                            <!-- Docker Host -->
                            <!-- For Docker Type -->
                            <div v-if="monitor.type === 'docker'" class="my-3">
                                <div class="mb-3">
                                    <label for="docker-host" class="form-label">{{ $t("Docker Host") }}</label>
                                    <ActionSelect
                                        id="docker-host"
                                        v-model="monitor.docker_host"
                                        :action-aria-label="$t('openModalTo', $t('Setup Docker Host'))"
                                        :options="dockerHostOptionsList"
                                        :disabled="$root.dockerHostList == null || $root.dockerHostList.length === 0"
                                        :icon="'plus'"
                                        :action="() => $refs.dockerHostDialog.show()"
                                        :required="true"
                                    />
                                </div>
                            </div>

                            <!-- MQTT -->
                            <!-- For MQTT Type -->
                            <template v-if="monitor.type === 'mqtt'">
                                <div class="my-3">
                                    <label for="mqttUsername" class="form-label">MQTT {{ $t("Username") }}</label>
                                    <input id="mqttUsername" v-model="monitor.mqttUsername" type="text" class="form-control">
                                </div>

                                <div class="my-3">
                                    <label for="mqttPassword" class="form-label">MQTT {{ $t("Password") }}</label>
                                    <input id="mqttPassword" v-model="monitor.mqttPassword" type="password" class="form-control">
                                </div>

                                <div class="my-3">
                                    <label for="mqttTopic" class="form-label">MQTT {{ $t("Topic") }}</label>
                                    <input id="mqttTopic" v-model="monitor.mqttTopic" type="text" class="form-control" required>
                                    <div class="form-text">
                                        {{ $t("topicExplanation") }}
                                    </div>
                                </div>

                                <div class="my-3">
                                    <label for="mqttSuccessMessage" class="form-label">MQTT {{ $t("successMessage") }}</label>
                                    <input id="mqttSuccessMessage" v-model="monitor.mqttSuccessMessage" type="text" class="form-control">
                                    <div class="form-text">
                                        {{ $t("successMessageExplanation") }}
                                    </div>
                                </div>
                            </template>

                            <template v-if="monitor.type === 'radius'">
                                <div class="my-3">
                                    <label for="radius_username" class="form-label">Radius {{ $t("Username") }}</label>
                                    <input id="radius_username" v-model="monitor.radiusUsername" type="text" class="form-control" required />
                                </div>

                                <div class="my-3">
                                    <label for="radius_password" class="form-label">Radius {{ $t("Password") }}</label>
                                    <input id="radius_password" v-model="monitor.radiusPassword" type="password" class="form-control" required />
                                </div>

                                <div class="my-3">
                                    <label for="radius_secret" class="form-label">{{ $t("RadiusSecret") }}</label>
                                    <input id="radius_secret" v-model="monitor.radiusSecret" type="password" class="form-control" required />
                                    <div class="form-text"> {{ $t( "RadiusSecretDescription") }} </div>
                                </div>

                                <div class="my-3">
                                    <label for="radius_called_station_id" class="form-label">{{ $t("RadiusCalledStationId") }}</label>
                                    <input id="radius_called_station_id" v-model="monitor.radiusCalledStationId" type="text" class="form-control" required />
                                    <div class="form-text"> {{ $t( "RadiusCalledStationIdDescription") }} </div>
                                </div>

                                <div class="my-3">
                                    <label for="radius_calling_station_id" class="form-label">{{ $t("RadiusCallingStationId") }}</label>
                                    <input id="radius_calling_station_id" v-model="monitor.radiusCallingStationId" type="text" class="form-control" required />
                                    <div class="form-text"> {{ $t( "RadiusCallingStationIdDescription") }} </div>
                                </div>
                            </template>

                            <!-- SQL Server / PostgreSQL / MySQL / Redis / MongoDB -->
                            <template v-if="monitor.type === 'sqlserver' || monitor.type === 'postgres' || monitor.type === 'mysql' || monitor.type === 'redis' || monitor.type === 'mongodb'">
                                <div class="my-3">
                                    <label for="connectionString" class="form-label">{{ $t("Connection String") }}</label>
                                    <input id="connectionString" v-model="monitor.databaseConnectionString" type="text" class="form-control" required>
                                </div>
                            </template>

                            <template v-if="monitor.type === 'mysql'">
                                <div class="my-3">
                                    <label for="mysql-password" class="form-label">{{ $t("Password") }}</label>
                                    <!-- TODO: Rename monitor.radiusPassword to monitor.password for general use -->
                                    <HiddenInput id="mysql-password" v-model="monitor.radiusPassword" autocomplete="false"></HiddenInput>
                                </div>
                            </template>

                            <!-- SQL Server / PostgreSQL / MySQL -->
                            <template v-if="monitor.type === 'sqlserver' || monitor.type === 'postgres' || monitor.type === 'mysql'">
                                <div class="my-3">
                                    <label for="sqlQuery" class="form-label">{{ $t("Query") }}</label>
                                    <textarea id="sqlQuery" v-model="monitor.databaseQuery" class="form-control" :placeholder="$t('Example:', [ 'SELECT 1' ])"></textarea>
                                </div>
                            </template>

                            <!-- Interval -->
                            <div class="my-3">
                                <label for="interval" class="form-label">{{ $t("Heartbeat Interval") }} ({{ $t("checkEverySecond", [ monitor.interval ]) }})</label>
                                <input id="interval" v-model="monitor.interval" type="number" class="form-control" required :min="minInterval" step="1" :max="maxInterval" @blur="finishUpdateInterval">
                            </div>

                            <div class="my-3">
                                <label for="maxRetries" class="form-label">{{ $t("Retries") }}</label>
                                <input id="maxRetries" v-model="monitor.maxretries" type="number" class="form-control" required min="0" step="1">
                                <div class="form-text">
                                    {{ $t("retriesDescription") }}
                                </div>
                            </div>

                            <div class="my-3">
                                <label for="retry-interval" class="form-label">
                                    {{ $t("Heartbeat Retry Interval") }}
                                    <span>({{ $t("retryCheckEverySecond", [ monitor.retryInterval ]) }})</span>
                                </label>
                                <input id="retry-interval" v-model="monitor.retryInterval" type="number" class="form-control" required :min="minInterval" step="1">
                            </div>

                            <!-- Timeout: HTTP / Keyword only -->
                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query'" class="my-3">
                                <label for="timeout" class="form-label">{{ $t("Request Timeout") }} ({{ $t("timeoutAfter", [ monitor.timeout || clampTimeout(monitor.interval) ]) }})</label>
                                <input id="timeout" v-model="monitor.timeout" type="number" class="form-control" required min="0" step="0.1">
                            </div>

                            <div class="my-3">
                                <label for="resend-interval" class="form-label">
                                    {{ $t("Resend Notification if Down X times consecutively") }}
                                    <span v-if="monitor.resendInterval > 0">({{ $t("resendEveryXTimes", [ monitor.resendInterval ]) }})</span>
                                    <span v-else>({{ $t("resendDisabled") }})</span>
                                </label>
                                <input id="resend-interval" v-model="monitor.resendInterval" type="number" class="form-control" required min="0" step="1">
                            </div>

                            <h2 v-if="monitor.type !== 'push'" class="mt-5 mb-2">{{ $t("Advanced") }}</h2>

                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query' " class="my-3 form-check">
                                <input id="expiry-notification" v-model="monitor.expiryNotification" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="expiry-notification">
                                    {{ $t("Certificate Expiry Notification") }}
                                </label>
                                <div class="form-text">
                                </div>
                            </div>

                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query' " class="my-3 form-check">
                                <input id="ignore-tls" v-model="monitor.ignoreTls" class="form-check-input" type="checkbox" value="">
                                <label class="form-check-label" for="ignore-tls">
                                    {{ $t("ignoreTLSError") }}
                                </label>
                            </div>

                            <div class="my-3 form-check">
                                <input id="upside-down" v-model="monitor.upsideDown" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="upside-down">
                                    {{ $t("Upside Down Mode") }}
                                </label>
                                <div class="form-text">
                                    {{ $t("upsideDownModeDescription") }}
                                </div>
                            </div>

                            <div v-if="monitor.type === 'gamedig'" class="my-3 form-check">
                                <input id="gamedig-guess-port" v-model="monitor.gamedigGivenPortOnly" :true-value="false" :false-value="true" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="gamedig-guess-port">
                                    {{ $t("gamedigGuessPort") }}
                                </label>
                                <div class="form-text">
                                    {{ $t("gamedigGuessPortDescription") }}
                                </div>
                            </div>

                            <!-- Ping packet size -->
                            <div v-if="monitor.type === 'ping'" class="my-3">
                                <label for="packet-size" class="form-label">{{ $t("Packet Size") }}</label>
                                <input id="packet-size" v-model="monitor.packetSize" type="number" class="form-control" required min="1" max="65500" step="1">
                            </div>

                            <!-- HTTP / Keyword only -->
                            <template v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query' || monitor.type === 'grpc-keyword' ">
                                <div class="my-3">
                                    <label for="maxRedirects" class="form-label">{{ $t("Max. Redirects") }}</label>
                                    <input id="maxRedirects" v-model="monitor.maxredirects" type="number" class="form-control" required min="0" step="1">
                                    <div class="form-text">
                                        {{ $t("maxRedirectDescription") }}
                                    </div>
                                </div>

                                <div class="my-3">
                                    <label for="acceptedStatusCodes" class="form-label">{{ $t("Accepted Status Codes") }}</label>

                                    <VueMultiselect
                                        id="acceptedStatusCodes"
                                        v-model="monitor.accepted_statuscodes"
                                        :options="acceptedStatusCodeOptions"
                                        :multiple="true"
                                        :close-on-select="false"
                                        :clear-on-select="false"
                                        :preserve-search="true"
                                        :placeholder="$t('Pick Accepted Status Codes...')"
                                        :preselect-first="false"
                                        :max-height="600"
                                        :taggable="true"
                                    ></VueMultiselect>

                                    <div class="form-text">
                                        {{ $t("acceptedStatusCodesDescription") }}
                                    </div>
                                </div>
                            </template>

                            <!-- Parent Monitor -->
                            <div class="my-3">
                                <label for="monitorGroupSelector" class="form-label">{{ $t("Monitor Group") }}</label>
                                <ActionSelect
                                    id="monitorGroupSelector"
                                    v-model="monitor.parent"
                                    :action-aria-label="$t('openModalTo', 'setup a new monitor group')"
                                    :options="parentMonitorOptionsList"
                                    :disabled="sortedGroupMonitorList.length === 0 && draftGroupName == null"
                                    :icon="'plus'"
                                    :action="() => $refs.createGroupDialog.show()"
                                />
                            </div>

                            <!-- Description -->
                            <div class="my-3">
                                <label for="description" class="form-label">{{ $t("Description") }}</label>
                                <input id="description" v-model="monitor.description" type="text" class="form-control">
                            </div>

                            <div class="my-3">
                                <tags-manager ref="tagsManager" :pre-selected-tags="monitor.tags"></tags-manager>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div v-if="$root.isMobile" class="mt-3" />

                            <!-- Notifications -->
                            <h2 class="mb-2">{{ $t("Notifications") }}</h2>
                            <p v-if="$root.notificationList.length === 0">
                                {{ $t("Not available, please setup.") }}
                            </p>

                            <div v-for="notification in $root.notificationList" :key="notification.id" class="form-check form-switch my-3">
                                <input :id=" 'notification' + notification.id" v-model="monitor.notificationIDList[notification.id]" class="form-check-input" type="checkbox">

                                <label class="form-check-label" :for=" 'notification' + notification.id">
                                    {{ notification.name }}
                                    <a href="#" @click="$refs.notificationDialog.show(notification.id)">{{ $t("Edit") }}</a>
                                </label>

                                <span v-if="notification.isDefault == true" class="badge bg-primary ms-2">{{ $t("Default") }}</span>
                            </div>

                            <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                                {{ $t("Setup Notification") }}
                            </button>

                            <!-- Proxies -->
                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query'">
                                <h2 class="mt-5 mb-2">{{ $t("Proxy") }}</h2>
                                <p v-if="$root.proxyList.length === 0">
                                    {{ $t("Not available, please setup.") }}
                                </p>

                                <div v-if="$root.proxyList.length > 0" class="form-check my-3">
                                    <input id="proxy-disable" v-model="monitor.proxyId" :value="null" name="proxy" class="form-check-input" type="radio">
                                    <label class="form-check-label" for="proxy-disable">{{ $t("No Proxy") }}</label>
                                </div>

                                <div v-for="proxy in $root.proxyList" :key="proxy.id" class="form-check my-3">
                                    <input :id="`proxy-${proxy.id}`" v-model="monitor.proxyId" :value="proxy.id" name="proxy" class="form-check-input" type="radio">

                                    <label class="form-check-label" :for="`proxy-${proxy.id}`">
                                        {{ proxy.host }}:{{ proxy.port }} ({{ proxy.protocol }})
                                        <a href="#" @click="$refs.proxyDialog.show(proxy.id)">{{ $t("Edit") }}</a>
                                    </label>

                                    <span v-if="proxy.default === true" class="badge bg-primary ms-2">{{ $t("default") }}</span>
                                </div>

                                <button class="btn btn-primary me-2" type="button" @click="$refs.proxyDialog.show()">
                                    {{ $t("Setup Proxy") }}
                                </button>
                            </div>

                            <!-- Kafka SASL Options -->
                            <!-- Kafka Producer only -->
                            <template v-if="monitor.type === 'kafka-producer'">
                                <h2 class="mt-5 mb-2">{{ $t("Kafka SASL Options") }}</h2>
                                <div class="my-3">
                                    <label class="form-label" for="kafkaProducerSaslMechanism">
                                        {{ $t("Mechanism") }}
                                    </label>
                                    <VueMultiselect
                                        id="kafkaProducerSaslMechanism"
                                        v-model="monitor.kafkaProducerSaslOptions.mechanism"
                                        :options="kafkaSaslMechanismOptions"
                                        :multiple="false"
                                        :clear-on-select="false"
                                        :preserve-search="false"
                                        :placeholder="$t('Pick a SASL Mechanism...')"
                                        :preselect-first="false"
                                        :max-height="500"
                                        :allow-empty="false"
                                        :taggable="false"
                                    ></VueMultiselect>
                                </div>
                                <div v-if="monitor.kafkaProducerSaslOptions.mechanism !== 'None'">
                                    <div v-if="monitor.kafkaProducerSaslOptions.mechanism !== 'aws'" class="my-3">
                                        <label for="kafkaProducerSaslUsername" class="form-label">{{ $t("Username") }}</label>
                                        <input id="kafkaProducerSaslUsername" v-model="monitor.kafkaProducerSaslOptions.username" type="text" autocomplete="kafkaProducerSaslUsername" class="form-control">
                                    </div>
                                    <div v-if="monitor.kafkaProducerSaslOptions.mechanism !== 'aws'" class="my-3">
                                        <label for="kafkaProducerSaslPassword" class="form-label">{{ $t("Password") }}</label>
                                        <input id="kafkaProducerSaslPassword" v-model="monitor.kafkaProducerSaslOptions.password" type="password" autocomplete="kafkaProducerSaslPassword" class="form-control">
                                    </div>
                                    <div v-if="monitor.kafkaProducerSaslOptions.mechanism === 'aws'" class="my-3">
                                        <label for="kafkaProducerSaslAuthorizationIdentity" class="form-label">{{ $t("Authorization Identity") }}</label>
                                        <input id="kafkaProducerSaslAuthorizationIdentity" v-model="monitor.kafkaProducerSaslOptions.authorizationIdentity" type="text" autocomplete="kafkaProducerSaslAuthorizationIdentity" class="form-control" required>
                                    </div>
                                    <div v-if="monitor.kafkaProducerSaslOptions.mechanism === 'aws'" class="my-3">
                                        <label for="kafkaProducerSaslAccessKeyId" class="form-label">{{ $t("AccessKey Id") }}</label>
                                        <input id="kafkaProducerSaslAccessKeyId" v-model="monitor.kafkaProducerSaslOptions.accessKeyId" type="text" autocomplete="kafkaProducerSaslAccessKeyId" class="form-control" required>
                                    </div>
                                    <div v-if="monitor.kafkaProducerSaslOptions.mechanism === 'aws'" class="my-3">
                                        <label for="kafkaProducerSaslSecretAccessKey" class="form-label">{{ $t("Secret AccessKey") }}</label>
                                        <input id="kafkaProducerSaslSecretAccessKey" v-model="monitor.kafkaProducerSaslOptions.secretAccessKey" type="password" autocomplete="kafkaProducerSaslSecretAccessKey" class="form-control" required>
                                    </div>
                                    <div v-if="monitor.kafkaProducerSaslOptions.mechanism === 'aws'" class="my-3">
                                        <label for="kafkaProducerSaslSessionToken" class="form-label">{{ $t("Session Token") }}</label>
                                        <input id="kafkaProducerSaslSessionToken" v-model="monitor.kafkaProducerSaslOptions.sessionToken" type="password" autocomplete="kafkaProducerSaslSessionToken" class="form-control">
                                    </div>
                                </div>
                            </template>

                            <!-- HTTP Options -->
                            <template v-if="monitor.type === 'http' || monitor.type === 'keyword' || monitor.type === 'json-query' ">
                                <h2 class="mt-5 mb-2">{{ $t("HTTP Options") }}</h2>

                                <!-- Method -->
                                <div class="my-3">
                                    <label for="method" class="form-label">{{ $t("Method") }}</label>
                                    <select id="method" v-model="monitor.method" class="form-select">
                                        <option value="GET">
                                            GET
                                        </option>
                                        <option value="POST">
                                            POST
                                        </option>
                                        <option value="PUT">
                                            PUT
                                        </option>
                                        <option value="PATCH">
                                            PATCH
                                        </option>
                                        <option value="DELETE">
                                            DELETE
                                        </option>
                                        <option value="HEAD">
                                            HEAD
                                        </option>
                                        <option value="OPTIONS">
                                            OPTIONS
                                        </option>
                                    </select>
                                </div>

                                <!-- Encoding -->
                                <div class="my-3">
                                    <label for="httpBodyEncoding" class="form-label">{{ $t("Body Encoding") }}</label>
                                    <select id="httpBodyEncoding" v-model="monitor.httpBodyEncoding" class="form-select">
                                        <option value="json">JSON</option>
                                        <option value="xml">XML</option>
                                    </select>
                                </div>

                                <!-- Body -->
                                <div class="my-3">
                                    <label for="body" class="form-label">{{ $t("Body") }}</label>
                                    <textarea id="body" v-model="monitor.body" class="form-control" :placeholder="bodyPlaceholder"></textarea>
                                </div>

                                <!-- Headers -->
                                <div class="my-3">
                                    <label for="headers" class="form-label">{{ $t("Headers") }}</label>
                                    <textarea id="headers" v-model="monitor.headers" class="form-control" :placeholder="headersPlaceholder"></textarea>
                                </div>

                                <!-- HTTP Auth -->
                                <h4 class="mt-5 mb-2">{{ $t("Authentication") }}</h4>

                                <!-- Method -->
                                <div class="my-3">
                                    <label for="method" class="form-label">{{ $t("Method") }}</label>
                                    <select id="method" v-model="monitor.authMethod" class="form-select">
                                        <option :value="null">
                                            {{ $t("None") }}
                                        </option>
                                        <option value="basic">
                                            {{ $t("HTTP Basic Auth") }}
                                        </option>
                                        <option value="oauth2-cc">
                                            {{ $t("OAuth2: Client Credentials") }}
                                        </option>
                                        <option value="ntlm">
                                            NTLM
                                        </option>
                                        <option value="mtls">
                                            mTLS
                                        </option>
                                    </select>
                                </div>
                                <template v-if="monitor.authMethod && monitor.authMethod !== null ">
                                    <template v-if="monitor.authMethod === 'mtls' ">
                                        <div class="my-3">
                                            <label for="tls-cert" class="form-label">{{ $t("Cert") }}</label>
                                            <textarea id="tls-cert" v-model="monitor.tlsCert" class="form-control" :placeholder="$t('Cert body')" required></textarea>
                                        </div>
                                        <div class="my-3">
                                            <label for="tls-key" class="form-label">{{ $t("Key") }}</label>
                                            <textarea id="tls-key" v-model="monitor.tlsKey" class="form-control" :placeholder="$t('Key body')" required></textarea>
                                        </div>
                                        <div class="my-3">
                                            <label for="tls-ca" class="form-label">{{ $t("CA") }}</label>
                                            <textarea id="tls-ca" v-model="monitor.tlsCa" class="form-control" :placeholder="$t('Server CA')"></textarea>
                                        </div>
                                    </template>
                                    <template v-else-if="monitor.authMethod === 'oauth2-cc' ">
                                        <div class="my-3">
                                            <label for="oauth_auth_method" class="form-label">{{ $t("Authentication Method") }}</label>
                                            <select id="oauth_auth_method" v-model="monitor.oauth_auth_method" class="form-select">
                                                <option value="client_secret_basic">
                                                    {{ $t("Authorization Header") }}
                                                </option>
                                                <option value="client_secret_post">
                                                    {{ $t("Form Data Body") }}
                                                </option>
                                            </select>
                                        </div>
                                        <div class="my-3">
                                            <label for="oauth_token_url" class="form-label">{{ $t("OAuth Token URL") }}</label>
                                            <input id="oauth_token_url" v-model="monitor.oauth_token_url" type="text" class="form-control" :placeholder="$t('OAuth Token URL')" required>
                                        </div>
                                        <div class="my-3">
                                            <label for="oauth_client_id" class="form-label">{{ $t("Client ID") }}</label>
                                            <input id="oauth_client_id" v-model="monitor.oauth_client_id" type="text" class="form-control" :placeholder="$t('Client ID')" required>
                                        </div>
                                        <template v-if="monitor.oauth_auth_method === 'client_secret_post' || monitor.oauth_auth_method === 'client_secret_basic'">
                                            <div class="my-3">
                                                <label for="oauth_client_secret" class="form-label">{{ $t("Client Secret") }}</label>
                                                <input id="oauth_client_secret" v-model="monitor.oauth_client_secret" type="password" class="form-control" :placeholder="$t('Client Secret')" required>
                                            </div>
                                            <div class="my-3">
                                                <label for="oauth_scopes" class="form-label">{{ $t("OAuth Scope") }}</label>
                                                <input id="oauth_scopes" v-model="monitor.oauth_scopes" type="text" class="form-control" :placeholder="$t('Optional: Space separated list of scopes')">
                                            </div>
                                        </template>
                                    </template>
                                    <template v-else>
                                        <div class="my-3">
                                            <label for="basicauth-user" class="form-label">{{ $t("Username") }}</label>
                                            <input id="basicauth-user" v-model="monitor.basic_auth_user" type="text" class="form-control" :placeholder="$t('Username')">
                                        </div>

                                        <div class="my-3">
                                            <label for="basicauth-pass" class="form-label">{{ $t("Password") }}</label>
                                            <input id="basicauth-pass" v-model="monitor.basic_auth_pass" type="password" autocomplete="new-password" class="form-control" :placeholder="$t('Password')">
                                        </div>
                                        <template v-if="monitor.authMethod === 'ntlm' ">
                                            <div class="my-3">
                                                <label for="ntlm-domain" class="form-label">{{ $t("Domain") }}</label>
                                                <input id="ntlm-domain" v-model="monitor.authDomain" type="text" class="form-control" :placeholder="$t('Domain')">
                                            </div>

                                            <div class="my-3">
                                                <label for="ntlm-workstation" class="form-label">{{ $t("Workstation") }}</label>
                                                <input id="ntlm-workstation" v-model="monitor.authWorkstation" type="text" class="form-control" :placeholder="$t('Workstation')">
                                            </div>
                                        </template>
                                    </template>
                                </template>
                            </template>

                            <!-- gRPC Options -->
                            <template v-if="monitor.type === 'grpc-keyword' ">
                                <!-- Proto service enable TLS -->
                                <h2 class="mt-5 mb-2">{{ $t("GRPC Options") }}</h2>
                                <div class="my-3 form-check">
                                    <input id="grpc-enable-tls" v-model="monitor.grpcEnableTls" class="form-check-input" type="checkbox" value="">
                                    <label class="form-check-label" for="grpc-enable-tls">
                                        {{ $t("Enable TLS") }}
                                    </label>
                                    <div class="form-text">
                                        {{ $t("enableGRPCTls") }}
                                    </div>
                                </div>
                                <!-- Proto service name data -->
                                <div class="my-3">
                                    <label for="protobuf" class="form-label">{{ $t("Proto Service Name") }}</label>
                                    <input id="name" v-model="monitor.grpcServiceName" type="text" class="form-control" :placeholder="protoServicePlaceholder" required>
                                </div>

                                <!-- Proto method data -->
                                <div class="my-3">
                                    <label for="protobuf" class="form-label">{{ $t("Proto Method") }}</label>
                                    <input id="name" v-model="monitor.grpcMethod" type="text" class="form-control" :placeholder="protoMethodPlaceholder" required>
                                    <div class="form-text">
                                        {{ $t("grpcMethodDescription") }}
                                    </div>
                                </div>

                                <!-- Proto data -->
                                <div class="my-3">
                                    <label for="protobuf" class="form-label">{{ $t("Proto Content") }}</label>
                                    <textarea id="protobuf" v-model="monitor.grpcProtobuf" class="form-control" :placeholder="protoBufDataPlaceholder"></textarea>
                                </div>

                                <!-- Body -->
                                <div class="my-3">
                                    <label for="body" class="form-label">{{ $t("Body") }}</label>
                                    <textarea id="body" v-model="monitor.grpcBody" class="form-control" :placeholder="bodyPlaceholder"></textarea>
                                </div>

                                <!-- Metadata: temporary disable waiting for next PR allow to send gRPC with metadata -->
                                <template v-if="false">
                                    <div class="my-3">
                                        <label for="metadata" class="form-label">{{ $t("Metadata") }}</label>
                                        <textarea id="metadata" v-model="monitor.grpcMetadata" class="form-control" :placeholder="headersPlaceholder"></textarea>
                                    </div>
                                </template>
                            </template>
                        </div>
                    </div>

                    <div class="fixed-bottom-bar p-3">
                        <button id="monitor-submit-btn" class="btn btn-primary" type="submit" :disabled="processing">{{ $t("Save") }}</button>
                    </div>
                </div>
            </form>

            <NotificationDialog ref="notificationDialog" @added="addedNotification" />
            <DockerHostDialog ref="dockerHostDialog" @added="addedDockerHost" />
            <ProxyDialog ref="proxyDialog" @added="addedProxy" />
            <CreateGroupDialog ref="createGroupDialog" @added="addedDraftGroup" />
        </div>
    </transition>
</template>

<script>
import VueMultiselect from "vue-multiselect";
import { useToast } from "vue-toastification";
import ActionSelect from "../components/ActionSelect.vue";
import CopyableInput from "../components/CopyableInput.vue";
import CreateGroupDialog from "../components/CreateGroupDialog.vue";
import NotificationDialog from "../components/NotificationDialog.vue";
import DockerHostDialog from "../components/DockerHostDialog.vue";
import ProxyDialog from "../components/ProxyDialog.vue";
import TagsManager from "../components/TagsManager.vue";
import { genSecret, isDev, MAX_INTERVAL_SECOND, MIN_INTERVAL_SECOND, sleep } from "../util.ts";
import { hostNameRegexPattern } from "../util-frontend";
import HiddenInput from "../components/HiddenInput.vue";

const toast = useToast();

const monitorDefaults = {
    type: "http",
    name: "",
    parent: null,
    url: "https://",
    method: "GET",
    interval: 60,
    retryInterval: 60,
    resendInterval: 0,
    maxretries: 0,
    timeout: 48,
    notificationIDList: {},
    ignoreTls: false,
    upsideDown: false,
    packetSize: 56,
    expiryNotification: false,
    maxredirects: 10,
    accepted_statuscodes: [ "200-299" ],
    dns_resolve_type: "A",
    dns_resolve_server: "1.1.1.1",
    docker_container: "",
    docker_host: null,
    proxyId: null,
    mqttUsername: "",
    mqttPassword: "",
    mqttTopic: "",
    mqttSuccessMessage: "",
    authMethod: null,
    oauth_auth_method: "client_secret_basic",
    httpBodyEncoding: "json",
    kafkaProducerBrokers: [],
    kafkaProducerSaslOptions: {
        mechanism: "None",
    },
    kafkaProducerSsl: false,
    kafkaProducerAllowAutoTopicCreation: false,
    gamedigGivenPortOnly: true,
};

export default {
    components: {
        HiddenInput,
        ActionSelect,
        ProxyDialog,
        CopyableInput,
        CreateGroupDialog,
        NotificationDialog,
        DockerHostDialog,
        TagsManager,
        VueMultiselect,
    },

    data() {
        return {
            minInterval: MIN_INTERVAL_SECOND,
            maxInterval: MAX_INTERVAL_SECOND,
            processing: false,
            monitor: {
                notificationIDList: {},
                // Do not add default value here, please check init() method
            },
            acceptedStatusCodeOptions: [],
            dnsresolvetypeOptions: [],
            kafkaSaslMechanismOptions: [],
            ipOrHostnameRegexPattern: hostNameRegexPattern(),
            mqttIpOrHostnameRegexPattern: hostNameRegexPattern(true),
            gameList: null,
            connectionStringTemplates: {
                "sqlserver": "Server=<hostname>,<port>;Database=<your database>;User Id=<your user id>;Password=<your password>;Encrypt=<true/false>;TrustServerCertificate=<Yes/No>;Connection Timeout=<int>",
                "postgres": "postgres://username:password@host:port/database",
                "mysql": "mysql://username:password@host:port/database",
                "redis": "redis://user:password@host:port",
                "mongodb": "mongodb://username:password@host:port/database",
            },
            draftGroupName: null,
        };
    },

    computed: {

        ipRegex() {

            // Allow to test with simple dns server with port (127.0.0.1:5300)
            if (! isDev) {
                return this.ipRegexPattern;
            }
            return null;
        },

        pageName() {
            let name = "Add New Monitor";
            if (this.isClone) {
                name = "Clone Monitor";
            } else if (this.isEdit) {
                name = "Edit";
            }
            return this.$t(name);
        },

        isAdd() {
            return this.$route.path === "/add";
        },

        isClone() {
            return this.$route.path.startsWith("/clone");
        },

        isEdit() {
            return this.$route.path.startsWith("/edit");
        },

        pushURL() {
            return this.$root.baseURL + "/api/push/" + this.monitor.pushToken + "?status=up&msg=OK&ping=";
        },

        protoServicePlaceholder() {
            return this.$t("Example:", [ "Health" ]);
        },

        protoMethodPlaceholder() {
            return this.$t("Example:", [ "check" ]);
        },

        protoBufDataPlaceholder() {
            return this.$t("Example:", [ `
syntax = "proto3";

package grpc.health.v1;

service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;  // Used only by the Watch method.
  }
  ServingStatus status = 1;
}
            ` ]);
        },
        bodyPlaceholder() {
            if (this.monitor && this.monitor.httpBodyEncoding && this.monitor.httpBodyEncoding === "xml") {
                return this.$t("Example:", [ `
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Uptime>Kuma</Uptime>
  </soap:Body>
</soap:Envelope>` ]);
            }
            return this.$t("Example:", [ `
{
    "key": "value"
}` ]);
        },

        headersPlaceholder() {
            return this.$t("Example:", [ `
{
    "HeaderName": "HeaderValue"
}` ]);
        },

        currentGameObject() {
            if (this.gameList) {
                for (let game of this.gameList) {
                    if (game.keys[0] === this.monitor.game) {
                        return game;
                    }
                }
            }
            return null;
        },

        // Filter result by active state, weight and alphabetical
        // Only return groups which arent't itself and one of its decendants
        sortedGroupMonitorList() {
            let result = Object.values(this.$root.monitorList);

            // Only groups, not itself, not a decendant
            result = result.filter(
                monitor => monitor.type === "group" &&
				monitor.id !== this.monitor.id &&
				!this.monitor.childrenIDs?.includes(monitor.id)
            );

            // Filter result by active state, weight and alphabetical
            result.sort((m1, m2) => {

                if (m1.active !== m2.active) {
                    if (m1.active === 0) {
                        return 1;
                    }

                    if (m2.active === 0) {
                        return -1;
                    }
                }

                if (m1.weight !== m2.weight) {
                    if (m1.weight > m2.weight) {
                        return -1;
                    }

                    if (m1.weight < m2.weight) {
                        return 1;
                    }
                }

                return m1.pathName.localeCompare(m2.pathName);
            });

            return result;
        },

        /**
         * Generates the parent monitor options list based on the sorted group monitor list and draft group name.
         *
         * @return {Array} The parent monitor options list.
         */
        parentMonitorOptionsList() {
            let list = [];
            if (this.sortedGroupMonitorList.length === 0 && this.draftGroupName == null) {
                list = [
                    {
                        label: this.$t("noGroupMonitorMsg"),
                        value: null
                    }
                ];
            } else {
                list = [
                    {
                        label: this.$t("None"),
                        value: null
                    },
                    ... this.sortedGroupMonitorList.map(monitor => {
                        return {
                            label: monitor.pathName,
                            value: monitor.id,
                        };
                    }),
                ];
            }

            if (this.draftGroupName != null) {
                list = [{
                    label: this.draftGroupName,
                    value: -1,
                }].concat(list);
            }

            return list;
        },

        dockerHostOptionsList() {
            if (this.$root.dockerHostList && this.$root.dockerHostList.length > 0) {
                return this.$root.dockerHostList.map((host) => {
                    return {
                        label: host.name,
                        value: host.id
                    };
                });
            } else {
                return [{
                    label: this.$t("noDockerHostMsg"),
                    value: null,
                }];
            }
        }
    },
    watch: {
        "$root.proxyList"() {
            if (this.isAdd) {
                if (this.$root.proxyList && !this.monitor.proxyId) {
                    const proxy = this.$root.proxyList.find(proxy => proxy.default);

                    if (proxy) {
                        this.monitor.proxyId = proxy.id;
                    }
                }
            }
        },

        "$route.fullPath"() {
            this.init();
        },

        "monitor.interval"(value, oldValue) {
            // Link interval and retryInterval if they are the same value.
            if (this.monitor.retryInterval === oldValue) {
                this.monitor.retryInterval = value;
            }
        },

        "monitor.timeout"(value, oldValue) {
            // keep timeout within 80% range
            if (value && value !== oldValue) {
                this.monitor.timeout = this.clampTimeout(value);
            }
        },

        "monitor.type"() {
            if (this.monitor.type === "push") {
                if (! this.monitor.pushToken) {
                    this.monitor.pushToken = genSecret(10);
                }
            }

            // Set default port for DNS if not already defined
            if (! this.monitor.port || this.monitor.port === "53" || this.monitor.port === "1812") {
                if (this.monitor.type === "dns") {
                    this.monitor.port = "53";
                } else if (this.monitor.type === "radius") {
                    this.monitor.port = "1812";
                } else {
                    this.monitor.port = undefined;
                }
            }

            // Get the game list from server
            if (this.monitor.type === "gamedig") {
                this.$root.getSocket().emit("getGameList", (res) => {
                    if (res.ok) {
                        this.gameList = res.gameList;
                    } else {
                        toast.error(res.msg);
                    }
                });
            }

            // Set default database connection string if empty or it is a template from another database monitor type
            for (let monitorType in this.connectionStringTemplates) {
                if (this.monitor.type === monitorType) {
                    let isTemplate = false;
                    for (let key in this.connectionStringTemplates) {
                        if (this.monitor.databaseConnectionString === this.connectionStringTemplates[key]) {
                            isTemplate = true;
                            break;
                        }
                    }
                    if (!this.monitor.databaseConnectionString || isTemplate) {
                        this.monitor.databaseConnectionString = this.connectionStringTemplates[monitorType];
                    }
                    break;
                }
            }

        },

        currentGameObject(newGameObject, previousGameObject) {
            if (!this.monitor.port || (previousGameObject && previousGameObject.options.port === this.monitor.port)) {
                this.monitor.port = newGameObject.options.port;
            }
            this.monitor.game = newGameObject.keys[0];
        },
    },
    mounted() {
        this.init();

        let acceptedStatusCodeOptions = [
            "100-199",
            "200-299",
            "300-399",
            "400-499",
            "500-599",
        ];

        let dnsresolvetypeOptions = [
            "A",
            "AAAA",
            "CAA",
            "CNAME",
            "MX",
            "NS",
            "PTR",
            "SOA",
            "SRV",
            "TXT",
        ];

        let kafkaSaslMechanismOptions = [
            "None",
            "plain",
            "scram-sha-256",
            "scram-sha-512",
            "aws",
        ];

        for (let i = 100; i <= 999; i++) {
            acceptedStatusCodeOptions.push(i.toString());
        }

        this.acceptedStatusCodeOptions = acceptedStatusCodeOptions;
        this.dnsresolvetypeOptions = dnsresolvetypeOptions;
        this.kafkaSaslMechanismOptions = kafkaSaslMechanismOptions;
    },
    methods: {
        /** Initialize the edit monitor form */
        init() {
            if (this.isAdd) {

                this.monitor = {
                    ...monitorDefaults
                };

                if (this.$root.proxyList && !this.monitor.proxyId) {
                    const proxy = this.$root.proxyList.find(proxy => proxy.default);

                    if (proxy) {
                        this.monitor.proxyId = proxy.id;
                    }
                }

                for (let i = 0; i < this.$root.notificationList.length; i++) {
                    if (this.$root.notificationList[i].isDefault === true) {
                        this.monitor.notificationIDList[this.$root.notificationList[i].id] = true;
                    }
                }
            } else if (this.isEdit || this.isClone) {
                this.$root.getSocket().emit("getMonitor", this.$route.params.id, (res) => {
                    if (res.ok) {

                        if (this.isClone) {
                            // Reset push token for cloned monitors
                            if (res.monitor.type === "push") {
                                res.monitor.pushToken = undefined;
                            }
                        }

                        this.monitor = res.monitor;

                        if (this.isClone) {
                            /*
                            * Cloning a monitor will include properties that can not be posted to backend
                            * as they are not valid columns in the SQLite table.
                            */
                            this.monitor.id = undefined; // Remove id when cloning as we want a new id
                            this.monitor.includeSensitiveData = undefined;
                            this.monitor.maintenance = undefined;
                            // group monitor fields
                            this.monitor.childrenIDs = undefined;
                            this.monitor.forceInactive = undefined;
                            this.monitor.pathName = undefined;
                            this.monitor.screenshot = undefined;

                            this.monitor.name = this.$t("cloneOf", [ this.monitor.name ]);
                            this.$refs.tagsManager.newTags = this.monitor.tags.map((monitorTag) => {
                                return {
                                    id: monitorTag.tag_id,
                                    name: monitorTag.name,
                                    color: monitorTag.color,
                                    value: monitorTag.value,
                                    new: true,
                                };
                            });
                            this.monitor.tags = undefined;
                        }

                        // Handling for monitors that are created before 1.7.0
                        if (this.monitor.retryInterval === 0) {
                            this.monitor.retryInterval = this.monitor.interval;
                        }
                        // Handling for monitors that are missing/zeroed timeout
                        if (!this.monitor.timeout) {
                            this.monitor.timeout = ~~(this.monitor.interval * 8) / 10;
                        }
                    } else {
                        toast.error(res.msg);
                    }
                });
            }

            this.draftGroupName = null;

        },

        addKafkaProducerBroker(newBroker) {
            this.monitor.kafkaProducerBrokers.push(newBroker);
        },

        /**
         * Validate form input
         * @returns {boolean} Is the form input valid?
         */
        isInputValid() {
            if (this.monitor.body && (!this.monitor.httpBodyEncoding || this.monitor.httpBodyEncoding === "json")) {
                try {
                    JSON.parse(this.monitor.body);
                } catch (err) {
                    toast.error(this.$t("BodyInvalidFormat") + err.message);
                    return false;
                }
            }
            if (this.monitor.headers) {
                try {
                    JSON.parse(this.monitor.headers);
                } catch (err) {
                    toast.error(this.$t("HeadersInvalidFormat") + err.message);
                    return false;
                }
            }
            if (this.monitor.type === "docker") {
                if (this.monitor.docker_host == null) {
                    toast.error(this.$t("DockerHostRequired"));
                    return false;
                }
            }
            return true;
        },

        /**
         * Submit the form data for processing
         * @returns {void}
         */
        async submit() {

            this.processing = true;

            if (!this.isInputValid()) {
                this.processing = false;
                return;
            }

            // Beautify the JSON format (only if httpBodyEncoding is not set or === json)
            if (this.monitor.body && (!this.monitor.httpBodyEncoding || this.monitor.httpBodyEncoding === "json")) {
                this.monitor.body = JSON.stringify(JSON.parse(this.monitor.body), null, 4);
            }

            const monitorTypesWithEncodingAllowed = [ "http", "keyword", "json-query" ];
            if (this.monitor.type && !monitorTypesWithEncodingAllowed.includes(this.monitor.type)) {
                this.monitor.httpBodyEncoding = null;
            }

            if (this.monitor.headers) {
                this.monitor.headers = JSON.stringify(JSON.parse(this.monitor.headers), null, 4);
            }

            if (this.monitor.hostname) {
                this.monitor.hostname = this.monitor.hostname.trim();
            }

            if (this.monitor.url) {
                this.monitor.url = this.monitor.url.trim();
            }

            let createdNewParent = false;

            if (this.draftGroupName && this.monitor.parent === -1) {
                // Create Monitor with name of draft group
                const res = await new Promise((resolve) => {
                    this.$root.add({
                        ...monitorDefaults,
                        type: "group",
                        name: this.draftGroupName,
                        interval: this.monitor.interval,
                        active: false,
                    }, resolve);
                });

                if (res.ok) {
                    createdNewParent = true;
                    this.monitor.parent = res.monitorID;
                } else {
                    toast.error(res.msg);
                    this.processing = false;
                    return;
                }
            }

            if (this.isAdd || this.isClone) {
                this.$root.add(this.monitor, async (res) => {

                    if (res.ok) {
                        await this.$refs.tagsManager.submit(res.monitorID);

                        // Start the new parent monitor after edit is done
                        if (createdNewParent) {
                            this.startParentGroupMonitor();
                        }

                        toast.success(res.msg);
                        this.processing = false;
                        this.$root.getMonitorList();
                        this.$router.push("/dashboard/" + res.monitorID);

                    } else {
                        toast.error(res.msg);
                        this.processing = false;
                    }

                });
            } else {
                await this.$refs.tagsManager.submit(this.monitor.id);

                this.$root.getSocket().emit("editMonitor", this.monitor, (res) => {
                    this.processing = false;
                    this.$root.toastRes(res);
                    this.init();

                    // Start the new parent monitor after edit is done
                    if (createdNewParent) {
                        this.startParentGroupMonitor();
                    }
                });
            }
        },

        async startParentGroupMonitor() {
            await sleep(2000);
            await this.$root.getSocket().emit("resumeMonitor", this.monitor.parent, () => {});
        },

        /**
         * Added a Notification Event
         * Enable it if the notification is added in EditMonitor.vue
         * @param {number} id ID of notification to add
         */
        addedNotification(id) {
            this.monitor.notificationIDList[id] = true;
        },

        /**
         * Added a Proxy Event
         * Enable it if the proxy is added in EditMonitor.vue
         * @param {number} id ID of proxy to add
         */
        addedProxy(id) {
            this.monitor.proxyId = id;
        },

        // Added a Docker Host Event
        // Enable it if the Docker Host is added in EditMonitor.vue
        addedDockerHost(id) {
            this.monitor.docker_host = id;
        },

        /**
         * Adds a draft group.
         *
         * @param {string} draftGroupName - The name of the draft group.
         */
        addedDraftGroup(draftGroupName) {
            this.draftGroupName = draftGroupName;
            this.monitor.parent = -1;
        },

        // Clamp timeout
        clampTimeout(timeout) {
            // limit to 80% of interval, narrowly avoiding epsilon bug
            const maxTimeout = ~~(this.monitor.interval * 8 ) / 10;
            const clamped = Math.max(0, Math.min(timeout, maxTimeout));

            // 0 will be treated as 80% of interval
            return Number.isFinite(clamped) ? clamped : maxTimeout;
        },

        finishUpdateInterval() {
            // Update timeout if it is greater than the clamp timeout
            let clampedValue = this.clampTimeout(this.monitor.interval);
            if (this.monitor.timeout > clampedValue) {
                this.monitor.timeout = clampedValue;
            }
        },

    },
};
</script>

<style lang="scss" scoped>
    @import "../assets/vars.scss";

    textarea {
        min-height: 200px;
    }
</style>
