<template>
    <div>
        <div v-if="maintenance.strategy === 'manual'" class="timeslot">
            {{ $t("Manual") }}
        </div>
        <div v-else-if="maintenance.timeslotList.length > 0" class="timeslot">
            {{ maintenance.timeslotList[0].startDateServerTimezone }}
            <span class="to">-</span>
            {{ maintenance.timeslotList[0].endDateServerTimezone }}
            (UTC{{ maintenance.timeslotList[0].serverTimezoneOffset }})
        </div>
    </div>
</template>

<script>
export default {
    props: {
        maintenance: {
            type: Object,
            required: true
        },
    },
};
</script>

<style lang="scss">
.timeslot {
    margin-top: 5px;
    display: inline-block;
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    padding: 0 10px;

    .to {
        margin: 0 6px;
    }

    .dark & {
        color: white;
        background-color: rgba(255, 255, 255, 0.1);
    }
}
</style>
