<template>
    <div class="mb-3">
        <label for="Bark API Version" class="form-label">{{ $t("Bark API Version") }}</label>
        <select id="Bark API Version" v-model="$parent.notification.apiVersion" class="form-select" required>
            <option value="v1">v1</option>
            <option value="v2">v2</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="Bark Endpoint" class="form-label">{{ $t("Bark Endpoint") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="Bark Endpoint" v-model="$parent.notification.barkEndpoint" type="text" class="form-control" required>
        <i18n-t tag="div" keypath="wayToGetTeamsURL" class="form-text">
            <a
                href="https://github.com/Finb/Bark"
                target="_blank"
            >{{ $t("here") }}</a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="Bark Group" class="form-label">{{ $t("Bark Group") }}</label>
        <input id="Bark Group" v-model="$parent.notification.barkGroup" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="Bark Sound" class="form-label">{{ $t("Bark Sound") }}</label>
        <select id="Bark Sound" v-model="$parent.notification.barkSound" class="form-select" required>
            <option value="alarm">alarm</option>
            <option value="anticipate">anticipate</option>
            <option value="bell">bell</option>
            <option value="birdsong">birdsong</option>
            <option value="bloom">bloom</option>
            <option value="calypso">calypso</option>
            <option value="chime">chime</option>
            <option value="choo">choo</option>
            <option value="descent">descent</option>
            <option value="electronic">electronic</option>
            <option value="fanfare">fanfare</option>
            <option value="glass">glass</option>
            <option value="gotosleep">gotosleep</option>
            <option value="healthnotification">healthnotification</option>
            <option value="horn">horn</option>
            <option value="ladder">ladder</option>
            <option value="mailsent">mailsent</option>
            <option value="minuet">minuet</option>
            <option value="multiwayinvitation">multiwayinvitation</option>
            <option value="newmail">newmail</option>
            <option value="newsflash">newsflash</option>
            <option value="noir">noir</option>
            <option value="paymentsuccess">paymentsuccess</option>
            <option value="shake">shake</option>
            <option value="sherwoodforest">sherwoodforest</option>
            <option value="silence">silence</option>
            <option value="spell">spell</option>
            <option value="suspense">suspense</option>
            <option value="telegraph">telegraph</option>
            <option value="tiptoes">tiptoes</option>
            <option value="typewriters">typewriters</option>
            <option value="update">update</option>
        </select>
    </div>
</template>
