<template>

    <div v-if="$route.name === 'DashboardHome'">
        <h1 class="mb-3">Quick Stats</h1>

        <div class="shadow-box big-padding text-center">
            <div class="row">

                <div class="col-12">
                    <div class="hp-bar-big">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                </div>

            	<div class="col">
                    <h3>Up</h3>
                    <span class="num">2</span>
                </div>
            	<div class="col">
                    <h3>Down</h3>
                    <span class="num text-danger">0</span>
                </div>
                <div class="col">
                    <h3>Pause</h3>
                    <span class="num">0</span>
                </div>
            </div>
        </div>

        <div class="row mt-4">
        	<div class="col-8">
                <h4>Latest Incident</h4>

                <div class="shadow-box bg-danger text-light">
                    MySQL was down.
                </div>

                <div class="shadow-box bg-primary text-light">
                    No issues was found.
                </div>

            </div>
        	<div class="col-4">

                <h4>Overall Uptime</h4>

                <div class="shadow-box">
                    <div>100.00% (24 hours)</div>
                    <div>100.00% (7 days)</div>
                    <div>100.00% (30 days)</div>
                </div>

            </div>
        </div>
    </div>

    <router-view ref="child" />
</template>

<script>
export default {
    computed: {

    }
}
</script>

<style scoped lang="scss">
@import "../assets/vars";

.num {
    font-size: 30px;
    color: $primary;
    font-weight: bold;
}
</style>
